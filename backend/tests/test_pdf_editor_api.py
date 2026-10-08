from __future__ import annotations

import json
import math
from io import BytesIO

import main
import pdf_editor
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageStat
import pymupdf as fitz

client = TestClient(main.app)


def make_text_pdf(text: str = "Original PDF text") -> bytes:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    page.insert_text((72, 120), text, fontsize=16)
    output = document.tobytes()
    document.close()
    return output


def make_paragraph_pdf() -> bytes:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    page.insert_textbox(
        fitz.Rect(72, 100, 500, 180),
        "First paragraph line\nSecond paragraph line",
        fontsize=16,
        fontname="helv",
    )
    page.insert_text((72, 240), "A separate heading", fontsize=20, fontname="hebo")
    output = document.tobytes()
    document.close()
    return output


def make_scanned_pdf() -> bytes:
    image = Image.new("RGB", (612, 792), "white")
    image_bytes = BytesIO()
    image.save(image_bytes, format="PNG")
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    page.insert_image(page.rect, stream=image_bytes.getvalue())
    output = document.tobytes()
    document.close()
    return output


def test_font_endpoint_reports_at_least_50_local_files_and_licenses() -> None:
    response = client.get("/api/pdf/fonts")

    assert response.status_code == 200
    fonts = response.json()["fonts"]
    manifest = json.loads(pdf_editor.FONT_MANIFEST_PATH.read_text(encoding="utf-8"))
    assert len(fonts) >= 50
    assert {"Roboto", "Open Sans", "Lato", "Montserrat", "Fira Code", "Merriweather", "Ubuntu"} <= {
        font["family"] for font in fonts
    }
    for font in manifest["fonts"]:
        font_path = pdf_editor.FONT_MANIFEST_PATH.parent / font["file"]
        assert font_path.is_file()
        assert (pdf_editor.FONT_MANIFEST_PATH.parent / font["license"]).is_file()
        document = fitz.open()
        document.new_page().insert_font(fontname=f"test_{font['id']}", fontfile=str(font_path))
        document.close()


