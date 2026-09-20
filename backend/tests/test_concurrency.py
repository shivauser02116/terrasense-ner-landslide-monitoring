import asyncio
import pytest
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_concurrent_predict_requests():
    """Simulate 20 concurrent users requesting risk predictions simultaneously."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        zones = ["guwahati", "silchar", "cherrapunji", "aizawl", "mangan"]
        tasks = []
        for i in range(20):
            zone_id = zones[i % len(zones)]
            payload = {
                "zone_id": zone_id,
                "rainfall_mm": 50.0 + (i * 10),
                "soil_moisture_pct": 40.0 + (i * 2),
                "slope_angle_deg": 10.0 + (i * 2),
                "vegetation_cover_pct": max(10.0, 80.0 - i),
                "historical_slides": i % 10,
            }
            tasks.append(client.post("/api/predict-risk", json=payload))

        responses = await asyncio.gather(*tasks)
        for res in responses:
            assert res.status_code == 200
            data = res.json()
            assert "risk_score" in data
            assert "risk_level" in data
            assert "probability_24h" in data
            assert len(data["contributing_factors"]) == 5


@pytest.mark.asyncio
async def test_concurrent_chat_sessions():
    """Simulate concurrent bilingual chat queries from distinct users."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        queries = [
            {"message": "What is the risk level?", "language": "en", "zone_id": "silchar"},
            {"message": "ತುರ್ತು ಸಹಾಯ ಬೇಕು", "language": "kn", "zone_id": "mangan"},
            {"message": "How is the probability computed?", "language": "en", "zone_id": "aizawl"},
            {"message": "ಅಪಾಯದ ಮಾಹಿತಿ ನೀಡಿ", "language": "kn", "zone_id": "cherrapunji"},
        ] * 5

        tasks = [client.post("/api/chat", json=q) for q in queries]
        responses = await asyncio.gather(*tasks)
        for idx, res in enumerate(responses):
            assert res.status_code == 200
            data = res.json()
            assert "response" in data
            assert len(data["response"]) > 0
            assert data["language"] == queries[idx]["language"]


@pytest.mark.asyncio
async def test_concurrent_zone_and_contact_reads():
    """Simulate multiple users fetching zone lists and specific zone details at the same time."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        tasks = [
            client.get("/api/zones"),
            client.get("/api/zones/silchar"),
            client.get("/api/zones/mangan"),
            client.get("/api/emergency-contacts?zone_id=silchar"),
            client.get("/api/emergency-contacts"),
        ] * 4

        responses = await asyncio.gather(*tasks)
        for res in responses:
            assert res.status_code == 200
