from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from typing import Optional, List
import uuid
from datetime import datetime, timezone

from ml.feature_schema import FieldReportCreate
from services.storage_service import upload_media, validate_upload
from firebase_admin_setup import get_db

router = APIRouter(prefix="/api", tags=["field_reports"])


@router.post("/field-reports", status_code=status.HTTP_201_CREATED)
async def create_field_report(
    zone_id: str = Form(...),
    reporter_id: Optional[str] = Form(None),
    lat: float = Form(...),
    lng: float = Form(...),
    report_type: str = Form(...),
    description: str = Form(...),
    report_id: Optional[str] = Form(None),  # device-generated UUID for idempotency
    files: List[UploadFile] = File(default=[]),
):
    """
    Create a field report with optional geo-tagged media.
    Supports idempotent submission via report_id (device UUID).
    """
    # Validate inputs
    if len(description) < 5:
        raise HTTPException(status_code=400, detail="Description too short")
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")

    # Use device-provided ID for idempotency, or generate one
    final_report_id = report_id or str(uuid.uuid4())

    db = get_db()
    # Idempotency check — if report_id already exists, return existing
    if db and report_id:
        existing = db.collection("field_reports").document(report_id).get()
        if existing.exists:
            data = existing.to_dict()
            data["id"] = existing.id
            return {"report": data, "created": False, "idempotent_skip": True}

    # Upload media files
    media_urls = []
    for f in files:
        contents = await f.read()
        try:
            url = upload_media(
                file_bytes=contents,
                filename=f.filename or "upload",
                content_type=f.content_type or "application/octet-stream",
                zone_id=zone_id,
                report_id=final_report_id,
            )
            if url:
                media_urls.append(url)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    report = {
        "zone_id": zone_id,
        "reporter_id": reporter_id,
        "lat": lat,
        "lng": lng,
        "report_type": report_type,
        "description": description,
        "media_urls": media_urls,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "synced": True,
    }

    if db:
        db.collection("field_reports").document(final_report_id).set(report)

    report["id"] = final_report_id
    return {"report": report, "created": True}


@router.get("/field-reports")
async def list_field_reports(zone_id: Optional[str] = None, limit: int = 50):
    """List field reports, optionally filtered by zone."""
    db = get_db()
    if not db:
        return {"reports": [], "source": "firestore_unavailable"}

    query = db.collection("field_reports").order_by("timestamp", direction="DESCENDING").limit(limit)
    if zone_id:
        query = db.collection("field_reports").where("zone_id", "==", zone_id).order_by("timestamp", direction="DESCENDING").limit(limit)

    docs = query.stream()
    reports = []
    for doc in docs:
        r = doc.to_dict()
        r["id"] = doc.id
        reports.append(r)

    return {"reports": reports, "count": len(reports)}


@router.get("/field-reports/{report_id}")
async def get_field_report(report_id: str):
    """Get a single field report by ID."""
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Firebase not configured")

    doc = db.collection("field_reports").document(report_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Report not found")

    data = doc.to_dict()
    data["id"] = doc.id
    return data
