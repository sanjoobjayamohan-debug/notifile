from __future__ import annotations

import json
import logging
import math
import re
from collections import defaultdict
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
import pymupdf as fitz
import pytesseract
from fastapi import HTTPException
from pdf2image import convert_from_bytes
from pdf2image.exceptions import PDFInfoNotInstalledError, PDFPageCountError
from PIL import Image
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
FONT_MANIFEST_PATH = Path(__file__).resolve().parent.parent / "public" / "fonts" / "manifest.json"
MAX_PDF_BYTES = 100 * 1024 * 1024
MAX_PDF_PAGES = 200


class PdfSpanStyle(BaseModel):
    text: str = Field(min_length=0, max_length=5000)
    font_id: str
    font_size: float = Field(ge=4, le=144)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    bold: bool = False
    italic: bool = False
    original_font: str | None = None
    opacity: float = Field(default=1, ge=0, le=1)
    ascender: float = 1.075
    descender: float = -0.299


class PdfEdit(BaseModel):
    page: int = Field(ge=1, le=MAX_PDF_PAGES)
    bbox: list[float] = Field(min_length=4, max_length=4)
    text: str = Field(min_length=0, max_length=5000)
    font_id: str
    font_size: float = Field(ge=4, le=144)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    bold: bool = False
    italic: bool = False
    layout_bbox: list[float] | None = Field(default=None, min_length=4, max_length=4)
    source: Literal["native", "ocr", "insert"] = "native"
    baseline: list[float] | None = Field(default=None, min_length=2, max_length=2)
    original_font: str | None = None
    preserve_original_font: bool = False
    rotation: float = Field(default=0, ge=-360, le=360)
    alignment: Literal["left", "center", "right"] = "left"
    opacity: float = Field(default=1, ge=0, le=1)
    ascender: float = 1.075
    descender: float = -0.299
    span_styles: list[PdfSpanStyle] = Field(default_factory=list, max_length=100)
    preserve_span_styles: bool = True


class PdfEditRequest(BaseModel):
    edits: list[PdfEdit] = Field(min_length=1, max_length=1000)


@dataclass(frozen=True)
class _ResolvedFont:
    alias: str
    metrics: fitz.Font
    embedded: bool
    source_name: str
    font_buffer: bytes | None = None
    font_file: Path | None = None


