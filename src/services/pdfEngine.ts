import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { decryptPDF } from '@pdfsmaller/pdf-decrypt';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';

// Helper to wrap Uint8Array safely for Blob constructor in all TS/DOM target variants
function bytesToPdfBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/**
 * Merge multiple PDF files into a single unified document
 */
export async function mergePdfFiles(files: File[], onProgress?: (p: number) => void): Promise<Blob> {
  if (files.length < 2) throw new Error('Select at least two PDF files to merge.');
  const mergedPdf = await PDFDocument.create();
  const totalFiles = files.length;

  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalFiles) * 85));
    }
  }

  const pdfBytes = await mergedPdf.save();
  if (onProgress) onProgress(100);
  return bytesToPdfBlob(pdfBytes);
}

/**
 * Rotate all or selected pages in a PDF
 */
export async function rotatePdfFile(file: File, angle: number = 90): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees((currentRotation + angle) % 360));
  });

  const pdfBytes = await pdfDoc.save();
  return bytesToPdfBlob(pdfBytes);
}

/**
 * Extract or Split specific pages
 */
export async function extractPdfPages(file: File, pageIndices: number[]): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const validIndices = [...new Set(pageIndices)]
    .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < srcDoc.getPageCount());
  if (validIndices.length === 0) {
    throw new Error(`Select at least one page between 1 and ${srcDoc.getPageCount()}.`);
  }
  const newDoc = await PDFDocument.create();

  const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
  copiedPages.forEach(p => newDoc.addPage(p));

  const pdfBytes = await newDoc.save();
  return bytesToPdfBlob(pdfBytes);
}

/**
 * Delete specified pages from PDF
 */
export async function deletePdfPages(file: Blob, pagesToDelete: number[]): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const newDoc = await PDFDocument.create();

  const total = srcDoc.getPageCount();
  const uniquePagesToDelete = [...new Set(pagesToDelete)]
    .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < total);
  if (uniquePagesToDelete.length >= total) {
    throw new Error('A PDF must keep at least one page.');
  }
  const indicesToKeep: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!uniquePagesToDelete.includes(i)) {
      indicesToKeep.push(i);
    }
  }

  const copiedPages = await newDoc.copyPages(srcDoc, indicesToKeep);
  copiedPages.forEach(p => newDoc.addPage(p));

  const pdfBytes = await newDoc.save();
  return bytesToPdfBlob(pdfBytes);
}

/**
 * Reorder PDF pages using their zero-based source indices.
 */
export async function reorderPdfPages(file: Blob, pageOrder: number[]): Promise<Blob> {
  const srcDoc = await PDFDocument.load(await file.arrayBuffer());
  const total = srcDoc.getPageCount();
  if (
    pageOrder.length !== total ||
    new Set(pageOrder).size !== total ||
    pageOrder.some((index) => !Number.isInteger(index) || index < 0 || index >= total)
  ) {
    throw new Error('The page order must contain every PDF page exactly once.');
  }

  if (pageOrder.every((pageIndex, position) => pageIndex === position)) return file;

  const output = await PDFDocument.create();
  const pages = await output.copyPages(srcDoc, pageOrder);
  pages.forEach((page) => output.addPage(page));
  return bytesToPdfBlob(await output.save());
}

/**
 * Apply text watermark diagonally across all pages
 */
export async function watermarkPdf(file: File, watermarkText: string, opacity: number = 0.25): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const fontSize = Math.min(width, height) / 8;
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    page.drawText(watermarkText, {
      x: width / 2 - textWidth / 2,
      y: height / 2 - textHeight / 4,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: Math.max(0.05, Math.min(1, opacity)),
      rotate: degrees(45),
    });
  });

  const pdfBytes = await pdfDoc.save();
  return bytesToPdfBlob(pdfBytes);
}

/**
 * Add Page Numbers to Footer or Header
 */
export async function addPageNumbersPdf(file: File, position: 'bottom' | 'top' = 'bottom'): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const total = pages.length;

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();
    const text = `Page ${idx + 1} of ${total}`;
    const fontSize = 10;
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    const x = width / 2 - textWidth / 2;
    const y = position === 'bottom' ? 24 : height - 30;

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  });

  const pdfBytes = await pdfDoc.save();
  return bytesToPdfBlob(pdfBytes);
}

/**
 * Convert Images (JPG/PNG) into a single PDF document
 */