def test_extract_returns_native_text_with_pdf_point_coordinates() -> None:
    response = client.post(
        "/api/pdf/extract",
        files={"file": ("document.pdf", make_text_pdf(), "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["page_count"] == 1
    assert body["pages"][0]["ocr_used"] is False
    item = body["pages"][0]["items"][0]
    assert item["source"] == "native"
    assert item["text"] == "Original PDF text"
    assert item["bbox"][0] == 72
    assert item["font_size"] == 16


def test_native_extraction_keeps_lines_separately_for_in_place_editing() -> None:
    response = client.post(
        "/api/pdf/extract",
        files={"file": ("paragraph.pdf", make_paragraph_pdf(), "application/pdf")},
    )

    assert response.status_code == 200
    page = response.json()["pages"][0]
    assert page["ocr_used"] is False
    assert len(page["items"]) == 3
    first_line, second_line, heading = page["items"]
    assert first_line["text"] == "First paragraph line"
    assert first_line["font"] == "Helvetica"
    assert first_line["font_size"] == 16
    assert first_line["baseline"][1] > first_line["bbox"][1]
    assert [span["text"] for span in first_line["spans"]] == ["First paragraph line"]
    assert second_line["text"] == "Second paragraph line"
    assert heading["text"] == "A separate heading"
    assert heading["font"] == "Helvetica-Bold"
    assert heading["bold"] is True


def test_native_text_uses_metric_compatible_bundle_font_mapping() -> None:
    assert pdf_editor._font_id_for_name("Helvetica-Bold") == "arimo"
    assert pdf_editor._font_id_for_name("TimesNewRomanPSMT") == "sourceserif4"
    assert pdf_editor._font_id_for_name("CourierNewPSMT") == "cousine"


def test_embedded_font_lookup_ignores_pdf_subset_prefix() -> None:
    class StubPage:
        def get_fonts(self, *, full: bool):
            assert full is True
            return [(42, "ttf", "Type0", "ABCDEF+Roboto-Regular", "F0", 0, 0)]

    class StubDocument:
        def extract_font(self, xref: int):
            assert xref == 42
            return ("Roboto-Regular", "ttf", "Type0", b"font-data")

    assert pdf_editor._embedded_original_font(
        StubDocument(),
        StubPage(),
        "ABCDEF+Roboto-Regular",
    ) == b"font-data"


def test_native_text_layer_prevents_ocr_even_when_page_contains_an_image(monkeypatch) -> None:
    document = fitz.open(stream=make_text_pdf(), filetype="pdf")
    image = Image.new("RGB", (8, 8), "white")
    image_bytes = BytesIO()
    image.save(image_bytes, format="PNG")
    document[0].insert_image(fitz.Rect(400, 400, 408, 408), stream=image_bytes.getvalue())
    source = document.tobytes()
    document.close()

    def unexpected_ocr(*args, **kwargs):
        raise AssertionError("OCR must not run when selectable native text exists")

    monkeypatch.setattr(pdf_editor, "_ocr_page", unexpected_ocr)
    response = client.post(
        "/api/pdf/extract",
        files={"file": ("mixed.pdf", source, "application/pdf")},
    )

    assert response.status_code == 200
    assert response.json()["pages"][0]["ocr_used"] is False
    assert response.json()["pages"][0]["items"][0]["text"] == "Original PDF text"


def test_mixed_native_and_scanned_page_ocr_scans_image_region_only(monkeypatch) -> None:
    document = fitz.open(stream=make_text_pdf(), filetype="pdf")
    image = Image.new("RGB", (250, 200), "white")
    image_bytes = BytesIO()
    image.save(image_bytes, format="PNG")
    document[0].insert_image(fitz.Rect(300, 300, 550, 500), stream=image_bytes.getvalue())
    source = document.tobytes()
    document.close()
    monkeypatch.setattr(
        pdf_editor,
        "_render_page",
        lambda *_args: Image.new("RGB", (612, 792), "white"),
    )
    monkeypatch.setattr(
        pdf_editor.pytesseract,
        "image_to_data",
        lambda image, *, lang, output_type: {
            "text": ["Scanned", "region"],
            "conf": ["95", "90"],
            "left": [10, 80],
            "top": [20, 20],
            "width": [65, 55],
            "height": [20, 20],
            "block_num": [1, 1],
            "par_num": [1, 1],
            "line_num": [1, 1],
        },
    )

    response = client.post(
        "/api/pdf/extract",
        files={"file": ("mixed.pdf", source, "application/pdf")},
    )

    assert response.status_code == 200
    page = response.json()["pages"][0]
    assert page["ocr_used"] is True
    assert {item["text"] for item in page["items"]} == {"Original PDF text", "Scanned region"}
    scanned = next(item for item in page["items"] if item["source"] == "ocr")
    assert scanned["bbox"] == [310, 320, 435, 340]


def test_ocr_coordinates_are_scaled_from_raster_pixels_to_pdf_points(monkeypatch) -> None:
    def fake_image_to_data(image, *, lang, output_type):
        assert lang == "eng"
        assert output_type == pdf_editor.pytesseract.Output.DICT
        return {
            "text": ["Scanned", "words"],
            "conf": ["95", "90"],
            "left": [100, 240],
            "top": [200, 200],
            "width": [120, 100],
            "height": [40, 40],
            "block_num": [1, 1],
            "par_num": [1, 1],
            "line_num": [1, 1],
        }

    monkeypatch.setattr(pdf_editor.pytesseract, "image_to_data", fake_image_to_data)
    response = client.post(
        "/api/pdf/extract?language=eng&dpi=200",
        files={"file": ("scan.pdf", make_scanned_pdf(), "application/pdf")},
    )

    assert response.status_code == 200
    page = response.json()["pages"][0]
    assert page["ocr_used"] is True
    item = page["items"][0]
    assert item["source"] == "ocr"
    assert item["text"] == "Scanned words"
    assert item["bbox"] == [36, 72, 122.4, 86.4]


def test_default_ocr_resolution_uses_faster_local_setting(monkeypatch) -> None:
    observed_dpi: list[int] = []

    def render_page(_pdf_bytes, _page, _page_number, dpi):
        observed_dpi.append(dpi)
        return Image.new("RGB", (612, 792), "white")

    monkeypatch.setattr(pdf_editor, "_render_page", render_page)
    monkeypatch.setattr(pdf_editor, "_ocr_page", lambda *_args, **_kwargs: [])
    response = client.post(
        "/api/pdf/extract",
        files={"file": ("scan.pdf", make_scanned_pdf(), "application/pdf")},
    )

    assert response.status_code == 200
    assert observed_dpi == [150]


def test_ocr_returns_independently_editable_line_boxes(monkeypatch) -> None:
    data = {
        "text": ["First", "line", "continues", "here", "New", "paragraph"],
        "conf": ["90", "92", "88", "91", "93", "89"],
        "left": [20, 90, 20, 125, 20, 90],
        "top": [30, 30, 55, 55, 130, 130],
        "width": [60, 30, 95, 45, 38, 65],
        "height": [12, 12, 12, 12, 12, 12],
        "block_num": [1, 1, 1, 1, 1, 1],
        "par_num": [1, 1, 1, 1, 2, 2],
        "line_num": [1, 1, 2, 2, 1, 1],
    }
    monkeypatch.setattr(
        pdf_editor.pytesseract,
        "image_to_data",
        lambda image, *, lang, output_type: data,
    )
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    items = pdf_editor._ocr_page(Image.new("RGB", (612, 792), "white"), page, 1, "eng")
    document.close()

    assert len(items) == 3
    assert items[0]["text"] == "First line"
    assert items[0]["bbox"] == [20, 30, 120, 42]
    assert items[1]["text"] == "continues here"
    assert items[1]["bbox"] == [20, 55, 170, 67]
    assert items[2]["text"] == "New paragraph"


def test_edit_replaces_native_text_and_embeds_selected_font() -> None:
    source = make_text_pdf()
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": [68, 98, 320, 128],
                    "text": "Changed PDF text",
                    "font_id": "roboto",
                    "font_size": 16,
                    "color": "#202020",
                    "source": "native",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    text = edited[0].get_text()

    assert "Changed PDF text" in text
    assert "Original PDF text" not in text
    embedded_fonts = [edited.extract_font(font[0]) for font in edited[0].get_fonts(full=True)]
    assert any(font[0] == "Roboto Regular" and len(font[3]) > 100_000 for font in embedded_fonts)
    edited.close()


def test_native_replacement_uses_the_extracted_text_baseline() -> None:
    source = make_text_pdf()
    extracted = pdf_editor.extract_pdf_text(source)
    item = extracted["pages"][0]["items"][0]
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": item["bbox"],
                    "baseline": item["baseline"],
                    "text": "Edited text",
                    "font_id": "arimo",
                    "font_size": item["font_size"],
                    "color": item["color"],
                    "source": "native",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    replacement = next(
        span
        for block in edited[0].get_text("dict")["blocks"]
        if block.get("type") == 0
        for line in block["lines"]
        for span in line["spans"]
        if span["text"] == "Edited text"
    )

    assert replacement["origin"][1] == item["baseline"][1]
    edited.close()


def test_replacement_text_wraps_to_the_target_layout_width() -> None:
    source = make_text_pdf()
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": [72, 98, 160, 128],
                    "baseline": [72, 120],
                    "layout_bbox": [72, 98, 160, 300],
                    "text": "One two three four five six seven eight",
                    "font_id": "arimo",
                    "font_size": 16,
                    "color": "#111111",
                    "source": "native",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    output_text = edited[0].get_text()

    assert len(output_text.strip().splitlines()) > 1
    assert " ".join(output_text.split()).endswith("One two three four five six seven eight")
    edited.close()


def test_replacement_preserves_distinct_extracted_span_styles() -> None:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    regular = fitz.Font("helv")
    first_text = "small "
    first_x = 72
    second_x = first_x + regular.text_length(first_text, fontsize=12)
    page.insert_text((first_x, 120), first_text, fontsize=12, color=(1, 0, 0))
    page.insert_text((second_x, 120), "BOLD", fontname="hebo", fontsize=18, color=(0, 0, 1))
    source = document.tobytes()
    document.close()
    extracted = pdf_editor.extract_pdf_text(source)
    item = extracted["pages"][0]["items"][0]
    assert len(item["spans"]) == 2
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": item["bbox"],
                    "baseline": item["baseline"],
                    "layout_bbox": [item["bbox"][0], item["bbox"][1], 500, 300],
                    "text": "new regular words bold ending",
                    "font_id": item["font_id"],
                    "font_size": item["font_size"],
                    "color": item["color"],
                    "source": "native",
                    "span_styles": item["spans"],
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    spans = [
        span
        for block in edited[0].get_text("dict")["blocks"]
        if block.get("type") == 0
        for line in block["lines"]
        for span in line["spans"]
    ]
    replacement_spans = [span for span in spans if span["text"].strip()]

    assert " ".join(edited[0].get_text().split()).endswith("new regular words bold ending")
    assert len({round(span["size"]) for span in replacement_spans}) > 1
    assert any(span["color"] != replacement_spans[0]["color"] for span in replacement_spans)
    edited.close()


def test_inpainted_background_keeps_local_gradient_variation() -> None:
    gradient = Image.new("RGB", (612, 792))
    for y in range(792):
        for x in range(612):
            gradient.putpixel((x, y), (min(255, 80 + x // 3), min(255, 100 + y // 4), 190))
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    image_bytes = BytesIO()
    gradient.save(image_bytes, format="PNG")
    page.insert_image(page.rect, stream=image_bytes.getvalue())
    page.insert_text((180, 300), "text to remove", fontsize=20, color=(0, 0, 0))
    patch_bytes = pdf_editor._inpaint_background(page, fitz.Rect(175, 275, 310, 310))
    patch = Image.open(BytesIO(patch_bytes))

    assert ImageStat.Stat(patch).stddev[0] > 1
    assert patch.mode == "RGBA"
    alpha = np.asarray(patch)[:, :, 3]
    assert alpha[0, 0] == 0
    assert alpha[24:patch.height - 24, 24:patch.width - 24].max() == 255
    document.close()


def test_native_edit_preserves_gray_vector_background_without_a_patch() -> None:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    background_color = (0.72, 0.72, 0.72)
    page.draw_rect(fitz.Rect(60, 85, 350, 145), color=None, fill=background_color)
    page.insert_text((72, 120), "Text on color", fontsize=16)
    source = document.tobytes()
    document.close()
    item = pdf_editor.extract_pdf_text(source)["pages"][0]["items"][0]
    edit_rect = fitz.Rect(item["bbox"]) + (-4, -4, 4, 4)

    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": list(edit_rect),
                    "baseline": item["baseline"],
                    "text": "Updated color text",
                    "font_id": item["font_id"],
                    "font_size": item["font_size"],
                    "color": item["color"],
                    "source": "native",
                }
            ]
        }
    )
    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    original = fitz.open(stream=source, filetype="pdf")
    assert "Updated color text" in edited[0].get_text()
    assert len(edited[0].get_images(full=True)) == len(original[0].get_images(full=True))
    drawings = [drawing for drawing in edited[0].get_drawings() if drawing["fill"] is not None]
    assert len(drawings) == 1
    assert drawings[0]["fill"] == pytest.approx(background_color, abs=0.02)
    pixmap = edited[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pixel_x, pixel_y = round((edit_rect.x0 + 1) * 2), round((edit_rect.y0 + 1) * 2)
    offset = (pixel_y * pixmap.width + pixel_x) * pixmap.n
    assert tuple(pixmap.samples[offset : offset + 3]) == pytest.approx(tuple(round(channel * 255) for channel in background_color), abs=2)
    original.close()
    edited.close()


def test_native_edit_preserves_white_background_without_a_white_patch() -> None:
    source = make_text_pdf()
    item = pdf_editor.extract_pdf_text(source)["pages"][0]["items"][0]
    edit_rect = fitz.Rect(item["bbox"]) + (-4, -4, 4, 4)
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": list(edit_rect),
                    "baseline": item["baseline"],
                    "text": "Updated text",
                    "font_id": item["font_id"],
                    "font_size": item["font_size"],
                    "color": item["color"],
                    "source": "native",
                }
            ]
        }
    )
    output = pdf_editor.edit_pdf(source, request)
    original = fitz.open(stream=source, filetype="pdf")
    edited = fitz.open(stream=output, filetype="pdf")
    assert len(edited[0].get_images(full=True)) == len(original[0].get_images(full=True))
    assert edited[0].get_drawings() == original[0].get_drawings()
    pixmap = edited[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pixel_x, pixel_y = round((edit_rect.x0 + 1) * 2), round((edit_rect.y0 + 1) * 2)
    offset = (pixel_y * pixmap.width + pixel_x) * pixmap.n
    assert tuple(pixmap.samples[offset : offset + 3]) == (255, 255, 255)
    original.close()
    edited.close()


def test_native_edit_preserves_colored_box_background_without_a_patch() -> None:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    background_color = (0.1, 0.4, 0.8)
    page.draw_rect(fitz.Rect(60, 85, 350, 145), color=None, fill=background_color)
    page.insert_text((72, 120), "Text on color", fontsize=16)
    source = document.tobytes()
    document.close()
    item = pdf_editor.extract_pdf_text(source)["pages"][0]["items"][0]
    edit_rect = fitz.Rect(item["bbox"]) + (-4, -4, 4, 4)
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": list(edit_rect),
                    "baseline": item["baseline"],
                    "text": "Replacement",
                    "font_id": item["font_id"],
                    "font_size": item["font_size"],
                    "color": item["color"],
                    "source": "native",
                }
            ]
        }
    )
    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    pixmap = edited[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pixel_x, pixel_y = round((edit_rect.x0 + 1) * 2), round((edit_rect.y0 + 1) * 2)
    offset = (pixel_y * pixmap.width + pixel_x) * pixmap.n
    assert tuple(pixmap.samples[offset : offset + 3]) == pytest.approx(tuple(round(channel * 255) for channel in background_color), abs=2)
    edited.close()


def test_native_edit_near_border_keeps_the_crossing_pdf_line() -> None:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    page.insert_text((72, 120), "Border nearby", fontsize=16)
    page.draw_line((60, 110), (300, 110), color=(1, 0, 0), width=1)
    source = document.tobytes()
    document.close()
    item = pdf_editor.extract_pdf_text(source)["pages"][0]["items"][0]
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": item["bbox"],
                    "baseline": item["baseline"],
                    "text": "Edited border",
                    "font_id": item["font_id"],
                    "font_size": item["font_size"],
                    "color": item["color"],
                    "source": "native",
                }
            ]
        }
    )
    output = pdf_editor.edit_pdf(source, request)
    original = fitz.open(stream=source, filetype="pdf")
    edited = fitz.open(stream=output, filetype="pdf")
    before = original[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    after = edited[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    offset = (110 * 2 * before.width + 200 * 2) * before.n
    assert before.samples[offset : offset + 3] == after.samples[offset : offset + 3]
    original.close()
    edited.close()


def test_native_edit_over_an_image_reveals_the_original_image_pixels() -> None:
    yy, xx = np.indices((792, 612))
    pixels = np.empty((792, 612, 3), dtype=np.uint8)
    pixels[:] = np.stack((80 + xx // 4, 100 + yy // 5, np.full_like(xx, 180)), axis=-1).clip(0, 255)
    image_bytes = BytesIO()
    Image.fromarray(pixels).save(image_bytes, format="PNG")
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    page.insert_image(page.rect, stream=image_bytes.getvalue())
    page.insert_text((150, 300), "Over image text", fontsize=16)
    source = document.tobytes()
    document.close()
    item = pdf_editor.extract_pdf_text(source)["pages"][0]["items"][0]
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": item["bbox"],
                    "baseline": item["baseline"],
                    "text": "Image text",
                    "font_id": item["font_id"],
                    "font_size": item["font_size"],
                    "color": item["color"],
                    "source": "native",
                }
            ]
        }
    )
    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    pixmap = edited[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pixel_x, pixel_y = round((item["bbox"][2] - 2) * 2), round((item["bbox"][1] + 2) * 2)
    offset = (pixel_y * pixmap.width + pixel_x) * pixmap.n
    expected = (80 + int(item["bbox"][2] - 2) // 4, 100 + int(item["bbox"][1] + 2) // 5, 180)
    assert tuple(pixmap.samples[offset : offset + 3]) == pytest.approx(expected, abs=3)
    assert len(edited[0].get_images(full=True)) == 1
    edited.close()


def test_ocr_edit_inpaints_scanned_background_without_white_rectangle() -> None:
    yy, xx = np.indices((792, 612))
    gray = (170 + ((xx + yy) % 9) - 4).astype(np.uint8)
    scan = Image.fromarray(np.dstack((gray, gray, gray)), mode="RGB")
    from PIL import ImageDraw

    ImageDraw.Draw(scan).text((170, 285), "Scanned source", fill=(10, 10, 10))
    image_bytes = BytesIO()
    scan.save(image_bytes, format="PNG")
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    page.insert_image(page.rect, stream=image_bytes.getvalue())
    source = document.tobytes()
    document.close()
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": [165, 280, 280, 305],
                    "baseline": [170, 300],
                    "text": "Scanned replacement",
                    "font_id": "arimo",
                    "font_size": 12,
                    "color": "#111111",
                    "source": "ocr",
                }
            ]
        }
    )
    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    pixmap = edited[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pixel_x, pixel_y = 165 * 2 + 2, 280 * 2 + 2
    offset = (pixel_y * pixmap.width + pixel_x) * pixmap.n
    restored = tuple(pixmap.samples[offset : offset + 3])
    assert min(restored) > 130
    assert max(restored) < 210
    assert len(edited[0].get_images(full=True)) == 2
    edited.close()


def test_inline_style_bold_and_italic_are_applied_to_saved_text() -> None:
    source = make_text_pdf()
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": [72, 100, 300, 130],
                    "baseline": [72, 120],
                    "layout_bbox": [72, 100, 600, 150],
                    "text": "Styled replacement",
                    "font_id": "arimo",
                    "font_size": 16,
                    "color": "#123456",
                    "bold": True,
                    "italic": True,
                    "source": "native",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    assert "Styled replacement" in edited[0].get_text()
    pixmap = edited[0].get_pixmap()
    assert len(pixmap.samples) > 0
    edited.close()


def test_native_text_can_be_deleted_without_inserting_replacement() -> None:
    source = make_text_pdf()
    extracted = pdf_editor.extract_pdf_text(source)
    item = extracted["pages"][0]["items"][0]
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": item["bbox"],
                    "baseline": item["baseline"],
                    "text": "",
                    "font_id": item["font_id"],
                    "font_size": item["font_size"],
                    "color": item["color"],
                    "source": "native",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    assert "Original PDF text" not in edited[0].get_text()
    edited.close()


def test_extraction_retains_native_rotation_opacity_and_font_metrics() -> None:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    origin = fitz.Point(180, 260)
    page.insert_text(
        origin,
        "Rotated sample",
        fontsize=16,
        color=(0.2, 0.4, 0.8),
        fill_opacity=0.4,
        morph=(origin, fitz.Matrix(37)),
    )
    source = document.tobytes()
    document.close()

    item = pdf_editor.extract_pdf_text(source)["pages"][0]["items"][0]

    assert item["baseline"] == [180, 260]
    assert abs(item["rotation"] - 37) < 0.1
    assert item["opacity"] == pytest.approx(0.4, abs=0.01)
    assert item["ascender"] > 1
    assert item["descender"] < 0
    assert item["layout_bbox"]
    assert item["spans"][0]["original_font"] == item["font"]


def test_replacement_keeps_cardinal_and_arbitrary_text_rotation() -> None:
    for angle in (0, 90, 180, 270, 37):
        document = fitz.open()
        page = document.new_page(width=612, height=792)
        origin = fitz.Point(320, 320)
        if angle == 37:
            page.insert_text(
                origin,
                "Rotated source",
                fontsize=14,
                morph=(origin, fitz.Matrix(angle)),
            )
        else:
            page.insert_text(origin, "Rotated source", fontsize=14, rotate=angle)
        source = document.tobytes()
        document.close()

        item = pdf_editor.extract_pdf_text(source)["pages"][0]["items"][0]
        edit = pdf_editor.PdfEdit.model_validate(
            {
                "page": 1,
                "bbox": item["bbox"],
                "layout_bbox": item["layout_bbox"],
                "baseline": item["baseline"],
                "text": "Rotated result",
                "font_id": item["font_id"],
                "font_size": item["font_size"],
                "color": item["color"],
                "source": "native",
                "rotation": item["rotation"],
                "preserve_original_font": True,
            }
        )

        output = pdf_editor.edit_pdf(source, pdf_editor.PdfEditRequest(edits=[edit]))
        edited = fitz.open(stream=output, filetype="pdf")
        replacement = next(
            (line, span)
            for block in edited[0].get_text("dict")["blocks"]
            if block.get("type") == 0
            for line in block["lines"]
            for span in line["spans"]
            if span["text"] == "Rotated result"
        )
        source_direction = (
            math.cos(math.radians(item["rotation"])),
            -math.sin(math.radians(item["rotation"])),
        )
        output_direction = replacement[0]["dir"]

        assert "Rotated source" not in edited[0].get_text()
        assert abs(source_direction[0] - output_direction[0]) < 0.02
        assert abs(source_direction[1] - output_direction[1]) < 0.02
        assert replacement[1]["origin"] == pytest.approx(item["baseline"], abs=0.1)
        edited.close()


def test_long_unbroken_replacement_shrinks_instead_of_clipping() -> None:
    source = make_text_pdf()
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": [72, 98, 170, 128],
                    "layout_bbox": [72, 98, 145, 400],
                    "baseline": [72, 120],
                    "text": "ExtraordinarilyLongReplacement",
                    "font_id": "roboto",
                    "font_size": 16,
                    "color": "#202020",
                    "source": "native",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    replacement = next(
        span
        for block in edited[0].get_text("dict")["blocks"]
        if block.get("type") == 0
        for line in block["lines"]
        for span in line["spans"]
        if span["text"] == "ExtraordinarilyLongReplacement"
    )

    assert 4 <= replacement["size"] < 16
    assert replacement["bbox"][2] <= 145
    assert replacement["origin"][1] == pytest.approx(120, abs=0.1)
    edited.close()


def test_alignment_controls_replacement_baseline_position() -> None:
    source = make_text_pdf("")
    layout = [100, 90, 400, 170]
    text = "Aligned"
    font = fitz.Font(fontfile=str(pdf_editor.FONT_MANIFEST_PATH.parent / "families" / "arimo.ttf"))
    text_width = font.text_length(text, fontsize=16)
    for alignment in ("center", "right"):
        request = pdf_editor.PdfEditRequest.model_validate(
            {
                "edits": [
                    {
                        "page": 1,
                        "bbox": [200, 98, 320, 128],
                        "layout_bbox": layout,
                        "baseline": [200, 120],
                        "text": text,
                        "font_id": "arimo",
                        "font_size": 16,
                        "color": "#000000",
                        "source": "native",
                        "alignment": alignment,
                    }
                ]
            }
        )
        output = pdf_editor.edit_pdf(source, request)
        edited = fitz.open(stream=output, filetype="pdf")
        replacement = next(
            span
            for block in edited[0].get_text("dict")["blocks"]
            if block.get("type") == 0
            for line in block["lines"]
            for span in line["spans"]
            if span["text"] == text
        )
        expected_x = layout[0] + (layout[2] - layout[0] - text_width) / 2
        if alignment == "right":
            expected_x = layout[2] - text_width

        assert replacement["origin"][0] == pytest.approx(expected_x, abs=0.2)
        edited.close()


def test_extraction_infers_center_and_right_alignment_from_neighboring_lines() -> None:
    for pdf_alignment, expected_alignment in ((1, "center"), (2, "right")):
        document = fitz.open()
        page = document.new_page(width=612, height=792)
        page.insert_textbox(
            fitz.Rect(150, 100, 450, 180),
            "A longer aligned line\nshort",
            fontsize=12,
            fontname="helv",
            align=pdf_alignment,
        )
        source = document.tobytes()
        document.close()

        extracted = pdf_editor.extract_pdf_text(source)["pages"][0]["items"]

        assert len(extracted) == 2
        assert {item["alignment"] for item in extracted} == {expected_alignment}
        assert extracted[0]["layout_bbox"] == extracted[1]["layout_bbox"]


def test_text_opacity_is_preserved_after_edit() -> None:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    page.insert_text((72, 120), "Transparent source", fontsize=16, fill_opacity=0.35)
    source = document.tobytes()
    document.close()
    item = pdf_editor.extract_pdf_text(source)["pages"][0]["items"][0]
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": item["bbox"],
                    "baseline": item["baseline"],
                    "text": "Transparent result",
                    "font_id": item["font_id"],
                    "font_size": item["font_size"],
                    "color": item["color"],
                    "opacity": item["opacity"],
                    "source": "native",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    trace = next(span for span in edited[0].get_texttrace() if span["type"] == 0)

    assert trace["opacity"] == pytest.approx(0.35, abs=0.02)
    edited.close()


def test_bundled_font_can_insert_unicode_replacement_text() -> None:
    source = make_text_pdf()
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": [72, 98, 320, 128],
                    "layout_bbox": [72, 98, 500, 180],
                    "baseline": [72, 120],
                    "text": "Καλημέρα café",
                    "font_id": "notosans",
                    "font_size": 16,
                    "color": "#111111",
                    "source": "native",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")

    assert "Καλημέρα café" in edited[0].get_text()
    assert "Original PDF text" not in edited[0].get_text()
    edited.close()


def test_edit_keeps_unrelated_vector_content_outside_the_target_box() -> None:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    page.insert_text((72, 120), "Target text", fontsize=16)
    page.draw_line((400, 100), (400, 180), color=(1, 0, 0), width=2)
    source = document.tobytes()
    document.close()
    item = pdf_editor.extract_pdf_text(source)["pages"][0]["items"][0]
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": item["bbox"],
                    "baseline": item["baseline"],
                    "text": "Updated",
                    "font_id": item["font_id"],
                    "font_size": item["font_size"],
                    "color": item["color"],
                    "source": "native",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    before_document = fitz.open(stream=source, filetype="pdf")
    image_before = before_document[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    image_after = edited[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    line_pixel = (100 * 2 * image_before.width + 400 * 2) * image_before.n
    assert image_before.samples[line_pixel : line_pixel + 3] == image_after.samples[line_pixel : line_pixel + 3]
    assert "Target text" not in edited[0].get_text()
    before_document.close()
    edited.close()


def test_edit_clips_ocr_or_content_boxes_at_page_edges() -> None:
    source = make_text_pdf()
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": [68, 98, 630, 128],
                    "baseline": [72, 120],
                    "layout_bbox": [-5, 98, 700, 145],
                    "text": "Edge clipped edit",
                    "font_id": "arimo",
                    "font_size": 14,
                    "color": "#000000",
                    "source": "native",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    assert "Edge clipped edit" in edited[0].get_text()
    assert "Original PDF text" not in edited[0].get_text()
    edited.close()


def test_edit_preserves_the_original_embedded_pdf_font() -> None:
    document = fitz.open()
    page = document.new_page(width=612, height=792)
    original_font_path = pdf_editor.FONT_MANIFEST_PATH.parent / "families" / "roboto.ttf"
    page.insert_font(fontname="originalroboto", fontfile=str(original_font_path))
    page.insert_text((72, 120), "Text in original font", fontname="originalroboto", fontsize=16)
    source = document.tobytes()
    document.close()
    extracted = pdf_editor.extract_pdf_text(source)
    item = extracted["pages"][0]["items"][0]

    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": item["bbox"],
                    "text": "Keep original font",
                    "font_id": item["font_id"],
                    "font_size": item["font_size"],
                    "color": item["color"],
                    "source": "native",
                    "original_font": item["font"],
                    "preserve_original_font": True,
                }
            ]
        }
    )
    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")
    embedded = [edited.extract_font(font[0]) for font in edited[0].get_fonts(full=True)]

    assert "Keep original font" in edited[0].get_text()
    assert any(font[0] == "Roboto Regular" and len(font[3]) > 100_000 for font in embedded)
    edited.close()


