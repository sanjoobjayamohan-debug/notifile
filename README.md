<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8f2423e7-9dd9-4ba3-bf85-bf526af5cbfb

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key.
3. Run the app:
   `npm run dev`

## Local image background removal API

The Background Remover uses a local FastAPI service to run `rembg` subject
segmentation. No paid external AI service is used. Run it alongside the
Notifile web app:

1. Install Python 3.10–3.13. The current CPU inference runtime used by
   `rembg` does not yet provide an `onnxruntime` wheel for Python 3.14.
2. From the project root, create and activate a virtual environment and install
   the backend dependencies:

   ```sh
   cd backend
   python3.12 -m venv .venv-ai
   source .venv-ai/bin/activate
   python -m pip install -r requirements.txt
   ```

3. Start the API, bound to this computer:

   ```sh
   uvicorn main:app --host 127.0.0.1 --port 8000
   ```

4. In a second terminal, start Notifile from the project root with `npm run dev`.
   The Background Remover connects to `http://127.0.0.1:8000` by default. To use
   another local API address, set `VITE_LOCAL_API_URL` before starting the web app.

The API provides `GET /health` and `POST /api/image/remove-background`. The
background-removal endpoint downloads the `u2net` model on first use and keeps
it cached for subsequent requests; the model is stored in rembg's local model
cache. Uploaded images are processed in memory and are not written to disk by
the API.

Run backend API tests from `backend/` with `python -m pytest`.
Run frontend unit and inline-edit interaction tests with `npm test`.

## Local PDF text editor and OCR

The Edit PDF Text tool extracts selectable PDF text with PyMuPDF and recognizes
scanned content with local Tesseract OCR. On mixed pages, OCR is applied to
embedded image regions while native text remains selectable; OCR boxes are
translated from raster pixels to PDF points and filtered against overlapping
native text. Pages with no native text are OCRed as a whole. Replacements and
inserted text use PyMuPDF. Native replacements retain the extracted baseline,
span metrics, opacity, and text direction where available. The editor attempts
to reuse an embedded original font that can render the replacement; if it is
unavailable or unsuitable, it uses the mapped bundled font and logs that choice.
Multi-style native lines retain their per-span fonts, sizes, colors, opacity,
and bold/italic metadata proportionally across replacement words. Text is
measured with the resolved font metrics, wrapped within nearby-content/page
bounds, and reduced gradually only when needed to fit. Center/right alignment
is inferred only when neighboring lines provide evidence; a single isolated
line does not contain enough information to determine its original alignment.
Uploaded PDFs are processed in memory; no cloud OCR, font service, or external
PDF editing API is used.

Native text is redacted in its target box; page images and vector graphics are
preserved by PyMuPDF's redaction settings. A clean, nearly uniform background
is restored with a PDF-native fill. More complex backgrounds use a high-resolution
local OpenCV inpainted patch, so the page is not flattened, but that small patch
is raster content. Inpainting estimates the background from nearby pixels and
can still need touch-up on detailed photographs or repeating patterns.

The application bundles 76 TTF font families in `public/fonts/families` with
their redistribution licence files in `public/fonts/licenses` and a family
mapping in `public/fonts/manifest.json`. This includes Roboto, Open Sans, Lato,
Montserrat, Source Sans 3, Fira Code, Merriweather, Playfair Display, Ubuntu,
Poppins, and other sans-serif, serif, monospace, display, and web fonts. Font
licences are included alongside the files (72 SIL Open Font License families
and Ubuntu under its Ubuntu Font Licence). The editor uses the bundled files
for document output; it does not enumerate or depend on host-installed fonts.

The editor implementation is organized as follows:

```text
backend/pdf_editor.py                PDF.js-independent OCR and PyMuPDF operations
backend/main.py                      Local FastAPI font, extraction, and edit routes
public/fonts/manifest.json           Font family-to-file and licence mapping
public/fonts/families/               Bundled TTF assets
public/fonts/licenses/               Per-family redistribution licences
src/services/pdfEditorApi.ts         Local API client and payload types
src/components/PdfEditorWorkspace.tsx PDF preview, detected text selection, and edit UI
```

### PDF editor prerequisites and setup

