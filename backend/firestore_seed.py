"""
Firestore Seed Script
=====================
Run: python firestore_seed.py
Seeds Firestore with 18 NER monitoring zones from the existing frontend data.
Idempotent — safe to run multiple times (uses zone ID as document key).
"""
import os
import sys
from pathlib import Path

# Load .env from same directory
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from firebase_admin_setup import init_firebase, get_db
init_firebase()

ZONES = [
    {
        "id": "guwahati", "name": "Guwahati", "state": "Assam", "district": "Kamrup Metro",
        "lat": 26.1445, "lng": 91.7362,
        "current_risk_level": "low", "ai_risk_score": 18, "predicted_probability": 6,
        "rainfall_mm": 12, "soil_moisture_pct": 42, "slope_angle_deg": 8, "vegetation_cover_pct": 68,
        "historical_slides": 1, "trigger_factors": ["Low rainfall", "Stable terrain"],
        "affected_area_km": 2, "population_at_risk": 1200,
        "emergency_station": {"name": "Assam SDRF Guwahati Base", "lat": 26.1623, "lng": 91.7471, "distance": "4.2 km", "contact_number": "0361-2237516"},
    },
    {
        "id": "silchar", "name": "Silchar", "state": "Assam", "district": "Cachar",
        "lat": 24.8333, "lng": 92.7789,
        "current_risk_level": "high", "ai_risk_score": 74, "predicted_probability": 68,
        "rainfall_mm": 186, "soil_moisture_pct": 88, "slope_angle_deg": 32, "vegetation_cover_pct": 45,
        "historical_slides": 7, "trigger_factors": ["Heavy rainfall", "Steep slopes", "Soil saturation"],
        "affected_area_km": 12, "population_at_risk": 8400,
        "emergency_station": {"name": "Silchar Civil Hospital Emergency", "lat": 24.8400, "lng": 92.7890, "distance": "2.1 km", "contact_number": "03842-233900"},
    },
    {
        "id": "dibrugarh", "name": "Dibrugarh", "state": "Assam", "district": "Dibrugarh",
        "lat": 27.4728, "lng": 94.9120,
        "current_risk_level": "moderate", "ai_risk_score": 41, "predicted_probability": 28,
        "rainfall_mm": 67, "soil_moisture_pct": 61, "slope_angle_deg": 15, "vegetation_cover_pct": 72,
        "historical_slides": 3, "trigger_factors": ["Moderate rainfall", "Brahmaputra bank erosion"],
        "affected_area_km": 5, "population_at_risk": 2800,
        "emergency_station": {"name": "Dibrugarh District Emergency", "lat": 27.4800, "lng": 94.9200, "distance": "1.8 km", "contact_number": "0373-2324610"},
    },
    {
        "id": "cherrapunji", "name": "Cherrapunji (Sohra)", "state": "Meghalaya", "district": "East Khasi Hills",
        "lat": 25.2800, "lng": 91.7100,
        "current_risk_level": "critical", "ai_risk_score": 94, "predicted_probability": 92,
        "rainfall_mm": 412, "soil_moisture_pct": 97, "slope_angle_deg": 48, "vegetation_cover_pct": 31,
        "historical_slides": 19, "trigger_factors": ["Extreme rainfall (world record zone)", "Fully saturated soil", "Steep plateau edges", "Deforestation"],
        "affected_area_km": 18, "population_at_risk": 15600,
        "emergency_station": {"name": "Sohra Block Emergency HQ", "lat": 25.2900, "lng": 91.7200, "distance": "1.2 km", "contact_number": "0364-2501260"},
    },
    {
        "id": "shillong", "name": "Shillong", "state": "Meghalaya", "district": "East Khasi Hills",
        "lat": 25.5788, "lng": 91.8933,
        "current_risk_level": "high", "ai_risk_score": 71, "predicted_probability": 64,
        "rainfall_mm": 154, "soil_moisture_pct": 82, "slope_angle_deg": 35, "vegetation_cover_pct": 48,
        "historical_slides": 9, "trigger_factors": ["Heavy rainfall", "Urban slope encroachment", "Degraded vegetation"],
        "affected_area_km": 9, "population_at_risk": 11200,
        "emergency_station": {"name": "Meghalaya SDMA Shillong", "lat": 25.5850, "lng": 91.8800, "distance": "0.8 km", "contact_number": "0364-2504800"},
    },
    {
        "id": "tura", "name": "Tura", "state": "Meghalaya", "district": "West Garo Hills",
        "lat": 25.5143, "lng": 90.2169,
        "current_risk_level": "moderate", "ai_risk_score": 38, "predicted_probability": 24,
        "rainfall_mm": 58, "soil_moisture_pct": 57, "slope_angle_deg": 22, "vegetation_cover_pct": 65,
        "historical_slides": 4, "trigger_factors": ["Moderate rainfall", "Coal mining subsidence"],
        "affected_area_km": 4, "population_at_risk": 3100,
        "emergency_station": {"name": "Tura District Hospital", "lat": 25.5200, "lng": 90.2300, "distance": "1.5 km", "contact_number": "03651-222000"},
    },
    {
        "id": "kohima", "name": "Kohima", "state": "Nagaland", "district": "Kohima",
        "lat": 25.6747, "lng": 94.1086,
        "current_risk_level": "high", "ai_risk_score": 77, "predicted_probability": 72,
        "rainfall_mm": 168, "soil_moisture_pct": 84, "slope_angle_deg": 41, "vegetation_cover_pct": 38,
        "historical_slides": 11, "trigger_factors": ["Heavy rainfall", "Steep hill terrain", "Road construction cuts"],
        "affected_area_km": 11, "population_at_risk": 9800,
        "emergency_station": {"name": "Nagaland SDRF Kohima", "lat": 25.6800, "lng": 94.1150, "distance": "1.0 km", "contact_number": "0370-2290100"},
    },
    {
        "id": "wokha", "name": "Wokha", "state": "Nagaland", "district": "Wokha",
        "lat": 26.1047, "lng": 94.2610,
        "current_risk_level": "moderate", "ai_risk_score": 44, "predicted_probability": 31,
        "rainfall_mm": 78, "soil_moisture_pct": 65, "slope_angle_deg": 28, "vegetation_cover_pct": 58,
        "historical_slides": 5, "trigger_factors": ["Moderate rainfall", "Terrace farming disturbance"],
        "affected_area_km": 6, "population_at_risk": 4200,
        "emergency_station": {"name": "Wokha District HQ", "lat": 26.1100, "lng": 94.2700, "distance": "2.3 km", "contact_number": "03869-220126"},
    },
    {
        "id": "imphal", "name": "Imphal Valley", "state": "Manipur", "district": "Imphal East",
        "lat": 24.8170, "lng": 93.9368,
        "current_risk_level": "moderate", "ai_risk_score": 36, "predicted_probability": 21,
        "rainfall_mm": 54, "soil_moisture_pct": 55, "slope_angle_deg": 12, "vegetation_cover_pct": 70,
        "historical_slides": 2, "trigger_factors": ["Moderate rainfall", "Valley floor instability"],
        "affected_area_km": 3, "population_at_risk": 1900,
        "emergency_station": {"name": "RIMS Hospital Imphal Emergency", "lat": 24.8220, "lng": 93.9420, "distance": "1.2 km", "contact_number": "0385-2414916"},
    },
    {
        "id": "churachandpur", "name": "Churachandpur", "state": "Manipur", "district": "Churachandpur",
        "lat": 24.3333, "lng": 93.6833,
        "current_risk_level": "high", "ai_risk_score": 69, "predicted_probability": 61,
        "rainfall_mm": 142, "soil_moisture_pct": 79, "slope_angle_deg": 38, "vegetation_cover_pct": 42,
        "historical_slides": 8, "trigger_factors": ["Heavy rainfall", "Hilly terrain", "Jhum cultivation impacts"],
        "affected_area_km": 10, "population_at_risk": 7600,
        "emergency_station": {"name": "Churachandpur District Hospital", "lat": 24.3400, "lng": 93.6900, "distance": "1.8 km", "contact_number": "03874-234200"},
    },
    {
        "id": "aizawl", "name": "Aizawl", "state": "Mizoram", "district": "Aizawl",
        "lat": 23.7271, "lng": 92.7176,
        "current_risk_level": "high", "ai_risk_score": 78, "predicted_probability": 74,
        "rainfall_mm": 172, "soil_moisture_pct": 86, "slope_angle_deg": 44, "vegetation_cover_pct": 35,
        "historical_slides": 14, "trigger_factors": ["Heavy rainfall", "Extremely steep slopes", "Dense urban settlement"],
        "affected_area_km": 13, "population_at_risk": 12400,
        "emergency_station": {"name": "Mizoram SDMA Aizawl HQ", "lat": 23.7350, "lng": 92.7250, "distance": "1.3 km", "contact_number": "0389-2320001"},
    },
    {
        "id": "lunglei", "name": "Lunglei", "state": "Mizoram", "district": "Lunglei",
        "lat": 22.8884, "lng": 92.7439,
        "current_risk_level": "critical", "ai_risk_score": 89, "predicted_probability": 87,
        "rainfall_mm": 298, "soil_moisture_pct": 94, "slope_angle_deg": 52, "vegetation_cover_pct": 28,
        "historical_slides": 16, "trigger_factors": ["Extreme rainfall", "Steepest terrain in district", "Active erosion", "Bamboo felling"],
        "affected_area_km": 15, "population_at_risk": 13800,
        "emergency_station": {"name": "Lunglei District Emergency", "lat": 22.8950, "lng": 92.7520, "distance": "1.5 km", "contact_number": "03722-222000"},
    },
    {
        "id": "agartala", "name": "Agartala", "state": "Tripura", "district": "West Tripura",
        "lat": 23.8315, "lng": 91.2868,
        "current_risk_level": "low", "ai_risk_score": 22, "predicted_probability": 9,
        "rainfall_mm": 28, "soil_moisture_pct": 46, "slope_angle_deg": 6, "vegetation_cover_pct": 74,
        "historical_slides": 1, "trigger_factors": ["Low rainfall", "Flat terrain"],
        "affected_area_km": 2, "population_at_risk": 900,
        "emergency_station": {"name": "Tripura SDRF Agartala", "lat": 23.8400, "lng": 91.2950, "distance": "2.0 km", "contact_number": "0381-2325759"},
    },
    {
        "id": "sabroom", "name": "Sabroom", "state": "Tripura", "district": "South Tripura",
        "lat": 23.0738, "lng": 91.8110,
        "current_risk_level": "moderate", "ai_risk_score": 45, "predicted_probability": 29,
        "rainfall_mm": 84, "soil_moisture_pct": 63, "slope_angle_deg": 19, "vegetation_cover_pct": 61,
        "historical_slides": 3, "trigger_factors": ["Moderate rainfall", "Southern hilly terrain"],
        "affected_area_km": 5, "population_at_risk": 3400,
        "emergency_station": {"name": "Sabroom Block Emergency", "lat": 23.0800, "lng": 91.8200, "distance": "2.8 km", "contact_number": "03826-232500"},
    },
    {
        "id": "itanagar", "name": "Itanagar", "state": "Arunachal Pradesh", "district": "Papum Pare",
        "lat": 27.0844, "lng": 93.6053,
        "current_risk_level": "high", "ai_risk_score": 72, "predicted_probability": 66,
        "rainfall_mm": 158, "soil_moisture_pct": 81, "slope_angle_deg": 36, "vegetation_cover_pct": 44,
        "historical_slides": 10, "trigger_factors": ["Heavy rainfall", "Seismic Zone V", "Rapid urbanization"],
        "affected_area_km": 10, "population_at_risk": 8900,
        "emergency_station": {"name": "Arunachal SDMA Emergency", "lat": 27.0900, "lng": 93.6120, "distance": "1.6 km", "contact_number": "0360-2213401"},
    },
    {
        "id": "along", "name": "Along (Aalo)", "state": "Arunachal Pradesh", "district": "West Siang",
        "lat": 28.1660, "lng": 94.7963,
        "current_risk_level": "critical", "ai_risk_score": 91, "predicted_probability": 89,
        "rainfall_mm": 324, "soil_moisture_pct": 96, "slope_angle_deg": 55, "vegetation_cover_pct": 26,
        "historical_slides": 18, "trigger_factors": ["Extreme rainfall", "Earthquake zone (Zone V)", "Glacial melt input", "Near-vertical slopes"],
        "affected_area_km": 16, "population_at_risk": 14200,
        "emergency_station": {"name": "Along Civil Hospital Emergency", "lat": 28.1750, "lng": 94.8050, "distance": "1.9 km", "contact_number": "03783-222204"},
    },
    {
        "id": "gangtok", "name": "Gangtok", "state": "Sikkim", "district": "East Sikkim",
        "lat": 27.3389, "lng": 88.6065,
        "current_risk_level": "high", "ai_risk_score": 76, "predicted_probability": 70,
        "rainfall_mm": 163, "soil_moisture_pct": 83, "slope_angle_deg": 40, "vegetation_cover_pct": 39,
        "historical_slides": 12, "trigger_factors": ["Heavy rainfall", "Seismic instability", "GLOF risk from high-altitude lakes"],
        "affected_area_km": 11, "population_at_risk": 10400,
        "emergency_station": {"name": "SSDMA Gangtok HQ", "lat": 27.3450, "lng": 88.6130, "distance": "1.1 km", "contact_number": "03592-202036"},
    },
    {
        "id": "mangan", "name": "Mangan", "state": "Sikkim", "district": "North Sikkim",
        "lat": 27.5094, "lng": 88.5284,
        "current_risk_level": "critical", "ai_risk_score": 96, "predicted_probability": 94,
        "rainfall_mm": 386, "soil_moisture_pct": 98, "slope_angle_deg": 58, "vegetation_cover_pct": 22,
        "historical_slides": 21, "trigger_factors": ["Extreme rainfall", "Himalayan seismic zone", "GLOF from glacial lakes", "Permafrost thaw", "Steep Himalayan terrain"],
        "affected_area_km": 19, "population_at_risk": 16800,
        "emergency_station": {"name": "Mangan SDM Emergency HQ", "lat": 27.5150, "lng": 88.5360, "distance": "1.3 km", "contact_number": "03592-234100"},
    },
]


def seed():
    db = get_db()
    if not db:
        print("ERROR: Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH in .env")
        sys.exit(1)

    print(f"Seeding {len(ZONES)} NER monitoring zones...")
    for zone in ZONES:
        zone_id = zone.pop("id")
        db.collection("monitoring_zones").document(zone_id).set(zone, merge=True)
        print(f"  ✓ {zone['name']} ({zone['state']})")

    print(f"\nDone. {len(ZONES)} zones seeded to Firestore collection 'monitoring_zones'.")


if __name__ == "__main__":
    seed()