def _font_manifest() -> list[dict[str, str]]:
    try:
        manifest = json.loads(FONT_MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        logger.exception("Could not load bundled font manifest")
        raise HTTPException(status_code=500, detail="The bundled font manifest is unavailable.") from error

    fonts: list[dict[str, str]] = []
    for font in manifest.get("fonts", []):
        font_path = (FONT_MANIFEST_PATH.parent / font["file"]).resolve()
        if not font_path.is_relative_to(FONT_MANIFEST_PATH.parent.resolve()) or not font_path.is_file():
            logger.error("Bundled font asset is missing or outside the font directory: %s", font["id"])
            raise HTTPException(status_code=500, detail=f"Bundled font asset is missing: {font['family']}.")
        fonts.append(
            {
                "id": font["id"],
                "family": font["family"],
                "file": f"/fonts/{font['file']}",
                "license": f"/fonts/{font['license']}",
            }
        )
    if len(fonts) < 50:
        raise HTTPException(status_code=500, detail="At least 50 bundled font families are required.")
    return fonts


def _open_document(pdf_bytes: bytes) -> fitz.Document:
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF files must be 100 MB or smaller.")
    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")
    try:
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
    except (fitz.FileDataError, RuntimeError) as error:
        raise HTTPException(status_code=400, detail="The uploaded file is not a readable PDF.") from error
    if document.needs_pass:
        document.close()
        raise HTTPException(status_code=400, detail="Password-protected PDFs are not supported by this editor.")
    if document.page_count > MAX_PDF_PAGES:
        document.close()
        raise HTTPException(status_code=413, detail=f"PDF files are limited to {MAX_PDF_PAGES} pages.")
    return document


def _hex_color(rgb: int) -> str:
    return f"#{(rgb >> 16) & 255:02x}{(rgb >> 8) & 255:02x}{rgb & 255:02x}"


def _infer_block_alignment(line_rects: list[fitz.Rect]) -> Literal["left", "center", "right"]:
    if len(line_rects) < 2:
        return "left"
    tolerance = 2.0
    lefts = [rect.x0 for rect in line_rects]
    rights = [rect.x1 for rect in line_rects]
    centers = [(rect.x0 + rect.x1) / 2 for rect in line_rects]
    if max(centers) - min(centers) <= tolerance and max(lefts) - min(lefts) > tolerance:
        return "center"
    if max(rights) - min(rights) <= tolerance and max(lefts) - min(lefts) > tolerance:
        return "right"
    return "left"


def _infer_line_alignment(
    index: int,
    records: list[dict[str, object]],
) -> tuple[Literal["left", "center", "right"], fitz.Rect]:
    target = records[index]
    target_rect = fitz.Rect(target["bbox"])
    block_rect = fitz.Rect(target["block_bbox"])
    same_block = [
        fitz.Rect(record["bbox"])
        for record in records
        if record["block_index"] == target["block_index"]
    ]
    alignment = _infer_block_alignment(same_block)
    if alignment != "left":
        return alignment, block_rect

    line = target["line"]
    target_spans = target["spans"]
    target_span = target_spans[0]
    direction = line.get("dir", (1, 0))
    if abs(float(direction[1])) > 0.01:
        return "left", block_rect
    baseline_y = float(target_span["origin"][1])
    font_size = float(target_span["size"])
    aligned_peers: list[fitz.Rect] = []
    pair_alignments: set[str] = set()

    for peer_index, peer in enumerate(records):
        if peer_index == index:
            continue
        peer_line = peer["line"]
        peer_spans = peer["spans"]
        peer_span = peer_spans[0]
        peer_direction = peer_line.get("dir", (1, 0))
        if abs(float(peer_direction[1])) > 0.01:
            continue
        if (
            peer_span["font"] != target_span["font"]
            or int(peer_span["color"]) != int(target_span["color"])
            or abs(float(peer_span["size"]) - font_size) > 0.5
        ):
            continue
        baseline_delta = abs(float(peer_span["origin"][1]) - baseline_y)
        if baseline_delta < font_size * 0.8 or baseline_delta > font_size * 2.5:
            continue
        peer_rect = fitz.Rect(peer["bbox"])
        left_delta = abs(peer_rect.x0 - target_rect.x0)
        right_delta = abs(peer_rect.x1 - target_rect.x1)
        center_delta = abs((peer_rect.x0 + peer_rect.x1 - target_rect.x0 - target_rect.x1) / 2)
        if center_delta <= 2 and left_delta > 2:
            pair_alignments.add("center")
        elif right_delta <= 2 and left_delta > 2:
            pair_alignments.add("right")
        elif left_delta <= 2:
            pair_alignments.add("left")
        if center_delta <= 2 or right_delta <= 2 or left_delta <= 2:
            aligned_peers.append(peer_rect)

    if "center" in pair_alignments:
        alignment = "center"
    elif "right" in pair_alignments:
        alignment = "right"
    else:
        return "left", block_rect
    for peer_rect in aligned_peers:
        block_rect |= peer_rect
    return alignment, block_rect


def _native_text(page: fitz.Page, page_number: int) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    blocks = page.get_text("dict", sort=True)["blocks"]
    for block_index, block in enumerate(blocks):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = [
                span
                for span in line.get("spans", [])
                if span["text"].strip()
                and span["bbox"][2] > span["bbox"][0]
                and span["bbox"][3] > span["bbox"][1]
            ]
            if not spans:
                continue
            bbox = fitz.Rect(spans[0]["bbox"])
            for span in spans[1:]:
                bbox |= fitz.Rect(span["bbox"])
            records.append({
                "line": line,
                "spans": spans,
                "bbox": bbox,
                "block_bbox": block["bbox"],
                "block_index": block_index,
            })

    items: list[dict[str, object]] = []
    for index, record in enumerate(records):
        line = record["line"]
        spans = record["spans"]
        bbox = fitz.Rect(record["bbox"])
        font, font_size, color = max(
            (
                (span["font"], round(float(span["size"]), 1), int(span["color"]))
                for span in spans
            ),
            key=lambda style: sum(
                len(span["text"].strip())
                for span in spans
                if (span["font"], round(float(span["size"]), 1), int(span["color"])) == style
            ),
        )
        style_span = max(spans, key=lambda span: len(span["text"].strip()))
        flags = int(style_span.get("flags", 0))
        direction = line.get("dir", (1, 0))
        rotation = math.degrees(math.atan2(-float(direction[1]), float(direction[0]))) % 360
        first_origin = spans[0]["origin"]
        alignment, layout_bbox = _infer_line_alignment(index, records)
        items.append({
            "id": f"p{page_number}-n{len(items)}",
            "page": page_number,
            "text": "".join(span["text"] for span in spans).strip(),
            "bbox": [round(value, 2) for value in bbox],
            "layout_bbox": [round(value, 2) for value in layout_bbox],
            "source": "native",
            "font": font,
            "font_id": _font_id_for_name(font),
            "font_size": font_size,
            "color": _hex_color(color),
            "baseline": [round(float(value), 2) for value in first_origin],
            "rotation": round(rotation, 2),
            "alignment": alignment,
            "opacity": round(float(style_span.get("alpha", 255)) / 255, 3),
            "ascender": round(float(style_span.get("ascender", 1.0)), 4),
            "descender": round(float(style_span.get("descender", -0.25)), 4),
            "bold": bool(flags & 16),
            "italic": bool(flags & 2),
            "confidence": 100,
            "spans": [
                {
                    "text": span["text"],
                    "bbox": [round(float(value), 2) for value in span["bbox"]],
                    "baseline": [round(float(value), 2) for value in span["origin"]],
                    "font": span["font"],
                    "font_id": _font_id_for_name(span["font"]),
                    "font_size": round(float(span["size"]), 2),
                    "color": _hex_color(int(span["color"])),
                    "original_font": span["font"],
                    "opacity": round(float(span.get("alpha", 255)) / 255, 3),
                    "ascender": round(float(span.get("ascender", 1.0)), 4),
                    "descender": round(float(span.get("descender", -0.25)), 4),
                    "bold": bool(int(span.get("flags", 0)) & 16),
                    "italic": bool(int(span.get("flags", 0)) & 2),
                }
                for span in spans
            ],
        })
    return items


def _font_id_for_name(font_name: str) -> str:
    font_name = re.sub(r"^[A-Z]{6}\+", "", font_name)
    normalized = re.sub(r"[^a-z0-9]", "", font_name.casefold())
    aliases = {
        "arial": "arimo",
        "arialmt": "arimo",
        "helvetica": "arimo",
        "liberationsans": "arimo",
        "dejavusans": "arimo",
        "times": "sourceserif4",
        "timesnewroman": "sourceserif4",
        "timesnewromanps": "sourceserif4",
        "liberationserif": "sourceserif4",
        "courier": "cousine",
        "couriernew": "cousine",
        "liberationmono": "cousine",
        "dejavusansmono": "firacode",
        "calibri": "carlito",
        "cambria": "caladea",
    }
    for key, font_id in aliases.items():
        if normalized.startswith(key):
            return font_id
    for font in _font_manifest_unchecked():
        family = re.sub(r"[^a-z0-9]", "", font["family"].casefold())
        if normalized.startswith(family):
            return font["id"]
    return "arimo"


def _font_manifest_unchecked() -> list[dict[str, str]]:
    try:
        return json.loads(FONT_MANIFEST_PATH.read_text(encoding="utf-8"))["fonts"]
    except (OSError, json.JSONDecodeError, KeyError) as error:
        logger.exception("Could not read bundled font mapping")
        raise HTTPException(status_code=500, detail="The bundled font mapping is unavailable.") from error


def _embedded_original_font(document: fitz.Document, page: fitz.Page, font_name: str | None) -> bytes | None:
    if not font_name:
        return None
    requested_name = re.sub(r"^[A-Z]{6}\+", "", font_name)
    requested = re.sub(r"[^a-z0-9]", "", requested_name.casefold())
    for font in page.get_fonts(full=True):
        base_font_name = re.sub(r"^[A-Z]{6}\+", "", str(font[3]))
        base_name = re.sub(r"[^a-z0-9]", "", base_font_name.casefold())
        resource_name = re.sub(r"[^a-z0-9]", "", str(font[4]).casefold())
        if requested not in (base_name, resource_name) and not base_name.endswith(requested):
            continue
        try:
            extracted = document.extract_font(font[0])[3]
        except (RuntimeError, ValueError):
            logger.info("Original PDF font %s could not be extracted", font_name)
            continue
        if extracted:
            return extracted
    return None


def _render_page(pdf_bytes: bytes, page: fitz.Page, page_number: int, dpi: int) -> Image.Image:
    try:
        pages = convert_from_bytes(
            pdf_bytes,
            dpi=dpi,
            first_page=page_number,
            last_page=page_number,
            fmt="png",
            thread_count=1,
            timeout=120,
        )
        if not pages:
            raise HTTPException(status_code=422, detail=f"Could not render PDF page {page_number} for OCR.")
        return pages[0].convert("RGB")
    except (PDFInfoNotInstalledError, PDFPageCountError) as error:
        logger.info("Poppler is unavailable; rendering page %s with PyMuPDF instead: %s", page_number, error)
        scale = dpi / 72
        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        return Image.open(BytesIO(pixmap.tobytes("png"))).convert("RGB")


def _ocr_page(
    image: Image.Image,
    page: fitz.Page,
    page_number: int,
    language: str,
    region: fitz.Rect | None = None,
) -> list[dict[str, object]]:
    try:
        data = pytesseract.image_to_data(image, lang=language, output_type=pytesseract.Output.DICT)
    except pytesseract.TesseractNotFoundError as error:
        raise HTTPException(status_code=503, detail="Tesseract is not installed or is not available on PATH.") from error
    except pytesseract.TesseractError as error:
        raise HTTPException(
            status_code=422,
            detail=f"Tesseract OCR failed for language “{language}”: {error}",
        ) from error

    page_rect = region or page.rect
    scale_x = page_rect.width / image.width
    scale_y = page_rect.height / image.height
    lines: dict[tuple[int, int, int], list[tuple[str, float, float, float, float, float]]] = defaultdict(list)
    for index, word in enumerate(data["text"]):
        text = str(word).strip()
        if not text:
            continue
        try:
            confidence = float(data["conf"][index])
        except (TypeError, ValueError):
            continue
        if confidence < 5:
            continue
        left = float(data["left"][index])
        top = float(data["top"][index])
        right = left + float(data["width"][index])
        bottom = top + float(data["height"][index])
        key = (
            int(data["block_num"][index]),
            int(data["par_num"][index]),
            int(data["line_num"][index]),
        )
        lines[key].append((text, confidence, left, top, right, bottom))

    items: list[dict[str, object]] = []
    for (_block_num, _par_num, _line_num), words in lines.items():
        words.sort(key=lambda word: word[2])
        x0 = min(word[2] for word in words) * scale_x + page_rect.x0
        y0 = min(word[3] for word in words) * scale_y + page_rect.y0
        x1 = max(word[4] for word in words) * scale_x + page_rect.x0
        y1 = max(word[5] for word in words) * scale_y + page_rect.y0
        items.append({
            "id": f"p{page_number}-o{len(items)}",
            "page": page_number,
            "text": " ".join(word[0] for word in words),
            "bbox": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
            "source": "ocr",
            "font": "Tesseract OCR",
            "font_id": "arimo",
            "font_size": round(y1 - y0, 2),
            "color": "#000000",
            "bold": False,
            "italic": False,
            "confidence": round(sum(word[1] for word in words) / len(words)),
        })
    return items


def _image_regions(page: fitz.Page) -> list[fitz.Rect]:
    regions: list[fitz.Rect] = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 1:
            continue
        rect = fitz.Rect(block["bbox"]) & page.rect
        if rect.width < 24 or rect.height < 16:
            continue
        for index, existing in enumerate(regions):
            if existing.intersects(rect):
                regions[index] = existing | rect
                break
        else:
            regions.append(rect)
    return regions


def _ocr_region_from_page_image(image: Image.Image, page: fitz.Page, region: fitz.Rect) -> Image.Image:
    page_rect = page.rect
    left = round((region.x0 - page_rect.x0) * image.width / page_rect.width)
    top = round((region.y0 - page_rect.y0) * image.height / page_rect.height)
    right = round((region.x1 - page_rect.x0) * image.width / page_rect.width)
    bottom = round((region.y1 - page_rect.y0) * image.height / page_rect.height)
    return image.crop((left, top, right, bottom))


def _overlaps_native_text(ocr_item: dict[str, object], native: list[dict[str, object]]) -> bool:
    ocr_rect = fitz.Rect(ocr_item["bbox"])
    for item in native:
        native_rect = fitz.Rect(item["bbox"])
        overlap = ocr_rect & native_rect
        if not overlap.is_empty and overlap.get_area() / max(ocr_rect.get_area(), 1) >= 0.3:
            return True
    return False


def extract_pdf_text(pdf_bytes: bytes, language: str = "eng", dpi: int = 150) -> dict[str, object]:
    if not re.fullmatch(r"[a-zA-Z0-9_+-]{2,20}", language):
        raise HTTPException(status_code=422, detail="The OCR language code is invalid.")
    if dpi < 100 or dpi > 400:
        raise HTTPException(status_code=422, detail="OCR resolution must be between 100 and 400 DPI.")
    document = _open_document(pdf_bytes)
    pages: list[dict[str, object]] = []
    try:
        for index, page in enumerate(document, start=1):
            native = _native_text(page, index)
            image_regions = _image_regions(page) if native else []
            ocr_used = not native or bool(image_regions)
            ocr: list[dict[str, object]] = []
            if ocr_used:
                image = _render_page(pdf_bytes, page, index, dpi)
                regions = image_regions or [page.rect]
                for region in regions:
                    region_image = _ocr_region_from_page_image(image, page, region) if image_regions else image
                    ocr.extend(
                        item
                        for item in _ocr_page(region_image, page, index, language, region if image_regions else None)
                        if not _overlaps_native_text(item, native)
                    )
            pages.append(
                {
                    "page": index,
                    "width": round(page.rect.width, 2),
                    "height": round(page.rect.height, 2),
                    "items": native + ocr,
                    "ocr_used": ocr_used,
                }
            )
    finally:
        document.close()
    return {"page_count": len(pages), "pages": pages}


def _parse_color(color: str) -> tuple[float, float, float]:
    return tuple(int(color[index : index + 2], 16) / 255 for index in (1, 3, 5))  # type: ignore[return-value]


def _validate_bbox(page: fitz.Page, bbox: list[float]) -> fitz.Rect:
    rect = fitz.Rect(bbox)
    if not all(math.isfinite(value) for value in bbox):
        raise HTTPException(status_code=422, detail="Text coordinates must be finite numbers.")
    if rect.is_empty or rect.is_infinite:
        raise HTTPException(status_code=422, detail="Text coordinates must describe a non-empty box.")
    clipped = rect & page.rect
    if clipped.is_empty:
        raise HTTPException(status_code=422, detail="Text coordinates must overlap the selected page.")
    return clipped


def _background_patch_rect(page: fitz.Page, rect: fitz.Rect, padding: float = 8) -> fitz.Rect:
    return fitz.Rect(
        rect.x0 - padding,
        rect.y0 - padding,
        rect.x1 + padding,
        rect.y1 + padding,
    ) & page.rect


def _inpaint_background(page: fitz.Page, rect: fitz.Rect) -> bytes:
    scale = 3
    padded = _background_patch_rect(page, rect)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=padded, alpha=False, annots=False)
    pixels = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(pixmap.height, pixmap.width, pixmap.n)[..., :3].copy()
    mask = np.zeros((pixmap.height, pixmap.width), dtype=np.uint8)
    x0 = max(0, round((rect.x0 - padded.x0) * scale))
    y0 = max(0, round((rect.y0 - padded.y0) * scale))
    x1 = min(pixmap.width, round((rect.x1 - padded.x0) * scale))
    y1 = min(pixmap.height, round((rect.y1 - padded.y0) * scale))
    mask[y0:y1, x0:x1] = 255
    filled = cv2.inpaint(pixels, mask, 6, cv2.INPAINT_TELEA)
    outside = cv2.distanceTransform(cv2.bitwise_not(mask), cv2.DIST_L2, 3)
    feather = max(1, round(scale * 8))
    fade = np.clip(outside / feather, 0, 1)
    alpha = np.where(mask > 0, 255, np.round(255 * (1 - (fade * fade * (3 - 2 * fade))))).astype(np.uint8)
    output = BytesIO()
    Image.fromarray(np.dstack((filled, alpha)), mode="RGBA").save(output, format="PNG")
    return output.getvalue()


