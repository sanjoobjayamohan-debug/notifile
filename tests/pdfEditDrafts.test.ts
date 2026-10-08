import assert from 'node:assert/strict';
import test from 'node:test';
import { PdfEditDrafts } from '../src/services/pdfEditDrafts';
import { PdfEditOperation, serializePdfEdits } from '../src/services/pdfEditorApi';

interface Draft extends PdfEditOperation {
  targetId: string;
}

const edit = (targetId: string, text: string): Draft => ({
  targetId,
  page: 1,
  bbox: [20, 30, 140, 50],
  baseline: [20, 45],
  layout_bbox: [20, 30, 140, 800],
  text,
  font_id: 'roboto',
  font_size: 12,
  color: '#111111',
  source: 'native',
  preserve_span_styles: true,
});

test('editing another block keeps both drafts and includes them in the save payload', () => {
  const drafts = new PdfEditDrafts<Draft>();
  let selectedId = 'first';

  drafts.set(edit(selectedId, 'First revised text'));
  selectedId = 'second';
  drafts.set(edit(selectedId, 'Second revised text'));

  assert.equal(drafts.get('first')?.text, 'First revised text');
  assert.equal(drafts.get('second')?.text, 'Second revised text');

  const request = serializePdfEdits(drafts.merge([]));
  assert.deepEqual(request.edits.map(({ text, page, bbox }) => ({ text, page, bbox })), [
    { text: 'First revised text', page: 1, bbox: [20, 30, 140, 50] },
    { text: 'Second revised text', page: 1, bbox: [20, 30, 140, 50] },
  ]);
});

test('re-editing a block replaces its draft instead of duplicating it', () => {
  const drafts = new PdfEditDrafts<Draft>();
  drafts.set(edit('first', 'Initial text'));
  drafts.set(edit('second', 'Other text'));
  drafts.set(edit('first', 'Updated text'));

  const request = serializePdfEdits(drafts.merge([]));

  assert.equal(request.edits.length, 2);
  assert.equal(request.edits[0].text, 'Updated text');
});
