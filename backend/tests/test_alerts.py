from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys

sys.modules["firebase_admin"] = MagicMock()
sys.modules["firebase_admin.credentials"] = MagicMock()
sys.modules["firebase_admin.firestore"] = MagicMock()
sys.modules["firebase_admin.storage"] = MagicMock()

with patch("firebase_admin_setup.init_firebase"), patch("firebase_admin_setup.get_db", return_value=None):
    from main import app

client = TestClient(app)


def test_list_alerts_empty():
    resp = client.get("/api/alerts")
    assert resp.status_code == 200
    data = resp.json()
    assert "alerts" in data
    assert isinstance(data["alerts"], list)


def test_emergency_contacts_national():
    resp = client.get("/api/emergency-contacts")
    assert resp.status_code == 200
    data = resp.json()
    assert "national" in data
    # Ensure 112 is always present
    numbers = [c["number"] for c in data["national"]]
    assert "112" in numbers