def _font_request_key(style: PdfSpanStyle, preserve_original_font: bool) -> str:
    if preserve_original_font and style.original_font:
        return f"original:{style.original_font}"
    return f"bundled:{style.font_id}"


def _edit_styles(edit: PdfEdit) -> list[PdfSpanStyle]:
    if edit.preserve_span_styles and edit.span_styles:
        return edit.span_styles
    return [
        PdfSpanStyle(
            text=edit.text,
            font_id=edit.font_id,
            font_size=edit.font_size,
            color=edit.color,
            bold=edit.bold,
            italic=edit.italic,
            original_font=edit.original_font,
            opacity=edit.opacity,
            ascender=edit.ascender,
            descender=edit.descender,
        )
    ]


def _font_supports_text(font: fitz.Font, text: str) -> bool:
    try:
        return all(character.isspace() or font.has_glyph(ord(character)) != 0 for character in text)
    except (RuntimeError, ValueError):
        return False


def _resolve_edit_fonts(
    document: fitz.Document,
    page: fitz.Page,
    edit: PdfEdit,
    font_files: dict[str, Path],
    page_font_cache: dict[str, _ResolvedFont],
) -> dict[str, _ResolvedFont]:
    resolved: dict[str, _ResolvedFont] = {}
    for style in _edit_styles(edit):
        request_key = _font_request_key(style, edit.preserve_original_font)
        if request_key in resolved:
            continue
        font_resource: _ResolvedFont | None = None
        if edit.preserve_original_font and style.original_font:
            cache_key = f"original:{style.original_font}"
            font_data = _embedded_original_font(document, page, style.original_font)
            if font_data:
                try:
                    original_metrics = fitz.Font(fontbuffer=font_data)
                    if not _font_supports_text(original_metrics, edit.text):
                        logger.info(
                            "Embedded font %s lacks glyphs required by replacement text on page %s",
                            style.original_font,
                            edit.page,
                        )
                    else:
                        font_resource = page_font_cache.get(cache_key)
                        if font_resource is None:
                            alias = f"notifile_embedded_{len(page_font_cache)}"
                            font_resource = _ResolvedFont(
                                alias=alias,
                                metrics=original_metrics,
                                embedded=True,
                                source_name=style.original_font,
                                font_buffer=font_data,
                            )
                            page_font_cache[cache_key] = font_resource
                except (RuntimeError, ValueError, TypeError) as error:
                    logger.warning(
                        "Could not reuse embedded font %s for page %s; using a bundled fallback: %s",
                        style.original_font,
                        edit.page,
                        error,
                    )
            if font_resource is None:
                logger.info(
                    "Using bundled font %s instead of unavailable original font %s on page %s",
                    style.font_id,
                    style.original_font,
                    edit.page,
                )
        if font_resource is None:
            cache_key = f"bundled:{style.font_id}"
            font_resource = page_font_cache.get(cache_key)
            if font_resource is None:
                font_path = font_files[style.font_id]
                metrics = fitz.Font(fontfile=str(font_path))
                alias = f"notifile_{style.font_id}"
                font_resource = _ResolvedFont(
                    alias=alias,
                    metrics=metrics,
                    embedded=False,
                    source_name=style.font_id,
                    font_file=font_path,
                )
                page_font_cache[cache_key] = font_resource
        resolved[request_key] = font_resource
        logger.info(
            "PDF edit font resolution page=%s original=%s embedded=%s final=%s",
            edit.page,
            style.original_font or "(not supplied)",
            font_resource.embedded,
            font_resource.source_name,
        )
    return resolved


