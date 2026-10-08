import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { pdfTextToDocx, pdfTextToHtml, pdfTextToXlsx } from '../src/services/pdfConversionService.ts';

test('PDF text conversions generate a readable DOCX package', async () => {
  const blob = await pdfTextToDocx('Invoice & receipt\nAmount: <100>');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const document = await zip.file('word/document.xml')?.async('text');
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.match(document ?? '', /Invoice &amp; receipt/);
  assert.match(document ?? '', /Amount: &lt;100&gt;/);
});

test('PDF text conversion creates an XLSX worksheet with text rows', async () => {
  const blob = await pdfTextToXlsx('Account  123\nBalance  45');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const sheet = await zip.file('xl/worksheets/sheet1.xml')?.async('text');
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(sheet ?? '', /<c r="A1"/);
  assert.match(sheet ?? '', /<c r="B1"/);
  assert.match(sheet ?? '', /123/);
});

test('PDF text to HTML escapes extracted text', () => {
  const html = pdfTextToHtml('<script>alert(1)</script>');
  assert.equal(html.type, 'text/html;charset=utf-8');
  return html.text().then((value) => {
    assert.match(value, /&lt;script&gt;/);
    assert.doesNotMatch(value, /<script>/);
  });
});
