"""
Offline Sync Endpoint
=====================
Accepts a batch of field reports that were queued on the device while offline.
Each report must include a device-generated report_id for idempotency.
Duplicate reports (same report_id) are silently skipped, not double-inserted.
"""
from fastapi import APIRouter, HTTPException, status
from datetime import datetime, timezone
from typing import List
from ml.feature_schema import SyncReportItem
from firebase_admin_setup import get_db

router = APIRouter(prefix="/api", tags=["sync"])


@router.post("/sync-reports", status_code=status.HTTP_200_OK)
async def sync_reports(reports: List[SyncReportItem]):
    """
    Idempotent batch upload for offline-queued field reports.
    Returns per-report status: created | skipped (duplicate) | error.
    """
    if len(reports) > 100:
        raise HTTPException(status_code=400, detail="Batch size exceeds 100 reports")

    db = get_db()
    results = []

    for item in reports:
        status_val = "error"
        reason = None
        try:
            if db:
                doc_ref = db.collection("field_reports").document(item.report_id)
                existing = doc_ref.get()
                if existing.exists:
                    status_val = "skipped"
                    reason = "duplicate"
                else:
                    doc_ref.set({
                        "zone_id": item.zone_id,
                        "reporter_id": item.reporter_id,
                        "lat": item.lat,
                        "lng": item.lng,
                        "report_type": item.report_type,
                        "description": item.description,
                        "timestamp": item.timestamp,
                        "media_urls": [],
                        "synced": True,
                        "synced_at": datetime.now(timezone.utc).isoformat(),
                    })
                    status_val = "created"
            else:
                status_val = "skipped"
                reason = "firebase_unavailable"
        except Exception as e:
            reason = str(e)

        results.append({
            "report_id": item.report_id,
            "status": status_val,
            "reason": reason,
        })

    created = sum(1 for r in results if r["status"] == "created")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    errors = sum(1 for r in results if r["status"] == "error")

    return {
        "results": results,
        "summary": {"total": len(reports), "created": created, "skipped": skipped, "errors": errors},
    }