def _register_edit_fonts(
    page: fitz.Page,
    edit: PdfEdit,
    font_resources: dict[str, _ResolvedFont],
    font_files: dict[str, Path],
) -> None:
    registered: set[str] = set()
    for style in _edit_styles(edit):
        request_key = _font_request_key(style, edit.preserve_original_font)
        resource = font_resources[request_key]
        if resource.alias in registered:
            continue
        try:
            if resource.font_buffer is not None:
                page.insert_font(fontname=resource.alias, fontbuffer=resource.font_buffer)
            elif resource.font_file is not None:
                page.insert_font(fontname=resource.alias, fontfile=str(resource.font_file))
            else:
                raise RuntimeError(f"No font data was retained for {resource.source_name}.")
        except Exception as error:
            if resource.embedded:
                logger.warning(
                    "Embedded font %s could not be registered after redaction on page %s; falling back to %s: %s",
                    resource.source_name,
                    edit.page,
                    style.font_id,
                    error,
                )
                fallback_path = font_files[style.font_id]
                fallback_alias = f"notifile_{style.font_id}"
                try:
                    page.insert_font(fontname=fallback_alias, fontfile=str(fallback_path))
                    fallback = _ResolvedFont(
                        alias=fallback_alias,
                        metrics=fitz.Font(fontfile=str(fallback_path)),
                        embedded=False,
                        source_name=style.font_id,
                        font_file=fallback_path,
                    )
                except Exception as fallback_error:
                    logger.exception("Could not register bundled fallback font %s", style.font_id)
                    raise HTTPException(
                        status_code=500,
                        detail=f"The bundled font {style.font_id} could not be loaded.",
                    ) from fallback_error
                font_resources[request_key] = fallback
                registered.add(fallback.alias)
            else:
                logger.exception("Could not register bundled font %s", resource.source_name)
                raise HTTPException(
                    status_code=500,
                    detail=f"The bundled font {resource.source_name} could not be loaded.",
                ) from error
        else:
            registered.add(resource.alias)