export async function imagesToPdf(files: File[]): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    let img;
    if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
      img = await pdfDoc.embedPng(arrayBuffer);
    } else {
      // JPEG / WebP fallback
      img = await pdfDoc.embedJpg(arrayBuffer);
    }

    const { width, height } = img;
    // Standard A4 portrait: 595.28 x 841.89 pt
    const a4W = 595.28;
    const a4H = 841.89;

    const scale = Math.min((a4W - 40) / width, (a4H - 40) / height, 1);
    const scaledW = width * scale;
    const scaledH = height * scale;

    const page = pdfDoc.addPage([a4W, a4H]);
    page.drawImage(img, {
      x: (a4W - scaledW) / 2,
      y: (a4H - scaledH) / 2,
      width: scaledW,
      height: scaledH,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return bytesToPdfBlob(pdfBytes);
}

/**
 * Convert plain text into a PDF file
 */
export async function textToPdf(text: string, title: string = 'Document'): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const lines = text.split('\n');
  const a4W = 595.28;
  const a4H = 841.89;
  const margin = 50;
  const lineHeight = 16;
  const maxLinesPerPage = Math.floor((a4H - margin * 2 - 40) / lineHeight);

  let currentLineIdx = 0;
  let pageNum = 1;

  while (currentLineIdx < lines.length || currentLineIdx === 0) {
    const page = pdfDoc.addPage([a4W, a4H]);
    let yPos = a4H - margin;

    if (pageNum === 1) {
      page.drawText(title, {
        x: margin,
        y: yPos,
        size: 16,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPos -= 30;
    }

    let linesOnThisPage = 0;
    while (currentLineIdx < lines.length && linesOnThisPage < maxLinesPerPage) {
      const line = lines[currentLineIdx].slice(0, 95); // truncate very long lines safely
      page.drawText(line, {
        x: margin,
        y: yPos,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPos -= lineHeight;
      linesOnThisPage++;
      currentLineIdx++;
    }

    pageNum++;
    if (currentLineIdx >= lines.length) break;
  }

  const pdfBytes = await pdfDoc.save();
  return bytesToPdfBlob(pdfBytes);
}

export async function optimizePdf(file: File): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
  const bytes = await pdfDoc.save({ useObjectStreams: true, updateFieldAppearances: false });
  return bytesToPdfBlob(bytes);
}

export async function protectPdf(file: File, password: string): Promise<Blob> {
  if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
  const randomOwnerPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const bytes = await encryptPDF(new Uint8Array(await file.arrayBuffer()), password, {
    ownerPassword: randomOwnerPassword,
    algorithm: 'AES-256',
    allowPrinting: true,
    allowHighQualityPrint: true,
    allowCopying: false,
    allowModifying: false,
    allowAnnotating: false,
    allowFillingForms: false,
    allowExtraction: false,
    allowAssembly: false,
  });
  return bytesToPdfBlob(bytes);
}

export async function unlockPdf(file: File, password: string): Promise<Blob> {
  if (!password) throw new Error('Enter the PDF user or owner password.');
  const bytes = await decryptPDF(new Uint8Array(await file.arrayBuffer()), password);
  return bytesToPdfBlob(bytes);
}

export async function updatePdfMetadata(
  file: File,
  metadata: { title: string; author: string; subject: string; keywords: string }
): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
  pdfDoc.setTitle(metadata.title);
  pdfDoc.setAuthor(metadata.author);
  pdfDoc.setSubject(metadata.subject);
  pdfDoc.setKeywords(metadata.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean));
  return bytesToPdfBlob(await pdfDoc.save());
}

export async function readPdfMetadata(file: File): Promise<{
  title: string;
  author: string;
  subject: string;
  keywords: string;
}> {
  const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
  return {
    title: pdfDoc.getTitle() ?? '',
    author: pdfDoc.getAuthor() ?? '',
    subject: pdfDoc.getSubject() ?? '',
    keywords: pdfDoc.getKeywords() ?? '',
  };
}

export async function flattenPdf(file: File): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
  pdfDoc.getForm().flatten();
  return bytesToPdfBlob(await pdfDoc.save());
}

export async function addBatesNumbers(
  file: File,
  prefix: string,
  startNumber: number
): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    const label = `${prefix}${String(startNumber + index).padStart(6, '0')}`;
    page.drawText(label, {
      x: page.getWidth() - font.widthOfTextAtSize(label, 9) - 28,
      y: 18,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
  });
  return bytesToPdfBlob(await pdfDoc.save());
}

/**
 * Read PDF page count safely
 */
export async function getPdfInfo(file: File): Promise<{ pageCount: number; title?: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  return {
    pageCount: pdfDoc.getPageCount(),
    title: pdfDoc.getTitle(),
  };
}
