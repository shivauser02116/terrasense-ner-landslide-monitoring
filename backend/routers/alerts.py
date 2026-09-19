from fastapi import APIRouter, HTTPException, status
from ml.feature_schema import AlertCreate
from services.alert_service import create_alert, get_active_alerts
from firebase_admin_setup import get_db

router = APIRouter(prefix="/api", tags=["alerts"])


@router.get("/alerts")
async def list_alerts():
    """Return all currently active alerts."""
    alerts = get_active_alerts()
    return {"alerts": alerts, "count": len(alerts)}


@router.post("/alerts", status_code=status.HTTP_201_CREATED)
async def create_new_alert(body: AlertCreate):
    """Manually create an alert (admin/system use)."""
    # Resolve zone name
    zone_name = body.zone_id
    db = get_db()
    if db:
        doc = db.collection("monitoring_zones").document(body.zone_id).get()
        if doc.exists:
            zone_name = doc.to_dict().get("name", body.zone_id)

    alert = create_alert(
        zone_id=body.zone_id,
        zone_name=zone_name,
        risk_level=body.risk_level,
        risk_score=0.0,
        message=body.message,
        phone_numbers=body.phone_numbers,
        send_sms=body.send_sms,
    )
    return {"alert": alert, "created": True}


@router.patch("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Mark an alert as acknowledged (no longer active)."""
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Firebase not configured")

    from datetime import datetime, timezone
    db.collection("alerts").document(alert_id).update({
        "is_active": False,
        "acknowledged_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"acknowledged": True, "alert_id": alert_id}