Use Python 3.10–3.13 for the backend virtual environment described above.
Install Tesseract OCR and Poppler command-line utilities on the same computer,
and ensure `tesseract`, `pdfinfo`, and `pdftoppm` are available on `PATH`.
Tesseract's English language data (`eng`) is required by default. On macOS:

```sh
brew install tesseract poppler
```

From the project root, install the Python requirements (including PyMuPDF,
pdf2image, and pytesseract) and run the existing local API:

```sh
cd backend
python -m pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

`pdf2image` uses Poppler for page rasterization. If Poppler is not installed,
the OCR endpoint falls back to PyMuPDF's local page renderer; Tesseract is still
required for OCR. Run the web app in another terminal with `npm run dev`, open
**Edit PDF Text**, and upload a PDF. Click an individual text line to edit
directly over the page; scanned-page OCR segments are independently selectable
by line. A floating toolbar applies bundled font, size, color, bold, and italic
styles as you edit. Use **Add text** to place an editable text overlay, then
**Save Changes** to export and download the edited PDF copy; the source file is
not overwritten. Some source properties (including character/word spacing and
alignment of an isolated one-line object) are not represented in available
PyMuPDF extraction metadata and therefore cannot be reconstructed exactly.
The editor requests OCR at 150 DPI by default to reduce local scan-recognition
wait time; callers of `/api/pdf/extract` can request 100–400 DPI when they need
to trade speed for recognition detail. PDF.js preview loading now runs in
parallel with local extraction.

PDF API routes are `GET /api/pdf/fonts`, `POST /api/pdf/extract`, and
`POST /api/pdf/edit`. Validate the local OCR/editor and background-removal APIs
with `cd backend && python -m pytest`.

## Deploying to Vercel and Render

The frontend is a Vite static site configured by `vercel.json`. The application
also uses two server-side services: the Node/Express API for billing and
temporary file sharing, and the Python/FastAPI API for PDF editing, OCR, and
background removal. `render.yaml` describes both Render services; the Python
service uses `backend/Dockerfile` to install Tesseract and Poppler alongside
the Python dependencies. The PDF and image-processing service needs enough
memory for the selected workload; the Render Starter plan is configured for it.

1. Push the repository to GitHub and import it into Vercel. Keep the project
   root at the repository root and use the Vite settings from `vercel.json`.
2. Create the two Render services from the repository's `render.yaml`. Wait for
   both services to deploy and copy their public service URLs.
3. In the Vercel project settings, set these environment variables for
   Production and Preview, then redeploy:
   - `VITE_APP_API_URL`: the public URL of `notifile-node-api`.
   - `VITE_PDF_API_URL`: the public URL of `notifile-python-api`.
4. Set `NOTIFILE_ALLOWED_ORIGINS` on both Render services to the exact
   production Vercel origin (for example, `https://your-app.vercel.app`). The
   Render blueprint also allows Vercel preview origins with
   `NOTIFILE_ALLOWED_ORIGIN_REGEX`; narrow or remove that setting if preview
   deployments should not access the APIs.
5. For authenticated billing/team API operations, add
   `FIREBASE_SERVICE_ACCOUNT_JSON` to the Node Render service as a secret. Do
   not put Firebase service-account JSON in Vercel or commit it to the repo.

For local development, the Node API remains same-origin and the Python API
defaults to `http://127.0.0.1:8000`. The `VITE_LOCAL_API_URL` variable is still
accepted as a legacy alias for `VITE_PDF_API_URL`.

Mobile-share QR links use the Vercel origin, while upload and download requests
go to the Node API. The Node service's share-file cache is in memory and is
cleared on restarts or deploys; it is suitable for the existing short-lived
demo workflow, not durable file storage. Billing purchases are simulated and
do not collect payments.

## Billing prototype

The Credits and Team Unlimited checkout is intentionally simulated; it does not collect payments. Signed-in mock purchases are written by authenticated Express endpoints using the Firebase Admin SDK. Configure Application Default Credentials for the Firebase project, or set `FIREBASE_SERVICE_ACCOUNT_JSON` in the server environment. Never commit service-account credentials. Without server credentials, signed-in checkout returns an error; the local demo profile stores its simulated balance in this browser only.

Deploy the included `firestore.rules` before enabling billing. Pricing edits require a Firebase Auth custom claim with `admin: true`; grant that claim only from a trusted administrative environment. A real payment provider and server-verified payment callbacks are required before accepting live payments.