def test_edit_inserts_text_and_rejects_boxes_outside_page() -> None:
    source = make_text_pdf("")
    insert_request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": [72, 180, 400, 240],
                    "text": "Inserted locally",
                    "font_id": "opensans",
                    "font_size": 18,
                    "color": "#123456",
                    "source": "insert",
                }
            ]
        }
    )
    output = pdf_editor.edit_pdf(source, insert_request)
    edited = fitz.open(stream=output, filetype="pdf")
    assert "Inserted locally" in edited[0].get_text()
    edited.close()

    invalid_request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": [620, 700, 650, 730],
                    "text": "Out of bounds",
                    "font_id": "roboto",
                    "font_size": 12,
                    "color": "#000000",
                    "source": "insert",
                }
            ]
        }
    )
    response = client.post(
        "/api/pdf/edit",
        files={"file": ("document.pdf", source, "application/pdf")},
        data={"edits_json": invalid_request.model_dump_json()},
    )
    assert response.status_code == 422
    assert "overlap the selected page" in response.json()["detail"]


def test_insert_over_existing_text_clears_the_underlying_text() -> None:
    source = make_text_pdf("Underlying old text")
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": [68, 98, 280, 128],
                    "text": "Replacement overlay",
                    "font_id": "roboto",
                    "font_size": 14,
                    "color": "#111111",
                    "source": "insert",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    edited = fitz.open(stream=output, filetype="pdf")

    assert "Replacement overlay" in edited[0].get_text()
    assert "Underlying old text" not in edited[0].get_text()
    edited.close()


