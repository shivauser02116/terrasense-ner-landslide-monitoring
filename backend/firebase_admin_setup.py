import base64
import json
import os
from functools import lru_cache

import firebase_admin
from firebase_admin import credentials, firestore, storage as fb_storage

from config import settings

_app_initialized = False

def init_firebase():
    global _app_initialized
    if _app_initialized or firebase_admin._DEFAULT_APP_NAME in firebase_admin._apps:
        return

    sa_dict = None

    if settings.firebase_service_account_json:
        # Cloud deployment: base64-encoded JSON in env var
        sa_json = base64.b64decode(settings.firebase_service_account_json).decode()
        sa_dict = json.loads(sa_json)
        cred = credentials.Certificate(sa_dict)
    elif settings.firebase_service_account_path and os.path.exists(settings.firebase_service_account_path):
        cred = credentials.Certificate(settings.firebase_service_account_path)
    else:
        print(
            "[WARNING] No Firebase service account configured. "
            "Firestore/Storage operations will fail. Set FIREBASE_SERVICE_ACCOUNT_PATH or "
            "FIREBASE_SERVICE_ACCOUNT_JSON in .env"
        )
        return

    bucket_name = f"{sa_dict['project_id']}.appspot.com" if sa_dict and "project_id" in sa_dict else None
    firebase_admin.initialize_app(cred, {
        "storageBucket": bucket_name
    })
    _app_initialized = True


def get_db():
    """Return Firestore client, or None if Firebase not configured."""
    try:
        return firestore.client()
    except Exception:
        return None


def get_bucket():
    """Return Firebase Storage bucket, or None if not configured."""
    try:
        return fb_storage.bucket()
    except Exception:
        return None
