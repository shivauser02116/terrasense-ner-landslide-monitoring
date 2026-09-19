from fastapi import APIRouter, HTTPException
from typing import Optional

from firebase_admin_setup import get_db
from zone_data import ZONES as STATIC_ZONES, RISK_ORDER

router = APIRouter(prefix="/api", tags=["zones"])


@router.get("/zones")
async def get_zones(state: Optional[str] = None):
    """
    Return all monitoring zones.
    Tries Firestore first; falls back to static in-memory NER zone data
    when Firebase is not configured (no credentials present).
    """
    db = get_db()
    if db:
        query = db.collection("monitoring_zones")
        if state:
            query = query.where("state", "==", state)

        docs = query.stream()
        zones = []
        for doc in docs:
            z = doc.to_dict()
            z["id"] = doc.id
            zones.append(z)

        if zones:
            zones.sort(key=lambda z: RISK_ORDER.get(z.get("current_risk_level", "low"), 3))
            return {"zones": zones, "count": len(zones), "source": "firestore"}

    # Fallback: serve static in-memory NER zone dataset
    zones = []
    for z in STATIC_ZONES:
        zone = dict(z)  # shallow copy so we don't mutate the source
        if state and zone.get("state", "").lower() != state.lower():
            continue
        zones.append(zone)

    zones.sort(key=lambda z: RISK_ORDER.get(z.get("current_risk_level", "low"), 3))
    return {"zones": zones, "count": len(zones), "source": "static_fallback"}


@router.get("/zones/{zone_id}")
async def get_zone(zone_id: str):
    """Return a single monitoring zone by ID. Tries Firestore, falls back to static data."""
    db = get_db()
    if db:
        doc = db.collection("monitoring_zones").document(zone_id).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            return data

    # Fallback to static data
    for z in STATIC_ZONES:
        if z["id"] == zone_id:
            return dict(z)

    raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")


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

        # Fallback to static zone data for emergency station
        if not zone_contact:
            for z in STATIC_ZONES:
                if z["id"] == zone_id:
                    es = z.get("emergency_station", {})
                    if es:
                        zone_contact = {
                            "name": es.get("name"),
                            "number": es.get("contact_number"),
                            "type": "local_emergency",
                            "distance": es.get("distance"),
                        }
                    break

    return {
        "national": national_contacts,
        "zone": zone_contact,
        "note": "Always verify contacts with official sources. Call 112 for immediate emergencies.",
    }
