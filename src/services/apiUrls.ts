const appApiBaseUrl = (import.meta.env?.VITE_APP_API_URL || '').replace(/\/+$/, '');
const pdfApiBaseUrl = (
  import.meta.env?.VITE_PDF_API_URL
  || import.meta.env?.VITE_LOCAL_API_URL
  || (import.meta.env?.DEV ? 'http://127.0.0.1:8000' : '')
).replace(/\/+$/, '');

export function getAppApiUrl(path: string): string {
  if (!appApiBaseUrl && !import.meta.env?.DEV) {
    throw new Error('Set VITE_APP_API_URL to the hosted Notifile Node API URL.');
  }
  return `${appApiBaseUrl}${path}`;
}

export function getPdfApiUrl(path: string): string {
  if (!pdfApiBaseUrl) {
    throw new Error('Set VITE_PDF_API_URL to the hosted Notifile Python API URL.');
  }
  return `${pdfApiBaseUrl}${path}`;
}