def _wrapped_styled_runs(
    edit: PdfEdit,
    font_resources: dict[str, _ResolvedFont],
    max_width: float,
    font_scale: float = 1,
) -> list[list[tuple[str, PdfSpanStyle]]] | None:
    if edit.preserve_span_styles and edit.span_styles:
        base_styles = edit.span_styles
        total_weight = sum(max(1, len(style.text.strip())) for style in base_styles)
        boundaries: list[float] = []
        accumulated = 0
        for style in base_styles:
            accumulated += max(1, len(style.text.strip()))
            boundaries.append(accumulated / total_weight)
    else:
        base_styles = [
            PdfSpanStyle(
                text=edit.text,
                font_id=edit.font_id,
                font_size=edit.font_size,
                color=edit.color,
                bold=edit.bold,
                italic=edit.italic,
                original_font=edit.original_font,
                opacity=edit.opacity,
                ascender=edit.ascender,
                descender=edit.descender,
            )
        ]
        boundaries = [1.0]

    styles = [
        style.model_copy(update={"font_size": style.font_size * font_scale})
        for style in base_styles
    ]
    lines: list[list[tuple[str, PdfSpanStyle]]] = []
    character_offset = 0
    for paragraph in edit.text.split("\n"):
        tokens = re.findall(r"\S+\s*|\s+", paragraph)
        current: list[tuple[str, PdfSpanStyle]] = []
        current_width = 0.0
        for token in tokens:
            original_token_length = len(token)
            if not current and token.isspace():
                character_offset += original_token_length
                continue
            midpoint = (character_offset + original_token_length / 2) / max(1, len(edit.text))
            style_index = next(
                (index for index, boundary in enumerate(boundaries) if midpoint <= boundary),
                len(styles) - 1,
            )
            style = styles[style_index]
            font_key = _font_request_key(style, edit.preserve_original_font)
            token_width = font_resources[font_key].metrics.text_length(token, fontsize=style.font_size)
            if current and current_width + token_width > max_width:
                current[-1] = (current[-1][0].rstrip(), current[-1][1])
                lines.append(current)
                current = []
                current_width = 0
                token = token.lstrip()
                token_width = font_resources[font_key].metrics.text_length(token, fontsize=style.font_size)
            if token_width > max_width:
                return None
            current.append((token, style))
            current_width += token_width
            character_offset += original_token_length
        lines.append(current)
    return lines


