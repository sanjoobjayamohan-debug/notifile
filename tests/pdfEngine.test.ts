import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import {
  addBatesNumbers,
  deletePdfPages,
  extractPdfPages,
  mergePdfFiles,
  optimizePdf,
  reorderPdfPages,
  protectPdf,
  readPdfMetadata,
  unlockPdf,
  updatePdfMetadata,
} from '../src/services/pdfEngine.ts';

async function createPdfFile(name = 'fixture.pdf', pageCount = 2): Promise<File> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index++) {
    pdf.addPage([300, 400]).drawText(`Page ${index + 1}`);
  }
  const bytes = new Uint8Array(await pdf.save());
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], name, { type: 'application/pdf' });
}

test('PDF page operations and lossless optimization keep valid page counts', async () => {
  const source = await createPdfFile();
  const merged = await mergePdfFiles([source, source]);
  assert.equal((await PDFDocument.load(await merged.arrayBuffer())).getPageCount(), 4);

  const extracted = await extractPdfPages(source, [1]);
  assert.equal((await PDFDocument.load(await extracted.arrayBuffer())).getPageCount(), 1);

  const deleted = await deletePdfPages(source, [0]);
  assert.equal((await PDFDocument.load(await deleted.arrayBuffer())).getPageCount(), 1);

  await assert.rejects(() => extractPdfPages(source, [99]), /Select at least one page/);
  await assert.rejects(() => deletePdfPages(source, [0, 1]), /keep at least one page/);

  const optimized = await optimizePdf(source);
  assert.equal((await PDFDocument.load(await optimized.arrayBuffer())).getPageCount(), 2);
});

test('PDF pages can be rearranged in the requested order', async () => {
  const source = await PDFDocument.create();
  source.addPage([300, 400]);
  source.addPage([320, 420]);
  source.addPage([340, 440]);
  const sourceBytes = new Uint8Array(await source.save());
  const sourceBuffer = sourceBytes.buffer.slice(
    sourceBytes.byteOffset,
    sourceBytes.byteOffset + sourceBytes.byteLength,
  ) as ArrayBuffer;
  const sourceBlob = new Blob([sourceBuffer], { type: 'application/pdf' });

  const output = await reorderPdfPages(sourceBlob, [2, 0, 1]);
  const reordered = await PDFDocument.load(await output.arrayBuffer());

  assert.deepEqual(reordered.getPages().map((page) => page.getSize()), [
    { width: 340, height: 440 },
    { width: 300, height: 400 },
    { width: 320, height: 420 },
  ]);
  await assert.rejects(() => reorderPdfPages(sourceBlob, [2, 0, 0]), /every PDF page exactly once/);
});

test('PDF metadata and Bates numbering update output without losing pages', async () => {
  const source = await createPdfFile();
  const updated = await updatePdfMetadata(source, {
    title: 'Report',
    author: 'Notifile',
    subject: 'Test',
    keywords: 'one two',
  });
  assert.deepEqual(await readPdfMetadata(new File([updated], 'metadata.pdf')), {
    title: 'Report',
    author: 'Notifile',
    subject: 'Test',
    keywords: 'one two',
  });

  const numbered = await addBatesNumbers(source, 'CASE-', 12);
  assert.equal((await PDFDocument.load(await numbered.arrayBuffer())).getPageCount(), 2);
});

test('PDF protection uses a password and authorized unlocking restores a readable PDF', async () => {
  const source = await createPdfFile('private.pdf', 1);
  const protectedPdf = await protectPdf(source, 'correct horse battery');
  await assert.rejects(async () => PDFDocument.load(await protectedPdf.arrayBuffer()));

  const unlocked = await unlockPdf(new File([protectedPdf], 'protected.pdf'), 'correct horse battery');
  assert.equal((await PDFDocument.load(await unlocked.arrayBuffer())).getPageCount(), 1);
  await assert.rejects(
    () => unlockPdf(new File([protectedPdf], 'protected.pdf'), 'incorrect password'),
    /password/i,
  );
});
