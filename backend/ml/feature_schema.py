from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime, timezone

class RiskInput(BaseModel):
    zone_id: str = Field(..., description="Zone identifier")
    rainfall_mm: float = Field(..., ge=0, le=2000, description="24-hour rainfall in mm")
    soil_moisture_pct: float = Field(..., ge=0, le=100, description="Soil moisture percentage")
    slope_angle_deg: float = Field(..., ge=0, le=90, description="Slope angle in degrees")
    vegetation_cover_pct: float = Field(..., ge=0, le=100, description="Vegetation cover percentage")
    historical_slides: int = Field(..., ge=0, le=100, description="Historical slides count (last 5 years)")
    zone_name: Optional[str] = None


class ContributingFactor(BaseModel):
    factor: str
    weight: float  # 0-1 relative contribution
    value: str     # human-readable value


class RiskPrediction(BaseModel):
    zone_id: str
    zone_name: Optional[str] = None
    risk_score: float         # 0–100
    risk_level: str           # Low | Moderate | High | Critical
    probability_24h: float    # 0–100 percentage
    contributing_factors: list[ContributingFactor]
    prediction_timestamp: str
    simulated: bool = True
    model_version: str = "formula-v1.0-prototype"
    disclaimer: str = (
        "PROTOTYPE — This prediction uses a weighted domain-expert formula, "
        "NOT a scientifically trained ML model. Do NOT use for operational emergency decisions."
    )


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    language: str = Field(default="en", pattern="^(en|kn)$")
    zone_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    language: str
    disclaimer: str = "AI assistant — verify all emergency information with official sources."


class FieldReportCreate(BaseModel):
    zone_id: str
    reporter_id: Optional[str] = None
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    report_type: str = Field(..., description="e.g. landslide, crack, waterlogging, road_damage")
    description: str = Field(..., min_length=5, max_length=2000)
    report_id: Optional[str] = None  # device-generated ID for idempotency


class AlertCreate(BaseModel):
    zone_id: str
    risk_level: str
    message: str
    send_sms: bool = False
    phone_numbers: list[str] = []


class SyncReportItem(BaseModel):
    report_id: str           # device-side UUID (dedup key)
    zone_id: str
    reporter_id: Optional[str] = None
    lat: float
    lng: float
    report_type: str
    description: str
    timestamp: str           # ISO 8601 from device
