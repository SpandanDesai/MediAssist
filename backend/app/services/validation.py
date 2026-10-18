"""Upload validation helpers for images and audio."""

from __future__ import annotations

import io

from fastapi import HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings

ALLOWED_AUDIO_SUFFIXES = (".webm", ".wav", ".mp3", ".m4a", ".ogg", ".mp4")
ALLOWED_AUDIO_TYPES = {
    "audio/webm",
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/ogg",
    "video/webm",
    "application/octet-stream",
}


async def read_upload(file: UploadFile, *, max_bytes: int | None = None) -> bytes:
    settings = get_settings()
    limit = max_bytes or settings.max_upload_size_bytes
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if len(data) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {limit // (1024 * 1024)} MB.",
        )
    return data


def _sanitize_image(data: bytes) -> tuple[bytes, str]:
    """Decode, verify, and re-encode an upload off the event loop (CPU-bound).

    Raises HTTPException on any invalid/non-PNG/JPEG payload so the calling
    route surfaces a 400 exactly as before.
    """
    try:
        from PIL import Image, ImageOps

        # First verify structure
        with Image.open(io.BytesIO(data)) as image:
            fmt = (image.format or "").upper()
            if fmt not in {"PNG", "JPEG", "JPG"}:
                raise ValueError("unsupported image format")

        # Open and re-encode to strip EXIF, metadata, and malformed payload bytes
        with Image.open(io.BytesIO(data)) as image:
            # Transpose orientation if EXIF tag exists so rotation is preserved when EXIF is stripped
            clean_image = ImageOps.exif_transpose(image)
            out_buf = io.BytesIO()
            if fmt == "PNG":
                clean_image.save(out_buf, format="PNG", optimize=True)
                mime = "image/png"
            else:
                if clean_image.mode in ("RGBA", "P"):
                    clean_image = clean_image.convert("RGB")
                clean_image.save(out_buf, format="JPEG", quality=90, optimize=True)
                mime = "image/jpeg"
            sanitized_data = out_buf.getvalue()

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is not a valid PNG or JPEG image.",
        ) from exc

    return sanitized_data, mime


async def validate_image_upload(file: UploadFile) -> tuple[bytes, str]:
    content_type = (file.content_type or "").lower()
    filename = (file.filename or "").lower()
    if content_type not in {"image/png", "image/jpeg", "image/jpg"} and not filename.endswith((".png", ".jpg", ".jpeg")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PNG and JPEG images are supported.")

    data = await read_upload(file)
    return await run_in_threadpool(_sanitize_image, data)


async def validate_audio_upload(file: UploadFile) -> tuple[bytes, str]:
    content_type = (file.content_type or "application/octet-stream").lower()
    filename = (file.filename or "audio.webm").lower()
    if content_type not in ALLOWED_AUDIO_TYPES and not filename.endswith(ALLOWED_AUDIO_SUFFIXES):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported audio format.")
    data = await read_upload(file)
    return data, filename
