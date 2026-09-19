"""
Alert Service
=============
Generates alerts when risk exceeds configured thresholds.
Stores alerts in Firestore.
Optionally sends SMS via Twilio (requires TWILIO_* env vars).

NO real SMS is sent unless explicitly configured and enabled.
"""
from datetime import datetime, timezone
from typing import Optional

from config import settings
from firebase_admin_setup import get_db

RISK_SEVERITY = {"Low": 0, "Moderate": 1, "High": 2, "Critical": 3}
ALERT_THRESHOLD = "High"  # Generate alerts at High and Critical


def should_alert(risk_level: str) -> bool:
    return RISK_SEVERITY.get(risk_level, 0) >= RISK_SEVERITY[ALERT_THRESHOLD]


def create_alert(
    zone_id: str,
    zone_name: str,
    risk_level: str,
    risk_score: float,
    message: str,
    phone_numbers: Optional[list[str]] = None,
    send_sms: bool = False,
) -> dict:
    """Create and persist an alert. Returns the alert dict."""
    alert = {
        "zone_id": zone_id,
        "zone_name": zone_name,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "message": message,
        "is_active": True,
        "sms_sent": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "acknowledged_at": None,
    }

    db = get_db()
    if db:
        ref = db.collection("alerts").add(alert)
        alert["id"] = ref[1].id
    else:
        alert["id"] = f"local-{zone_id}-{int(datetime.now().timestamp())}"

    if send_sms and phone_numbers and settings.twilio_configured:
        try:
            _send_sms_alerts(zone_name, risk_level, message, phone_numbers)
            alert["sms_sent"] = True
        except Exception as e:
            print(f"[SMS ERROR] {e}")
    elif send_sms:
        print("[SMS] Not configured — skipping SMS send. Set TWILIO_* env vars to enable.")

    return alert


def get_active_alerts() -> list[dict]:
    """Fetch active alerts from Firestore."""
    db = get_db()
    if not db:
        return []
    docs = (
        db.collection("alerts")
        .where("is_active", "==", True)
        .order_by("created_at", direction="DESCENDING")
        .limit(50)
        .stream()
    )
    alerts = []
    for doc in docs:
        a = doc.to_dict()
        a["id"] = doc.id
        alerts.append(a)
    return alerts


def _send_sms_alerts(zone_name: str, risk_level: str, message: str, phone_numbers: list[str]):
    """Send SMS via Twilio. Called only if Twilio is configured."""
    from twilio.rest import Client
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    sms_body = (
        f"[NER Early Warning] {zone_name}: {risk_level} landslide risk alert. "
        f"{message[:100]} Call 112 for emergencies."
    )
    for number in phone_numbers:
        client.messages.create(
            body=sms_body,
            from_=settings.twilio_from_number,
            to=number,
        )
        print(f"[SMS] Sent to {number}")
