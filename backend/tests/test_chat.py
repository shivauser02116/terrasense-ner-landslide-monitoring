import pytest
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


def test_chat_english_fallback():
    resp = client.post("/api/chat", json={"message": "What is the risk score?", "language": "en"})
    assert resp.status_code == 200
    data = resp.json()
    assert "response" in data
    assert data["language"] == "en"
    assert len(data["response"]) > 0


def test_chat_kannada_fallback():
    resp = client.post("/api/chat", json={"message": "ಅಪಾಯ", "language": "kn"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["language"] == "kn"


def test_chat_invalid_language():
    resp = client.post("/api/chat", json={"message": "hello", "language": "fr"})
    assert resp.status_code == 422


def test_chat_with_zone_id():
    resp = client.post("/api/chat", json={"message": "Why is this zone high risk?", "language": "en", "zone_id": "silchar"})
    assert resp.status_code == 200
