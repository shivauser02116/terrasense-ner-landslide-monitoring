"""
Risk Engine — Formula-Based Prototype
=======================================
This module computes a landslide risk score using a weighted domain-expert
formula. It is NOT a trained machine-learning model.

The formula is designed to be pluggable: replace `compute_risk_score()` with
a call to a trained sklearn/xgboost/tensorflow model when a validated dataset
becomes available.

Weight rationale (based on NDMA landslide risk literature for NER India):
  - Rainfall:           35% — primary trigger in NER's monsoon climate
  - Soil moisture:      25% — amplifies rainfall effect
  - Slope angle:        20% — static susceptibility factor
  - Vegetation cover:   12% — inverse relationship (protective)
  - Historical slides:   8% — zone-level susceptibility proxy
"""

from math import exp
from .feature_schema import RiskInput, RiskPrediction, ContributingFactor
from datetime import datetime, timezone

# Calibration constants
WEIGHTS = {
    "rainfall":    0.35,
    "soil":        0.25,
    "slope":       0.20,
    "vegetation":  0.12,
    "history":     0.08,
}

# Normalization reference maxima (domain-informed for NER region)
NORM = {
    "rainfall":   500.0,   # mm/24h — Cherrapunji record ~1000, danger starts ~200
    "soil":       100.0,   # percent
    "slope":       70.0,   # degrees — vertical cliff = 90, critical slope = ~45
    "history":     25.0,   # events in 5 years
}


def _normalize_rainfall(mm: float) -> float:
    """Non-linear: danger accelerates above 100mm."""
    raw = mm / NORM["rainfall"]
    # Apply sigmoid-like amplification above 0.2 (100mm)
    if raw > 0.2:
        amplified = 0.2 + (raw - 0.2) * 1.4
        return min(amplified, 1.0)
    return raw


def _normalize_slope(deg: float) -> float:
    """Non-linear: risk accelerates sharply above 30°."""
    raw = deg / NORM["slope"]
    if deg > 30:
        amplified = (30 / NORM["slope"]) + ((deg - 30) / NORM["slope"]) * 1.5
        return min(amplified, 1.0)
    return raw


def _normalize_vegetation(pct: float) -> float:
    """Vegetation is inverse — low cover = high risk."""
    return 1.0 - (pct / 100.0)


def compute_risk_score(inp: RiskInput) -> dict:
    """
    Returns raw component scores and weighted total in [0, 100].
    Replace this function body with a trained model call to upgrade.
    """
    rainfall_score   = _normalize_rainfall(inp.rainfall_mm)
    soil_score       = inp.soil_moisture_pct / 100.0
    slope_score      = _normalize_slope(inp.slope_angle_deg)
    veg_score        = _normalize_vegetation(inp.vegetation_cover_pct)
    history_score    = min(inp.historical_slides / NORM["history"], 1.0)

    weighted = (
        WEIGHTS["rainfall"]   * rainfall_score  +
        WEIGHTS["soil"]       * soil_score       +
        WEIGHTS["slope"]      * slope_score      +
        WEIGHTS["vegetation"] * veg_score        +
        WEIGHTS["history"]    * history_score
    )

    # Scale to 0–100 and clamp
    risk_score = round(min(max(weighted * 100, 0), 100), 1)

    return {
        "risk_score": risk_score,
        "components": {
            "rainfall":   round(rainfall_score * 100, 1),
            "soil":       round(soil_score * 100, 1),
            "slope":      round(slope_score * 100, 1),
            "vegetation": round(veg_score * 100, 1),
            "history":    round(history_score * 100, 1),
        }
    }


def classify_risk(score: float) -> tuple[str, float]:
    """Returns (risk_level, probability_24h)."""
    if score >= 80:
        return ("Critical", round(min(score * 1.0, 98), 1))
    elif score >= 60:
        return ("High", round(score * 0.92, 1))
    elif score >= 35:
        return ("Moderate", round(score * 0.72, 1))
    else:
        return ("Low", round(score * 0.45, 1))


def build_contributing_factors(inp: RiskInput, components: dict) -> list[ContributingFactor]:
    factors = [
        ContributingFactor(
            factor="24-hour Rainfall",
            weight=WEIGHTS["rainfall"],
            value=f"{inp.rainfall_mm} mm/24h"
        ),
        ContributingFactor(
            factor="Soil Moisture",
            weight=WEIGHTS["soil"],
            value=f"{inp.soil_moisture_pct}%"
        ),
        ContributingFactor(
            factor="Slope Angle",
            weight=WEIGHTS["slope"],
            value=f"{inp.slope_angle_deg}°"
        ),
        ContributingFactor(
            factor="Vegetation Cover (inverse)",
            weight=WEIGHTS["vegetation"],
            value=f"{inp.vegetation_cover_pct}% cover → {components['vegetation']:.0f}/100 risk"
        ),
        ContributingFactor(
            factor="Historical Slides (5yr)",
            weight=WEIGHTS["history"],
            value=f"{inp.historical_slides} recorded events"
        ),
    ]
    # Sort by contribution (weight × component score) descending
    factors.sort(
        key=lambda f: f.weight * {
            "24-hour Rainfall": components["rainfall"],
            "Soil Moisture": components["soil"],
            "Slope Angle": components["slope"],
            "Vegetation Cover (inverse)": components["vegetation"],
            "Historical Slides (5yr)": components["history"],
        }.get(f.factor, 0),
        reverse=True
    )
    return factors


def predict(inp: RiskInput) -> RiskPrediction:
    """Main prediction entry point."""
    result = compute_risk_score(inp)
    risk_level, prob = classify_risk(result["risk_score"])
    factors = build_contributing_factors(inp, result["components"])

    return RiskPrediction(
        zone_id=inp.zone_id,
        zone_name=inp.zone_name,
        risk_score=result["risk_score"],
        risk_level=risk_level,
        probability_24h=prob,
        contributing_factors=factors,
        prediction_timestamp=datetime.now(timezone.utc).isoformat(),
        simulated=True,
    )
