import { createWorker, OEM } from 'tesseract.js';
import { loadPdfJsDoc } from './pdfRenderService';

export interface OCRResult {
  text: string;
  confidence: number;
  wordCount: number;
  detectedLanguage: string;
  lines: string[];
}

export const SUPPORTED_OCR_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'mal', name: 'Malayalam (മലയാളം)' },
  { code: 'hin', name: 'Hindi (हिन्दी)' },
  { code: 'tam', name: 'Tamil (தமிழ்)' },
  { code: 'kan', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'tel', name: 'Telugu (తెలుగు)' },
  { code: 'spa', name: 'Spanish (Español)' },
  { code: 'fra', name: 'French (Français)' },
  { code: 'deu', name: 'German (Deutsch)' },
  { code: 'ara', name: 'Arabic (العربية)' },
];

export async function performOCR(
  file: File,
  languageCode = 'eng',
  onProgress?: (progress: number, stage: string) => void,
): Promise<OCRResult> {
  if (!SUPPORTED_OCR_LANGUAGES.some((language) => language.code === languageCode)) {
    throw new Error(`OCR language "${languageCode}" is not supported.`);
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const pdf = isPdf ? await loadPdfJsDoc(file) : null;
  const pageCount = pdf?.numPages ?? 1;
  const recognizedPages: string[] = [];
  const confidences: number[] = [];
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let currentPage = 1;
  try {
    worker = await createWorker(languageCode, OEM.LSTM_ONLY, {
      logger: ({ status, progress }) => {
        if (status === 'recognizing text' && typeof progress === 'number') {
          const overallProgress = ((currentPage - 1 + progress) / pageCount) * 100;
          onProgress?.(Math.round(overallProgress), `Recognizing page ${currentPage} of ${pageCount}...`);
        } else if (status) {
          onProgress?.(5, status);
        }
      },
    });
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      currentPage = pageNumber;
      let image: File | HTMLCanvasElement = file;
      let pageCanvas: HTMLCanvasElement | null = null;
      if (pdf) {
        onProgress?.(Math.round(((pageNumber - 1) / pageCount) * 100), `Rendering PDF page ${pageNumber} of ${pageCount}...`);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: Math.min(2, 2400 / page.getViewport({ scale: 1 }).width) });
        pageCanvas = document.createElement('canvas');
        const context = pageCanvas.getContext('2d');
        if (!context) throw new Error('Could not create a canvas for PDF OCR.');
        pageCanvas.width = Math.ceil(viewport.width);
        pageCanvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: context, viewport, canvas: pageCanvas }).promise;
        page.cleanup();
        image = pageCanvas;
      }

      const result = await worker.recognize(image);
      recognizedPages.push(result.data.text.trim());
      confidences.push(result.data.confidence);
      if (pageCanvas) {
        pageCanvas.width = 0;
        pageCanvas.height = 0;
      }
      onProgress?.(Math.round((pageNumber / pageCount) * 100), `Recognized page ${pageNumber} of ${pageCount}`);
    }
  } finally {
    if (worker) await worker.terminate();
    if (pdf) await pdf.cleanup();
  }

  const text = recognizedPages.join('\n\n');
  return {
    text,
    confidence: confidences.length
      ? confidences.reduce((total, confidence) => total + confidence, 0) / confidences.length
      : 0,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    detectedLanguage: languageCode,
    lines: text.split(/\r?\n/),
  };
}
