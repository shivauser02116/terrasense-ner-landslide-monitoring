"""
Chat Service
============
Provides the AI assistant backed by Gemini API.
Falls back to a rule-based engine if no API key is configured.

Context injection: current zone risk data from Firestore is prepended
to every Gemini prompt so answers are grounded in actual system data.

Language: English ('en') and Kannada ('kn') supported.
The Gemini model is instructed to respond in the requested language.
"""
from typing import Optional

from config import settings
from firebase_admin_setup import get_db

SYSTEM_PROMPT = """
You are an emergency assistant for the NER (North East India) Landslide Early Warning System.
Your role is to:
1. Help field officers, emergency responders, and the public understand landslide risk.
2. Explain why a zone is classified as high-risk using environmental data provided.
3. Provide basic emergency guidance for landslide situations.
4. Retrieve and explain current alert information when relevant.

Strict rules:
- NEVER invent emergency phone numbers. Only use numbers explicitly provided in context.
- NEVER claim real-time data is live unless the system explicitly states it is.
- NEVER fabricate evacuation orders or casualty numbers.
- Always clarify that predictions are PROTOTYPE / SIMULATED.
- Respond in the language requested by the user (English or Kannada).
- Be concise, calm, and actionable.
"""

FALLBACK_RESPONSES = {
    "en": {
        "default": (
            "I am the NER Landslide Early Warning Assistant (prototype). "
            "I can help explain risk scores, environmental factors, and basic emergency guidance. "
            "For actual emergencies, call 112 immediately."
        ),
        "risk": (
            "The risk score is computed from rainfall, soil moisture, slope angle, vegetation cover, "
            "and historical landslide events. Scores above 60 indicate High risk; above 80 indicate Critical. "
            "All predictions are simulated — do not use for operational decisions."
        ),
        "emergency": (
            "In case of landslide: (1) Move away from the slope immediately. "
            "(2) Alert neighbours. (3) Call 112. (4) Do not re-enter affected area. "
            "Contact your State SDMA for evacuation assistance."
        ),
    },
    "kn": {
        "default": (
            "ನಾನು NER ಭೂಕುಸಿತ ಮುಂಚಿತ ಎಚ್ಚರಿಕೆ ಸಹಾಯಕ (ಪ್ರೋಟೋಟೈಪ್). "
            "ತುರ್ತು ಪರಿಸ್ಥಿತಿಗಳಲ್ಲಿ ತಕ್ಷಣ 112 ಗೆ ಕರೆ ಮಾಡಿ."
        ),
        "emergency": (
            "ಭೂಕುಸಿತ ಸಂದರ್ಭದಲ್ಲಿ: (1) ಇಳಿಜಾರಿನಿಂದ ದೂರ ಸರಿಯಿರಿ. "
            "(2) ನೆರೆಹೊರೆಯವರಿಗೆ ಎಚ್ಚರಿಸಿ. (3) 112 ಗೆ ಕರೆ ಮಾಡಿ."
        ),
    },
}


def _get_zone_context(zone_id: str) -> str:
    """Fetch zone data from Firestore to ground the LLM response."""
    db = get_db()
    if not db or not zone_id:
        return ""
    try:
        doc = db.collection("monitoring_zones").document(zone_id).get()
        if not doc.exists:
            return ""
        data = doc.to_dict()
        pred_docs = (
            db.collection("predictions")
            .where("zone_id", "==", zone_id)
            .order_by("prediction_timestamp", direction="DESCENDING")
            .limit(1)
            .stream()
        )
        pred_list = list(pred_docs)
        pred_str = ""
        if pred_list:
            p = pred_list[0].to_dict()
            pred_str = (
                f"Latest prediction: Risk score {p.get('risk_score')}/100, "
                f"Level: {p.get('risk_level')}, 24h probability: {p.get('probability_24h')}%"
            )
        return (
            f"Zone: {data.get('name')} ({data.get('state')})\n"
            f"Current risk level: {data.get('current_risk_level')}\n"
            f"Rainfall: {data.get('rainfall_mm')} mm/24h\n"
            f"Soil moisture: {data.get('soil_moisture_pct')}%\n"
            f"Slope angle: {data.get('slope_angle_deg')}°\n"
            f"Vegetation cover: {data.get('vegetation_cover_pct')}%\n"
            f"Historical slides (5yr): {data.get('historical_slides')}\n"
            f"{pred_str}"
        )
    except Exception as e:
        print(f"[Chat] Zone context fetch failed: {e}")
        return ""


def get_response(message: str, language: str = "en", zone_id: Optional[str] = None) -> str:
    """Get chatbot response. Uses Gemini if configured, else fallback."""
    if settings.gemini_configured:
        return _gemini_response(message, language, zone_id)
    return _fallback_response(message, language)


def _gemini_response(message: str, language: str, zone_id: Optional[str]) -> str:
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        zone_context = _get_zone_context(zone_id) if zone_id else ""
        lang_instruction = "Respond in Kannada (Kannada script)." if language == "kn" else "Respond in English."

        full_prompt = (
            f"{SYSTEM_PROMPT}\n\n"
            f"{lang_instruction}\n\n"
            + (f"Current zone data:\n{zone_context}\n\n" if zone_context else "")
            + f"User: {message}"
        )

        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        print(f"[Chat] Gemini error: {e}")
        return _fallback_response(message, language)


def _fallback_response(message: str, language: str) -> str:
    lang = language if language in FALLBACK_RESPONSES else "en"
    responses = FALLBACK_RESPONSES[lang]
    msg_lower = message.lower()
    if any(w in msg_lower for w in ["emergency", "evacuate", "evacuating", "danger", "help", "ಅಪಾಯ", "ಸಹಾಯ"]):
        return responses.get("emergency", responses["default"])
    if any(w in msg_lower for w in ["risk", "score", "predict", "probability", "how", "why", "ಅಪಾಯ", "ಅಂದಾಜು"]):
        return responses.get("risk", responses["default"])
    return responses["default"]
