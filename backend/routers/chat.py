from fastapi import APIRouter
from ml.feature_schema import ChatRequest, ChatResponse
from services.chat_service import get_response

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    AI emergency assistant — English and Kannada.
    Uses Gemini API if configured, else rule-based fallback.
    Never invents emergency numbers or live conditions.
    """
    response_text = get_response(
        message=req.message,
        language=req.language,
        zone_id=req.zone_id,
    )
    return ChatResponse(response=response_text, language=req.language)
