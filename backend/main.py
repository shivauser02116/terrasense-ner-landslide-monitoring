from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from firebase_admin_setup import init_firebase
from routers import predict, zones, alerts, field_reports, sync, chat

# Initialize Firebase on startup
init_firebase()

app = FastAPI(
    title="NER Landslide Early Warning System — Backend API",
    description=(
        "AI-Based Early Warning and Landslide Risk Monitoring System for North East India (NER). "
        "PROTOTYPE — All predictions are simulated unless otherwise stated."
    ),
    version="1.0.0-prototype",
    docs_url="/docs",
    redoc_url="/redoc",
)

cors_origins = settings.cors_origins_list
allow_all = "*" in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if not allow_all else ["*"],
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(predict.router)
app.include_router(zones.router)
app.include_router(alerts.router)
app.include_router(field_reports.router)
app.include_router(sync.router)
app.include_router(chat.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "NER Landslide Early Warning API",
        "version": "1.0.0-prototype",
        "gemini_configured": settings.gemini_configured,
        "twilio_configured": settings.twilio_configured,
        "environment": settings.app_env,
    }


@app.get("/")
async def root():
    return {
        "message": "NER Landslide Early Warning System API",
        "docs": "/docs",
        "health": "/health",
        "prototype_disclaimer": "All predictions are SIMULATED. Not for operational use.",
    }
