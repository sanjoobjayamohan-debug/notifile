import { getPdfApiUrl } from './apiUrls';

export async function removeBackgroundWithRembg(file: File): Promise<Blob> {
  const form = new FormData();
  form.append('file', file);

  const endpoint = getPdfApiUrl('/api/image/remove-background');
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      body: form,
    });
  } catch (error) {
    throw new Error(
      'Could not connect to the background-removal API. Check VITE_PDF_API_URL and confirm the Python backend is running.',
      { cause: error },
    );
  }

  if (!response.ok) {
    let detail = `rembg background removal failed (${response.status} ${response.statusText}).`;
    try {
      const body = await response.json() as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(detail);
  }

  const result = await response.blob();
  if (result.type !== 'image/png' || result.size === 0) {
    throw new Error('The rembg API returned an invalid cutout image.');
  }
  return result;
}
