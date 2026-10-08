from io import BytesIO

import main
from fastapi.testclient import TestClient
from PIL import Image

client = TestClient(main.app)


def make_png(*, transparent: bool = False) -> bytes:
    mode = "RGBA" if transparent else "RGB"
    color = (40, 120, 200, 0) if transparent else (40, 120, 200)
    image = Image.new(mode, (12, 8), color)
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_rembg_background_removal_returns_transparent_png(monkeypatch) -> None:
    source = make_png()
    cutout = make_png(transparent=True)
    called_with: list[bytes] = []

    def fake_remove(image_bytes: bytes) -> bytes:
        called_with.append(image_bytes)
        return cutout

    monkeypatch.setattr(main, "_remove_background_with_rembg", fake_remove)
    response = client.post(
        "/api/image/remove-background",
        files={"file": ("subject.png", source, "image/png")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content == cutout
    assert called_with == [source]
    with Image.open(BytesIO(response.content)) as result:
        assert result.size == (12, 8)
        assert result.mode == "RGBA"
        assert result.getpixel((0, 0))[3] == 0


def test_rembg_background_removal_rejects_invalid_image(monkeypatch) -> None:
    def unexpected_call(_: bytes) -> bytes:
        raise AssertionError("rembg must not receive invalid image data")

    monkeypatch.setattr(main, "_remove_background_with_rembg", unexpected_call)
    response = client.post(
        "/api/image/remove-background",
        files={"file": ("not-an-image.png", b"not an image", "image/png")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "The uploaded file is not a valid image."


def test_rembg_background_removal_surfaces_model_errors(monkeypatch) -> None:
    def fail_removal(_: bytes) -> bytes:
        raise RuntimeError("model unavailable")

    monkeypatch.setattr(main, "_remove_background_with_rembg", fail_removal)
    response = client.post(
        "/api/image/remove-background",
        files={"file": ("subject.png", make_png(), "image/png")},
    )

    assert response.status_code == 502
    assert "model unavailable" in response.json()["detail"]
