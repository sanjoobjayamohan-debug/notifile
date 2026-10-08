import { getPdfApiUrl } from './apiUrls';

export interface PdfEditorFont {
  id: string;
  family: string;
  file: string;
  license: string;
}

export interface PdfTextItem {
  id: string;
  page: number;
  text: string;
  bbox: [number, number, number, number];
  layout_bbox?: [number, number, number, number];
  baseline?: [number, number];
  source: 'native' | 'ocr';
  font: string;
  font_id?: string;
  font_size: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  rotation?: number;
  alignment?: 'left' | 'center' | 'right';
  opacity?: number;
  ascender?: number;
  descender?: number;
  confidence: number;
  spans?: Array<{
    text: string;
    bbox: [number, number, number, number];
    baseline: [number, number];
    font: string;
    font_id: string;
    font_size: number;
    color: string;
    bold: boolean;
    italic: boolean;
    original_font?: string;
    opacity?: number;
    ascender?: number;
    descender?: number;
  }>;
}

export interface PdfEditorPage {
  page: number;
  width: number;
  height: number;
  items: PdfTextItem[];
  ocr_used: boolean;
}

export interface PdfEditorDocument {
  page_count: number;
  pages: PdfEditorPage[];
}

export interface PdfEditOperation {
  page: number;
  bbox: [number, number, number, number];
  baseline?: [number, number];
  text: string;
  font_id: string;
  font_size: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  layout_bbox?: [number, number, number, number];
  source: 'native' | 'ocr' | 'insert';
  original_font?: string;
  preserve_original_font?: boolean;
  rotation?: number;
  alignment?: 'left' | 'center' | 'right';
  opacity?: number;
  ascender?: number;
  descender?: number;
  span_styles?: PdfEditSpanStyle[];
  preserve_span_styles?: boolean;
}

export interface PdfEditSpanStyle {
  text: string;
  font_id: string;
  font_size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  original_font?: string;
  opacity?: number;
  ascender?: number;
  descender?: number;
}

export function serializePdfEdits(edits: PdfEditOperation[]): { edits: PdfEditOperation[] } {
  return {
    edits: edits.map((edit) => ({
      ...edit,
      bold: edit.bold ?? false,
      italic: edit.italic ?? false,
      preserve_original_font: edit.preserve_original_font ?? false,
      preserve_span_styles: edit.preserve_span_styles ?? true,
      span_styles: edit.span_styles ?? [],
    })),
  };
}

async function responseError(response: Response, operation: string): Promise<Error> {
  let message = `${operation} failed (${response.status} ${response.statusText}).`;
  try {
    const body = await response.json() as { detail?: string | Array<{ msg?: string }> };
    if (typeof body.detail === 'string') message = body.detail;
    else if (Array.isArray(body.detail)) message = body.detail.map((error) => error.msg).filter(Boolean).join('; ') || message;
  } catch {
    // Keep the status-based message when the response is not JSON.
  }
  return new Error(message);
}

async function request<T>(url: string, init: RequestInit, operation: string): Promise<T> {
  const endpoint = getPdfApiUrl(url);
  let response: Response;
  try {
    response = await fetch(endpoint, init);
  } catch (error) {
    throw new Error(
      `Could not connect to the PDF editor API. Check VITE_PDF_API_URL and confirm the Python backend is running.`,
      { cause: error },
    );
  }
  if (!response.ok) throw await responseError(response, operation);
  return await response.json() as T;
}

export function getPdfEditorFonts(): Promise<{ fonts: PdfEditorFont[] }> {
  return request('/api/pdf/fonts', { method: 'GET' }, 'Loading bundled fonts');
}

export function extractPdfForEditing(file: File, language = 'eng', dpi = 150): Promise<PdfEditorDocument> {
  const form = new FormData();
  form.append('file', file);
  const query = new URLSearchParams({ language, dpi: String(dpi) });
  return request(`/api/pdf/extract?${query}`, { method: 'POST', body: form }, 'Extracting PDF text');
}

export async function applyPdfEdits(file: File, edits: PdfEditOperation[]): Promise<Blob> {
  if (edits.length === 0) throw new Error('There are no PDF edits to save.');
  const form = new FormData();
  form.append('file', file);
  form.append('edits_json', JSON.stringify(serializePdfEdits(edits)));
  const endpoint = getPdfApiUrl('/api/pdf/edit');
  let response: Response;
  try {
    response = await fetch(endpoint, { method: 'POST', body: form });
  } catch (error) {
    throw new Error(
      `Could not connect to the PDF editor API. Check VITE_PDF_API_URL and confirm the Python backend is running.`,
      { cause: error },
    );
  }
  if (!response.ok) throw await responseError(response, 'Saving PDF edits');
  const output = await response.blob();
  const signature = new Uint8Array(await output.slice(0, 5).arrayBuffer());
  const isPdf = signature.length === 5
    && signature[0] === 0x25
    && signature[1] === 0x50
    && signature[2] === 0x44
    && signature[3] === 0x46
    && signature[4] === 0x2d;
  if (!isPdf || output.size === 0) {
    throw new Error('The local PDF editor returned an invalid PDF.');
  }
  return output;
}