def test_edit_api_returns_saved_pdf_with_all_submitted_edits() -> None:
    source = make_text_pdf()
    edits = {
        "edits": [
            {
                "page": 1,
                "bbox": [68, 98, 320, 128],
                "baseline": [72, 120],
                "layout_bbox": [68, 98, 600, 160],
                "text": "Saved replacement",
                "font_id": "arimo",
                "font_size": 16,
                "color": "#204060",
                "bold": True,
                "italic": True,
                "source": "native",
            },
            {
                "page": 1,
                "bbox": [72, 180, 400, 240],
                "baseline": [72, 202],
                "layout_bbox": [72, 180, 500, 250],
                "text": "Second saved edit",
                "font_id": "opensans",
                "font_size": 14,
                "color": "#111111",
                "source": "insert",
            },
        ]
    }

    response = client.post(
        "/api/pdf/edit",
        files={"file": ("document.pdf", source, "application/pdf")},
        data={"edits_json": json.dumps(edits)},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == 'attachment; filename="edited.pdf"'
    assert response.content.startswith(b"%PDF-")
    edited = fitz.open(stream=response.content, filetype="pdf")
    text = edited[0].get_text()
    assert "Saved replacement" in text
    assert "Second saved edit" in text
    assert "Original PDF text" not in text
    edited.close()


def test_ocr_text_edit_keeps_original_page_image() -> None:
    source = make_scanned_pdf()
    request = pdf_editor.PdfEditRequest.model_validate(
        {
            "edits": [
                {
                    "page": 1,
                    "bbox": [100, 120, 320, 155],
                    "text": "Scanned replacement",
                    "font_id": "roboto",
                    "font_size": 14,
                    "color": "#111111",
                    "source": "ocr",
                }
            ]
        }
    )

    output = pdf_editor.edit_pdf(source, request)
    original = fitz.open(stream=source, filetype="pdf")
    edited = fitz.open(stream=output, filetype="pdf")

    original_image_xrefs = {image[0] for image in original[0].get_images(full=True)}
    edited_image_xrefs = {image[0] for image in edited[0].get_images(full=True)}
    assert len(original_image_xrefs) == 1
    assert original_image_xrefs <= edited_image_xrefs
    assert len(edited_image_xrefs) >= len(original_image_xrefs)
    assert "Scanned replacement" in edited[0].get_text()
    original.close()
    edited.close()
