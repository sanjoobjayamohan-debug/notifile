// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfEditorWorkspace } from '../src/components/PdfEditorWorkspace';
import { PdfEditOperation } from '../src/services/pdfEditorApi';

const { applyPdfEdits, extractPdfForEditing, getPdfEditorFonts, loadPdfJsDoc, renderPageToCanvas } = vi.hoisted(() => ({
  applyPdfEdits: vi.fn(),
  extractPdfForEditing: vi.fn(),
  getPdfEditorFonts: vi.fn(),
  loadPdfJsDoc: vi.fn(),
  renderPageToCanvas: vi.fn(),
}));

vi.mock('../src/services/pdfEditorApi', () => ({
  applyPdfEdits,
  extractPdfForEditing,
  getPdfEditorFonts,
}));

vi.mock('../src/services/pdfRenderService', () => ({
  loadPdfJsDoc,
  renderPageToCanvas,
}));

describe('PDF inline editing workflow', () => {
  const file = new File(['source pdf'], 'source.pdf', { type: 'application/pdf' });
  const firstItem = {
    id: 'first',
    page: 1,
    text: 'First original',
    bbox: [72, 100, 240, 120] as [number, number, number, number],
    baseline: [72, 116] as [number, number],
    source: 'native' as const,
    font: 'Helvetica',
    font_id: 'arimo',
    font_size: 12,
    color: '#111111',
    confidence: 100,
    spans: [{
      text: 'First original',
      bbox: [72, 100, 240, 120] as [number, number, number, number],
      baseline: [72, 116] as [number, number],
      font: 'Helvetica',
      font_id: 'arimo',
      font_size: 12,
      color: '#111111',
      bold: false,
      italic: false,
    }],
  };
  const secondItem = {
    ...firstItem,
    id: 'second',
    text: 'Second original',
    bbox: [72, 160, 240, 180] as [number, number, number, number],
    baseline: [72, 176] as [number, number],
  };
  const firstCopyItem = {
    ...firstItem,
    id: 'first-copy',
    text: ' First   original ',
    bbox: [72, 220, 240, 240] as [number, number, number, number],
    baseline: [72, 236] as [number, number],
    spans: firstItem.spans.map((span) => ({ ...span, text: ' First   original ' })),
  };

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
      configurable: true,
      get() {
        return this.textContent ?? '';
      },
      set(value: string) {
        this.textContent = value;
      },
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:edited-pdf'),
    });
    getPdfEditorFonts.mockResolvedValue({
      fonts: [{ id: 'arimo', family: 'Arimo', file: '/fonts/families/arimo.ttf', license: '/fonts/licenses/arimo.txt' }],
    });
    extractPdfForEditing.mockResolvedValue({
      page_count: 1,
      pages: [{ page: 1, width: 612, height: 792, items: [firstItem, secondItem, firstCopyItem], ocr_used: false }],
    });
    loadPdfJsDoc.mockResolvedValue({
      getPage: vi.fn().mockResolvedValue({ getViewport: () => ({ width: 612 }) }),
      cleanup: vi.fn(),
    });
    renderPageToCanvas.mockResolvedValue(undefined);
    applyPdfEdits.mockResolvedValue(new Blob(['%PDF-1.7\n'], { type: 'application/pdf' }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('syncs edits across spacing-equivalent text and retains all drafts for saving', async () => {
    const user = userEvent.setup();
    render(<PdfEditorWorkspace file={file} onBack={vi.fn()} onSaveCompleted={vi.fn().mockResolvedValue(undefined)} />);

    const firstTargets = await screen.findAllByRole('button', { name: /Edit text:.*First.*original/ });
    await user.click(firstTargets[0]);
    const firstEditor = await screen.findByRole('textbox', { name: 'Edit PDF text' });
    expect(screen.getByRole('button', { name: 'Edit text: Second original' }).style.zIndex).toBe('30');
    expect(firstTargets[0].style.pointerEvents).toBe('none');
    await user.clear(firstEditor);
    await user.type(firstEditor, 'First edited');

    await user.click(screen.getByRole('button', { name: 'Edit text: Second original' }));
    const secondEditor = await screen.findByRole('textbox', { name: 'Edit PDF text' });
    expect(secondEditor.textContent).toBe('Second original');
    const firstPreviews = [...document.querySelectorAll<HTMLElement>('.pdf-edit-preview')]
      .filter((preview) => preview.textContent === 'First edited');
    expect(firstPreviews).toHaveLength(2);
    expect(firstPreviews[0].style.position).toBe('absolute');
    expect(firstPreviews[0].style.left).toBe(`${(72 / 612) * 100}%`);
    expect(firstPreviews[0].style.top).toBe(`${(100 / 792) * 100}%`);
    fireEvent.blur(firstEditor);
    expect(firstPreviews.every((preview) => preview.textContent === 'First edited')).toBe(true);
    await user.click(firstTargets[1]);
    expect((await screen.findByRole('textbox', { name: 'Edit PDF text' })).textContent).toBe('First edited');
    await user.click(screen.getByRole('button', { name: 'Edit text: Second original' }));
    const secondEditorAgain = await screen.findByRole('textbox', { name: 'Edit PDF text' });
    expect(secondEditorAgain.textContent).toBe('Second original');
    await user.clear(secondEditorAgain);
    await user.type(secondEditorAgain, 'Second edited');

    await user.click(firstTargets[0]);
    expect((await screen.findByRole('textbox', { name: 'Edit PDF text' })).textContent).toBe('First edited');

    await user.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(applyPdfEdits).toHaveBeenCalledOnce());

    expect(applyPdfEdits.mock.calls[0][0]).toBe(file);
    const submitted = applyPdfEdits.mock.calls[0][1] as PdfEditOperation[];
    expect(submitted.map((edit) => edit.text).sort()).toEqual(['First edited', 'First edited', 'Second edited']);
    expect(submitted.map((edit) => edit.page)).toEqual([1, 1, 1]);
    expect(submitted.every((edit) => edit.span_styles?.length === 1)).toBe(true);
  });

  it('keeps each edited value when moving between A, B, and C and saves every draft', async () => {
    const items = [
      { ...firstItem, id: 'item-a', text: '2025', spans: firstItem.spans.map((span) => ({ ...span, text: '2025' })) },
      { ...secondItem, id: 'item-b', text: 'ABC', spans: firstItem.spans.map((span) => ({ ...span, text: 'ABC' })) },
      { ...firstCopyItem, id: 'item-c', text: '100', spans: firstItem.spans.map((span) => ({ ...span, text: '100' })) },
    ];
    extractPdfForEditing.mockResolvedValue({
      page_count: 1,
      pages: [{ page: 1, width: 612, height: 792, items, ocr_used: false }],
    });
    const user = userEvent.setup();
    render(<PdfEditorWorkspace file={file} onBack={vi.fn()} onSaveCompleted={vi.fn().mockResolvedValue(undefined)} />);

    const replaceText = async (original: string, replacement: string) => {
      await user.click(await screen.findByRole('button', { name: `Edit text: ${original}` }));
      const editor = await screen.findByRole('textbox', { name: 'Edit PDF text' });
      await user.clear(editor);
      await user.type(editor, replacement);
    };

    await replaceText('2025', '2026');
    await replaceText('ABC', 'XYZ');
    await replaceText('100', '200');

    await user.click(screen.getByRole('button', { name: 'Edit text: 2025' }));
    expect((await screen.findByRole('textbox', { name: 'Edit PDF text' })).textContent).toBe('2026');
    await user.click(screen.getByRole('button', { name: 'Edit text: ABC' }));
    expect((await screen.findByRole('textbox', { name: 'Edit PDF text' })).textContent).toBe('XYZ');
    await user.click(screen.getByRole('button', { name: 'Edit text: 100' }));
    expect((await screen.findByRole('textbox', { name: 'Edit PDF text' })).textContent).toBe('200');

    await user.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(applyPdfEdits).toHaveBeenCalledOnce());
    const submitted = applyPdfEdits.mock.calls[0][1] as PdfEditOperation[];
    expect(submitted.map((edit) => edit.text).sort()).toEqual(['200', '2026', 'XYZ']);
  });
});
