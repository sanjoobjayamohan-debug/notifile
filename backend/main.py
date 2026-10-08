from __future__ import annotations

import asyncio
import os
import threading
from io import BytesIO
from logging import getLogger
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image
from pydantic import ValidationError

from pdf_editor import PdfEditRequest, edit_pdf, extract_pdf_text

logger = getLogger(__name__)
_rembg_session_lock = threading.Lock()
_rembg_session: Any | None = None

app = FastAPI(title="Notifile File API", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "NOTIFILE_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://localhost:3100,http://localhost:3200,"
        "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3100,http://127.0.0.1:3200",
    ).split(",")
    if origin.strip()
]
allowed_origin_regex = os.getenv("NOTIFILE_ALLOWED_ORIGIN_REGEX") or None
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _remove_background_with_rembg(image_bytes: bytes) -> bytes:
    global _rembg_session
    from rembg import new_session, remove

    if _rembg_session is None:
        with _rembg_session_lock:
            if _rembg_session is None:
                _rembg_session = new_session("u2net")
    return remove(image_bytes, session=_rembg_session)


@app.post("/api/image/remove-background")
async def remove_image_background(file: UploadFile = File(...)) -> Response:
    image_bytes = await file.read()
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image.verify()
    except (OSError, ValueError) as error:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.") from error

    try:
        result = await asyncio.to_thread(_remove_background_with_rembg, image_bytes)
    except Exception as error:
        logger.exception("rembg image background removal failed")
        raise HTTPException(
            status_code=502,
            detail=f"rembg background removal failed: {error}",
        ) from error
    return Response(content=result, media_type="image/png")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/pdf/fonts")
def list_pdf_fonts() -> dict[str, object]:
    from pdf_editor import _font_manifest

    return {"fonts": _font_manifest()}


@app.post("/api/pdf/extract")
async def extract_pdf(file: UploadFile = File(...), language: str = "eng", dpi: int = 150) -> dict[str, object]:
    from pdf_editor import MAX_PDF_BYTES

    pdf_bytes = await file.read(MAX_PDF_BYTES + 1)
    return await asyncio.to_thread(extract_pdf_text, pdf_bytes, language, dpi)


@app.post("/api/pdf/edit")
async def edit_pdf_endpoint(
    file: UploadFile = File(...),
    edits_json: str = Form(...),
) -> Response:
    pdf_bytes = await file.read(100 * 1024 * 1024 + 1)
    try:
        payload = PdfEditRequest.model_validate_json(edits_json)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    output = await asyncio.to_thread(edit_pdf, pdf_bytes, payload)
    return Response(
        content=output,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="edited.pdf"'},
    )
