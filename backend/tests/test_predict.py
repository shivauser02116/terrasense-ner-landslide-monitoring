import pytest
from fastapi.testclient import TestClient

# Patch Firebase before import
import sys
from unittest.mock import patch, MagicMock
sys.modules["firebase_admin"] = MagicMock()
sys.modules["firebase_admin.credentials"] = MagicMock()
sys.modules["firebase_admin.firestore"] = MagicMock()
sys.modules["firebase_admin.storage"] = MagicMock()

with patch("firebase_admin_setup.init_firebase"), patch("firebase_admin_setup.get_db", return_value=None):
    from main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_predict_risk_high():
    payload = {
        "zone_id": "test_zone",
        "rainfall_mm": 200,
        "soil_moisture_pct": 85,
        "slope_angle_deg": 35,
        "vegetation_cover_pct": 40,
        "historical_slides": 8,
    }
    resp = client.post("/api/predict-risk", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "risk_score" in data
    assert "risk_level" in data
    assert data["risk_level"] in ["Low", "Moderate", "High", "Critical"]
    assert data["simulated"] is True
    assert 0 <= data["risk_score"] <= 100
    assert len(data["contributing_factors"]) == 5


def test_predict_risk_low():
    payload = {
        "zone_id": "test_zone",
        "rainfall_mm": 5,
        "soil_moisture_pct": 20,
        "slope_angle_deg": 5,
        "vegetation_cover_pct": 90,
        "historical_slides": 0,
    }
    resp = client.post("/api/predict-risk", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_level"] == "Low"
    assert data["risk_score"] < 35


def test_predict_risk_critical():
    payload = {
        "zone_id": "mangan",
        "rainfall_mm": 386,
        "soil_moisture_pct": 98,
        "slope_angle_deg": 58,
        "vegetation_cover_pct": 22,
        "historical_slides": 21,
    }
    resp = client.post("/api/predict-risk", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_level"] == "Critical"
    assert data["risk_score"] >= 80


def test_predict_invalid_rainfall():
    payload = {
        "zone_id": "test",
        "rainfall_mm": -10,  # invalid
        "soil_moisture_pct": 50,
        "slope_angle_deg": 20,
        "vegetation_cover_pct": 50,
        "historical_slides": 2,
    }
    resp = client.post("/api/predict-risk", json=payload)
    assert resp.status_code == 422  # Validation error
