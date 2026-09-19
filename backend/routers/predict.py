from fastapi import APIRouter
from datetime import datetime, timezone

from ml.feature_schema import RiskInput, RiskPrediction
from ml.risk_engine import predict
from firebase_admin_setup import get_db
from services.alert_service import should_alert, create_alert

router = APIRouter(prefix="/api", tags=["prediction"])


@router.post("/predict-risk", response_model=RiskPrediction)
async def predict_risk(inp: RiskInput):
    """
    Compute landslide risk prediction for a zone.

    All outputs are SIMULATED using a domain-expert formula.
    Not a trained ML model. Not for operational emergency use.
    """
    prediction = predict(inp)

    # Persist prediction to Firestore
    db = get_db()
    if db:
        pred_dict = prediction.model_dump()
        db.collection("predictions").add(pred_dict)

        # Auto-generate alert if threshold exceeded
        if should_alert(prediction.risk_level):
            # Fetch zone name from Firestore if not provided
            zone_name = inp.zone_name or prediction.zone_id
            create_alert(
                zone_id=inp.zone_id,
                zone_name=zone_name,
                risk_level=prediction.risk_level,
                risk_score=prediction.risk_score,
                message=(
                    f"Risk score {prediction.risk_score}/100. "
                    f"24h probability: {prediction.probability_24h}%. "
                    f"Top factor: {prediction.contributing_factors[0].factor if prediction.contributing_factors else 'N/A'}"
                ),
            )

    return prediction
