import JSZip from 'jszip';
import { loadPdfJsDoc } from './pdfRenderService';
import { extractPdfPages } from './pdfEngine';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function extractPdfText(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const pdf = await loadPdfJsDoc(file);
  const pageLines: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items
        .filter((item): item is typeof item & { str: string; transform: number[] } =>
          'str' in item && Boolean(item.str.trim()) && 'transform' in item
        )
        .map((item) => ({
          text: item.str.trim(),
          x: item.transform[4],
          y: item.transform[5],
        }))
        .sort((left, right) => right.y - left.y || left.x - right.x);

      const rows: Array<{ y: number; cells: string[] }> = [];
      for (const item of items) {
        let row = rows.find((candidate) => Math.abs(candidate.y - item.y) < 3);
        if (!row) {
          row = { y: item.y, cells: [] };
          rows.push(row);
        }
        row.cells.push(item.text);
      }
      rows.sort((left, right) => right.y - left.y);
      pageLines.push(rows.map((row) => row.cells.join('  ')).join('\n'));
      page.cleanup();
      onProgress?.(Math.round((pageNumber / pdf.numPages) * 100));
    }
  } finally {
    await pdf.cleanup();
  }
  return pageLines.join('\n\n');
}

function addDocxContent(zip: JSZip, text: string): void {
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder('_rels')!.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  const paragraphs = text.split(/\r?\n/).map((line) =>
    `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
  ).join('');
  zip.folder('word')!.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`);
}

export async function pdfTextToDocx(text: string): Promise<Blob> {
  const zip = new JSZip();
  addDocxContent(zip, text);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export async function pdfTextToXlsx(text: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  zip.folder('_rels')!.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.folder('xl')!.file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="PDF Text" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.folder('xl')!.folder('_rels')!.file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
  const rows = text.split(/\r?\n/).map((line, rowIndex) => {
    const cells = line.split(/\t| {2,}/);
    const cellXml = cells.map((cell, columnIndex) => {
      let column = '';
      for (let value = columnIndex + 1; value > 0; value = Math.floor((value - 1) / 26)) {
        column = String.fromCharCode(65 + ((value - 1) % 26)) + column;
      }
      return `<c r="${column}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cellXml}</row>`;
  }).join('');
  zip.folder('xl')!.folder('worksheets')!.file('sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function pdfTextToHtml(text: string): Blob {
  const body = text.split(/\f/).map((page) =>
    `<section class="page"><pre>${escapeXml(page)}</pre></section>`
  ).join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>PDF conversion</title><style>body{font:14px/1.5 sans-serif;color:#222}.page{max-width:800px;margin:24px auto;padding:40px;box-shadow:0 1px 8px #ccc;break-after:page}pre{white-space:pre-wrap;font:inherit}</style></head><body>${body}</body></html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

export async function splitPdfToZip(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const pdf = await loadPdfJsDoc(file);
  const totalPages = pdf.numPages;
  await pdf.cleanup();
  const zip = new JSZip();
  for (let index = 0; index < totalPages; index++) {
    const pageBlob = await extractPdfPages(file, [index]);
    zip.file(`page-${String(index + 1).padStart(3, '0')}.pdf`, pageBlob);
    onProgress?.(Math.round(((index + 1) / totalPages) * 85));
  }
  return zip.generateAsync(
    { type: 'blob', mimeType: 'application/zip' },
    (metadata) => onProgress?.(85 + Math.round(metadata.percent * 0.15)),
  );
}

export async function pdfToImagesZip(
  file: File,
  format: 'jpeg' | 'png',
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const pdf = await loadPdfJsDoc(file);
  const zip = new JSZip();
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not create a canvas to render the PDF page.');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error(`Could not encode page ${pageNumber} as ${format.toUpperCase()}.`)),
          `image/${format}`,
          format === 'jpeg' ? 0.92 : undefined,
        );
      });
      zip.file(`page-${String(pageNumber).padStart(3, '0')}.${format === 'jpeg' ? 'jpg' : 'png'}`, imageBlob);
      page.cleanup();
      onProgress?.(Math.round((pageNumber / pdf.numPages) * 85));
    }
  } finally {
    await pdf.cleanup();
  }
  return zip.generateAsync(
    { type: 'blob', mimeType: 'application/zip' },
    (metadata) => onProgress?.(85 + Math.round(metadata.percent * 0.15)),
  );
}

export async function docxToText(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')?.async('text');
  if (!documentXml) throw new Error('This file is not a readable DOCX document.');
  const parsed = new DOMParser().parseFromString(documentXml, 'application/xml');
  if (parsed.querySelector('parsererror')) throw new Error('The DOCX document contains invalid XML.');
  return [...parsed.getElementsByTagNameNS('*', 'p')]
    .map((paragraph) => [...paragraph.getElementsByTagNameNS('*', 't')].map((textNode) => textNode.textContent ?? '').join(''))
    .join('\n');
}
