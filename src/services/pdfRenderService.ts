import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    '../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
}

export async function loadPdfJsDoc(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return await loadingTask.promise;
}

export async function renderPageToCanvas(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.5,
): Promise<{ width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');

  context.clearRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return { width: viewport.width, height: viewport.height };
}