def _projected_bounds(rect: fitz.Rect, axis: tuple[float, float]) -> tuple[float, float]:
    projections = [
        x * axis[0] + y * axis[1]
        for x, y in (
            (rect.x0, rect.y0),
            (rect.x0, rect.y1),
            (rect.x1, rect.y0),
            (rect.x1, rect.y1),
        )
    ]
    return min(projections), max(projections)


def _text_layout_limits(
    page: fitz.Page,
    edit: PdfEdit,
    rect: fitz.Rect,
    baseline: fitz.Point,
    native_items: list[dict[str, object]],
) -> tuple[float, float, float]:
    angle = math.radians(edit.rotation)
    direction = (math.cos(angle), -math.sin(angle))
    normal = (math.sin(angle), math.cos(angle))
    layout_rect = _validate_bbox(page, edit.layout_bbox) if edit.layout_bbox else page.rect
    low, high = _projected_bounds(layout_rect, direction)
    _layout_normal_low, normal_high = _projected_bounds(layout_rect, normal)
    target_low, target_high = _projected_bounds(rect, direction)
    target_normal_low, target_normal_high = _projected_bounds(rect, normal)
    baseline_advance = baseline.x * direction[0] + baseline.y * direction[1]
    baseline_normal = baseline.x * normal[0] + baseline.y * normal[1]
    tolerance = max(2.0, edit.font_size * 0.35)
    gap = max(1.0, edit.font_size * 0.08)
    next_line_start: float | None = None

    for item in native_items:
        item_rect = fitz.Rect(item["bbox"])
        intersection = item_rect & rect
        if not intersection.is_empty and intersection.get_area() / max(rect.get_area(), 1) >= 0.25:
            continue
        item_low, item_high = _projected_bounds(item_rect, direction)
        item_normal_low, item_normal_high = _projected_bounds(item_rect, normal)
        if item_normal_low > target_normal_high + tolerance or item_normal_high < target_normal_low - tolerance:
            if item_normal_low >= target_normal_high - tolerance:
                horizontal_overlap = item_low < target_high + tolerance and item_high > target_low - tolerance
                if horizontal_overlap:
                    next_line_start = item_normal_low if next_line_start is None else min(next_line_start, item_normal_low)
            continue
        if item_high <= target_low + tolerance:
            low = max(low, item_high + gap)
        elif item_low >= target_high - tolerance:
            high = min(high, item_low - gap)

    if edit.alignment == "left":
        max_width = high - baseline_advance
    else:
        max_width = high - low
    if next_line_start is not None:
        normal_high = min(normal_high, max(baseline_normal + edit.font_size * 1.2, next_line_start - gap))
    max_height = max(edit.font_size * 1.5, normal_high - baseline_normal)
    return max_width, max_height, low


