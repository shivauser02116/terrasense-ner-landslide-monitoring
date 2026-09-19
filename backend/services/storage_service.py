"""
Firebase Storage Service
========================
Handles media upload for field reports.
Files are stored under: field-reports/{zone_id}/{report_id}/{filename}
"""
import uuid
from datetime import timedelta
from typing import Optional

from firebase_admin_setup import get_bucket

MAX_FILE_SIZE_MB = 50
ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/quicktime", "video/webm",
}


def validate_upload(content_type: str, size_bytes: int) -> None:
    if content_type not in ALLOWED_MIME_TYPES:
        raise ValueError(f"File type '{content_type}' not allowed. Allowed: {ALLOWED_MIME_TYPES}")
    max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    if size_bytes > max_bytes:
        raise ValueError(f"File size {size_bytes / 1024 / 1024:.1f} MB exceeds {MAX_FILE_SIZE_MB} MB limit")


def upload_media(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    zone_id: str,
    report_id: str,
) -> Optional[str]:
    """
    Upload file to Firebase Storage.
    Returns public download URL, or None if Storage not configured.
    """
    validate_upload(content_type, len(file_bytes))

    bucket = get_bucket()
    if not bucket:
        print("[Storage] Firebase Storage not configured — media upload skipped.")
        return None

    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    blob_name = f"field-reports/{zone_id}/{report_id}/{uuid.uuid4().hex}.{ext}"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(file_bytes, content_type=content_type)
    blob.make_public()
    return blob.public_url
