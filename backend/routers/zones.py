from fastapi import APIRouter, HTTPException
from typing import Optional

from firebase_admin_setup import get_db

router = APIRouter(prefix="/api", tags=["zones"])


@router.get("/zones")
async def get_zones(state: Optional[str] = None):
    """
    Return all monitoring zones from Firestore.
    Optionally filter by state name.
    Falls back to empty list if Firestore not configured.
    """
    db = get_db()
    if not db:
        return {"zones": [], "source": "firestore_unavailable", "message": "Firebase not configured"}

    query = db.collection("monitoring_zones")
    if state:
        query = query.where("state", "==", state)

    docs = query.stream()
    zones = []
    for doc in docs:
        z = doc.to_dict()
        z["id"] = doc.id
        zones.append(z)

    # Sort by risk severity
    risk_order = {"critical": 0, "high": 1, "moderate": 2, "low": 3}
    zones.sort(key=lambda z: risk_order.get(z.get("current_risk_level", "low"), 3))

    return {"zones": zones, "count": len(zones), "source": "firestore"}


@router.get("/zones/{zone_id}")
async def get_zone(zone_id: str):
    """Return a single monitoring zone by ID."""
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Firebase not configured")

    doc = db.collection("monitoring_zones").document(zone_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")

    data = doc.to_dict()
    data["id"] = doc.id
    return data


@router.get("/emergency-contacts")
async def get_emergency_contacts(zone_id: Optional[str] = None):
    """
    Return verified emergency contacts.
    If zone_id provided, returns zone-specific contact + national contacts.
    Contacts come from Firestore or static config — never invented.
    """
    national_contacts = [
        {"name": "National Emergency", "number": "112", "type": "emergency"},
        {"name": "NDMA", "number": "1078", "type": "disaster_management"},
        {"name": "NDRF Helpline", "number": "011-24363260", "type": "rescue"},
    ]

    zone_contact = None
    if zone_id:
        db = get_db()
        if db:
            doc = db.collection("monitoring_zones").document(zone_id).get()
            if doc.exists:
                data = doc.to_dict()
                es = data.get("emergency_station", {})
                if es:
                    zone_contact = {
                        "name": es.get("name"),
                        "number": es.get("contact_number"),
                        "type": "local_emergency",
                        "distance": es.get("distance"),
                    }

    return {
        "national": national_contacts,
        "zone": zone_contact,
        "note": "Always verify contacts with official sources. Call 112 for immediate emergencies.",
    }