def _fit_styled_runs(
    edit: PdfEdit,
    font_resources: dict[str, _ResolvedFont],
    max_width: float,
    max_height: float,
) -> tuple[list[list[tuple[str, PdfSpanStyle]]], float, float]:
    styles = _edit_styles(edit)
    min_scale = max(min(1.0, 4 / style.font_size) for style in styles)
    scales = [1 - index * 0.025 for index in range(41) if 1 - index * 0.025 >= min_scale]
    if not scales or scales[-1] > min_scale:
        scales.append(min_scale)
    for scale in scales:
        lines = _wrapped_styled_runs(edit, font_resources, max_width, scale)
        if not lines:
            continue
        max_font_size = max((style.font_size for line in lines for _text, style in line), default=edit.font_size * scale)
        line_height = max(
            (style.font_size * max(1.0, style.ascender - style.descender) for line in lines for _text, style in line),
            default=max_font_size * 1.2,
        )
        line_height = max(line_height, max_font_size * 1.05)
        if len(lines) * line_height <= max_height + 0.1:
            return lines, line_height, scale
    raise HTTPException(
        status_code=422,
        detail=f"Replacement text does not fit without overlapping nearby content on page {edit.page}. Shorten it or reduce its font size.",
    )


def edit_pdf(pdf_bytes: bytes, request: PdfEditRequest) -> bytes:
    fonts = {font["id"]: font for font in _font_manifest()}
    font_manifest = _font_manifest_unchecked()
    font_files = {font["id"]: (FONT_MANIFEST_PATH.parent / font["file"]).resolve() for font in font_manifest}
    document = _open_document(pdf_bytes)
    try:
        edits_by_page: dict[int, list[tuple[PdfEdit, fitz.Rect]]] = defaultdict(list)
        for edit in request.edits:
            if edit.page > document.page_count:
                raise HTTPException(status_code=422, detail=f"Page {edit.page} does not exist in this PDF.")
            if edit.font_id not in fonts:
                raise HTTPException(status_code=422, detail=f"Font “{edit.font_id}” is not in the bundled font library.")
            page = document[edit.page - 1]
            rect = _validate_bbox(page, edit.bbox)
            if edit.layout_bbox is not None:
                _validate_bbox(page, edit.layout_bbox)
            if edit.baseline is not None and not all(math.isfinite(value) for value in edit.baseline):
                raise HTTPException(status_code=422, detail="Text baseline coordinates must be finite numbers.")
            edits_by_page[edit.page].append((edit, rect))

        for page_number, page_edits in edits_by_page.items():
            page = document[page_number - 1]
            native_items = _native_text(page, page_number)
            page_font_cache: dict[str, _ResolvedFont] = {}
            edit_fonts = {
                id(edit): _resolve_edit_fonts(document, page, edit, font_files, page_font_cache)
                for edit, _rect in page_edits
                if edit.text
            }
            has_text_redactions = False
            for edit, rect in page_edits:
                if edit.source in ("native", "insert"):
                    page.add_redact_annot(rect, fill=None, cross_out=False)
                    has_text_redactions = True
            if has_text_redactions:
                page.apply_redactions(images=0, graphics=0)
            for edit, _rect in page_edits:
                if edit.source == "ocr":
                    patch_rect = _background_patch_rect(page, _rect)
                    patch_bytes = _inpaint_background(page, _rect)
                    page.insert_image(patch_rect, stream=patch_bytes, overlay=True, keep_proportion=False)
            for edit, _rect in page_edits:
                if edit.text:
                    _register_edit_fonts(page, edit, edit_fonts[id(edit)], font_files)

            for edit, rect in page_edits:
                if not edit.text:
                    continue
                font_resources = edit_fonts[id(edit)]
                inset = 0.5 if edit.source == "insert" else 0
                requested_baseline = fitz.Point(edit.baseline) if edit.baseline is not None else fitz.Point(
                    rect.x0 + inset,
                    rect.y0 + (edit.font_size * 1.2 if edit.source == "insert" else rect.height * 0.8),
                )
                baseline = fitz.Point(
                    min(max(requested_baseline.x, page.rect.x0), page.rect.x1),
                    min(max(requested_baseline.y, page.rect.y0), page.rect.y1),
                )
                available_width, available_height, alignment_low = _text_layout_limits(
                    page,
                    edit,
                    rect,
                    baseline,
                    native_items,
                )
                if available_width <= 0:
                    raise HTTPException(
                        status_code=422,
                        detail=f"No safe horizontal space remains for replacement text on page {page_number}.",
                    )
                styles_to_validate = edit.span_styles if edit.preserve_span_styles else []
                if any(style.font_id not in fonts for style in styles_to_validate):
                    raise HTTPException(status_code=422, detail="A text span references a font outside the bundled library.")
                styled_lines, line_height, font_scale = _fit_styled_runs(
                    edit,
                    font_resources,
                    available_width,
                    available_height,
                )
                if font_scale < 1:
                    logger.info(
                        "Reduced replacement font size by %.1f%% to fit page %s",
                        (1 - font_scale) * 100,
                        page_number,
                    )
                angle = math.radians(edit.rotation)
                direction = (math.cos(angle), -math.sin(angle))
                normal = (math.sin(angle), math.cos(angle))
                baseline_advance = baseline.x * direction[0] + baseline.y * direction[1]
                for line_index, line in enumerate(styled_lines):
                    line_width = sum(
                        font_resources[_font_request_key(style, edit.preserve_original_font)].metrics.text_length(
                            text,
                            fontsize=style.font_size,
                        )
                        for text, style in line
                    )
                    if edit.alignment == "center":
                        advance_offset = (alignment_low + available_width / 2) - baseline_advance - line_width / 2
                    elif edit.alignment == "right":
                        advance_offset = alignment_low + available_width - baseline_advance - line_width
                    else:
                        advance_offset = 0
                    cursor = fitz.Point(
                        baseline.x + normal[0] * line_index * line_height + direction[0] * advance_offset,
                        baseline.y + normal[1] * line_index * line_height + direction[1] * advance_offset,
                    )
                    for text, style in line:
                        if not text:
                            continue
                        resolved_font = font_resources[_font_request_key(style, edit.preserve_original_font)]
                        text_matrix = fitz.Matrix(edit.rotation)
                        if style.italic and not resolved_font.embedded:
                            text_matrix = text_matrix * fitz.Matrix(1, 0, 0.22, 1, 0, 0)
                        use_morph = abs(edit.rotation % 90) > 0.01 or (style.italic and not resolved_font.embedded)
                        page.insert_text(
                            cursor,
                            text,
                            fontname=resolved_font.alias,
                            fontsize=style.font_size,
                            color=_parse_color(style.color),
                            fill_opacity=style.opacity,
                            morph=(cursor, text_matrix) if use_morph else None,
                            rotate=round(edit.rotation) % 360 if not use_morph else 0,
                            render_mode=2 if style.bold and not resolved_font.embedded else 0,
                            border_width=0.35 if style.bold and not resolved_font.embedded else 1,
                            overlay=True,
                        )
                        advance = resolved_font.metrics.text_length(text, fontsize=style.font_size)
                        cursor.x += direction[0] * advance
                        cursor.y += direction[1] * advance

        return document.tobytes(garbage=4, deflate=True)
    finally:
        document.close()
