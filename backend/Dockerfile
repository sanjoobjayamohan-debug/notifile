FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgomp1 \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY public/fonts /app/public/fonts

WORKDIR /app/backend
EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
