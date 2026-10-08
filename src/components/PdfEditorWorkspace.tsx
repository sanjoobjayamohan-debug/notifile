import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bold, Italic, Loader2, Plus, Save } from 'lucide-react';
import { ProcessedFileResult } from '../types';
import { loadPdfJsDoc, renderPageToCanvas } from '../services/pdfRenderService';
import {
  applyPdfEdits,
  extractPdfForEditing,
  getPdfEditorFonts,
  PdfEditOperation,
  PdfEditorDocument,
  PdfEditorFont,
  PdfTextItem,
} from '../services/pdfEditorApi';
import { PdfEditDrafts } from '../services/pdfEditDrafts';

interface PdfEditorWorkspaceProps {
  file: File;
  onBack: () => void;
  onSaveCompleted: (result: ProcessedFileResult) => Promise<void>;
}

interface QueuedEdit extends PdfEditOperation {
  targetId: string;
}

interface InlineTextOverlayProps {
  targetId: string;
  initialText: string;
  resetKey: string;
  style: React.CSSProperties;
  onInput: (targetId: string, text: string) => void;
  onBlur: (editor: HTMLDivElement, targetId: string) => void;
  onCommit: (targetId: string) => void;
  onCancel: (targetId: string) => void;
  inputRef: React.RefObject<HTMLDivElement | null>;
}

const InlineTextOverlay: React.FC<InlineTextOverlayProps> = ({
  targetId,
  initialText,
  resetKey,
  style,
  onInput,
  onBlur,
  onCommit,
  onCancel,
  inputRef,
}) => {
  const initialTextRef = useRef(initialText);
  useLayoutEffect(() => {
    if (inputRef.current) inputRef.current.textContent = initialTextRef.current;
  }, [inputRef, resetKey]);

  return (
    <div
      ref={inputRef}
      role="textbox"
      aria-label="Edit PDF text"
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className="pdf-inline-editor"
      style={style}
      onInput={(event) => onInput(targetId, event.currentTarget.innerText.replace(/\r/g, '').replace(/\n$/, ''))}
      onBlur={(event) => onBlur(event.currentTarget, targetId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onCommit(targetId);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel(targetId);
        }
      }}
    />
  );
};

const defaultFontId = 'roboto';

export const PdfEditorWorkspace: React.FC<PdfEditorWorkspaceProps> = ({ file, onBack, onSaveCompleted }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageAreaRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const inlineDraftsRef = useRef(new PdfEditDrafts<QueuedEdit>());
  const [documentInfo, setDocumentInfo] = useState<PdfEditorDocument | null>(null);
  const [fonts, setFonts] = useState<PdfEditorFont[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [fontId, setFontId] = useState(defaultFontId);
  const [fontSize, setFontSize] = useState(18);
  const [color, setColor] = useState('#111827');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [preserveOriginalFont, setPreserveOriginalFont] = useState(true);
  const [queuedEdits, setQueuedEdits] = useState<QueuedEdit[]>([]);
  const [placingText, setPlacingText] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFontFamily, setPreviewFontFamily] = useState<string | null>(null);
  const [loadedFontFamilies, setLoadedFontFamilies] = useState<Record<string, string>>({});
  const [previewDocument, setPreviewDocument] = useState<Awaited<ReturnType<typeof loadPdfJsDoc>> | null>(null);

  const currentPage = documentInfo?.pages[pageNumber - 1] ?? null;
  const selectedItem = useMemo(
    () => currentPage?.items.find((item) => item.id === selectedId) ?? null,
    [currentPage, selectedId],
  );
  const selectedEdit = selectedId
    ? inlineDraftsRef.current.get(selectedId) ?? queuedEdits.find((edit) => edit.targetId === selectedId)
    : null;
  const allQueuedEdits = inlineDraftsRef.current.merge(queuedEdits);
  const previewFontIdsKey = [...new Set([fontId, ...allQueuedEdits.map((edit) => edit.font_id)].filter(Boolean))].sort().join('|');

  useEffect(() => {
    let cancelled = false;
    let pdfDocument: Awaited<ReturnType<typeof loadPdfJsDoc>> | null = null;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const pdfDocumentPromise = loadPdfJsDoc(file).then((loaded) => {
          if (cancelled) {
            void loaded.cleanup();
            return loaded;
          }
          pdfDocument = loaded;
          return loaded;
        });
        const [fontResult, extracted, loadedDocument] = await Promise.all([
          getPdfEditorFonts(),
          extractPdfForEditing(file),
          pdfDocumentPromise,
        ]);
        if (cancelled) {
          await loadedDocument.cleanup();
          return;
        }
        setFonts(fontResult.fonts);
        setFontId(fontResult.fonts.some((font) => font.id === defaultFontId) ? defaultFontId : fontResult.fonts[0]?.id ?? '');
        setDocumentInfo(extracted);
        setPreviewDocument(pdfDocument);
        const initialSelection = extracted.pages[0]?.items[0]?.id ?? null;
        selectedIdRef.current = initialSelection;
        setSelectedId(initialSelection);
      } catch (loadError) {
        if (!cancelled) {
          console.error('Could not load PDF editor workspace:', loadError);
          setError(loadError instanceof Error ? loadError.message : 'Could not load this PDF for editing.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (pdfDocument) void pdfDocument.cleanup();
    };
  }, [file]);

  useEffect(() => {
    if (!previewDocument || !currentPage || !canvasRef.current) return;
    let cancelled = false;
    const render = async () => {
      try {
        const page = await previewDocument.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(820 / viewport.width, 1.5);
        await renderPageToCanvas(previewDocument, pageNumber, canvasRef.current, scale);
      } catch (renderError) {
        if (!cancelled) {
          console.error(`Could not render PDF page ${pageNumber}:`, renderError);
          setError(renderError instanceof Error ? renderError.message : 'Could not render the selected PDF page.');
        }
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [currentPage, pageNumber, previewDocument]);

  useEffect(() => {
    if (!selectedItem) return;
    const queued = queuedEdits.find((edit) => edit.targetId === selectedItem.id);
    setFontSize(queued?.font_size ?? Math.max(4, Math.min(144, selectedItem.font_size || 12)));
    setColor(queued?.color ?? selectedItem.color);
    setFontId(queued?.font_id ?? selectedItem.font_id ?? defaultFontId);
    setPreserveOriginalFont(queued?.preserve_original_font ?? true);
    setIsBold(queued?.bold ?? Boolean(selectedItem.bold));
    setIsItalic(queued?.italic ?? Boolean(selectedItem.italic));
    setPlacingText(false);
  }, [selectedItem, selectedId]);

  useEffect(() => {
    const selectedFont = fonts.find((font) => font.id === fontId);
    if (!selectedFont || typeof FontFace === 'undefined') {
      setPreviewFontFamily(null);
      return;
    }
    let cancelled = false;
    const family = `Notifile_${selectedFont.id}`;
    const fontFace = new FontFace(family, `url("${selectedFont.file}")`);
    void fontFace.load().then((loaded) => {
      if (cancelled) return;
      document.fonts.add(loaded);
      setPreviewFontFamily(family);
    }).catch((fontError: unknown) => {
      if (!cancelled) {
        console.error(`Could not load bundled font ${selectedFont.family} for preview:`, fontError);
        setPreviewFontFamily(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fontId, fonts]);

  useEffect(() => {
    if (typeof FontFace === 'undefined') return;
    const usedFontIds = previewFontIdsKey.split('|').filter(Boolean);
    let cancelled = false;
    void Promise.all(usedFontIds.map(async (id) => {
      const font = fonts.find((candidate) => candidate.id === id);
      if (!font) return null;
      const family = `Notifile_${font.id}`;
      try {
        const loaded = await new FontFace(family, `url("${font.file}")`).load();
        if (!cancelled) document.fonts.add(loaded);
        return [font.id, family] as const;
      } catch (fontError) {
        console.error(`Could not load bundled font ${font.family} for edit preview:`, fontError);
        return [font.id, 'Arial, sans-serif'] as const;
      }
    })).then((entries) => {
      if (!cancelled) {
        setLoadedFontFamilies(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fonts, previewFontIdsKey]);

  useEffect(() => {
    const firstItemId = currentPage?.items[0]?.id ?? null;
    selectedIdRef.current = firstItemId;
    setSelectedId(firstItemId);
    setIsInlineEditing(false);
    setPlacingText(false);
  }, [currentPage, pageNumber]);

  useEffect(() => {
    if (isInlineEditing) inlineInputRef.current?.focus();
  }, [isInlineEditing, selectedId]);

  const switchToReplaceMode = (targetId = selectedId, editInline = false) => {
    const nextSelectedId = targetId ?? currentPage?.items[0]?.id ?? null;
    selectedIdRef.current = nextSelectedId;
    setSelectedId(nextSelectedId);
    setIsInlineEditing(editInline);
    setPlacingText(false);
  };

  const switchToInsertMode = () => {
    selectedIdRef.current = null;
    setSelectedId(null);
    setFontSize(18);
    setColor('#111827');
    setIsBold(false);
    setIsItalic(false);
    setFontId(defaultFontId);
    setPreserveOriginalFont(false);
    setIsInlineEditing(false);
    setPlacingText(true);
  };

  const createSelectedEdit = (
    text: string,
    style: Partial<Pick<QueuedEdit, 'font_id' | 'font_size' | 'color' | 'bold' | 'italic' | 'preserve_original_font' | 'preserve_span_styles'>> = {},
    targetId = selectedId,
  ): QueuedEdit | null => {
    if (!targetId) return null;
    if (targetId.startsWith('insert-') && !text.trim()) {
      return null;
    }
    const targetItem = documentInfo?.pages.flatMap((page) => page.items).find((item) => item.id === targetId) ?? null;
    const targetDraft = inlineDraftsRef.current.get(targetId)
      ?? queuedEdits.find((edit) => edit.targetId === targetId);
    const bbox = targetItem?.bbox ?? targetDraft?.bbox;
    if (!bbox) return null;
    const baseline = targetItem?.baseline ?? targetDraft?.baseline ?? [
      bbox[0],
      bbox[1] + (targetDraft?.font_size ?? fontSize) * 1.2,
    ];
    const isActiveTarget = targetId === selectedId;
    return {
      targetId,
      page: targetItem?.page ?? targetDraft?.page ?? pageNumber,
      bbox,
      baseline,
      layout_bbox: targetItem?.layout_bbox ?? targetDraft?.layout_bbox,
      text,
      font_id: style.font_id ?? targetDraft?.font_id ?? targetItem?.font_id ?? (isActiveTarget ? fontId : defaultFontId),
      font_size: style.font_size ?? targetDraft?.font_size ?? targetItem?.font_size ?? (isActiveTarget ? fontSize : 18),
      color: style.color ?? targetDraft?.color ?? targetItem?.color ?? (isActiveTarget ? color : '#111827'),
      bold: style.bold ?? targetDraft?.bold ?? Boolean(targetItem?.bold ?? (isActiveTarget && isBold)),
      italic: style.italic ?? targetDraft?.italic ?? Boolean(targetItem?.italic ?? (isActiveTarget && isItalic)),
      source: targetItem?.source ?? targetDraft?.source ?? 'insert',
      original_font: targetItem?.font ?? targetDraft?.original_font,
      preserve_original_font: style.preserve_original_font ?? targetDraft?.preserve_original_font ?? Boolean(targetItem && isActiveTarget && preserveOriginalFont),
      rotation: targetItem?.rotation ?? targetDraft?.rotation ?? 0,
      alignment: targetItem?.alignment ?? targetDraft?.alignment ?? 'left',
      opacity: targetItem?.opacity ?? targetDraft?.opacity ?? 1,
      ascender: targetItem?.ascender ?? targetDraft?.ascender ?? 1.075,
      descender: targetItem?.descender ?? targetDraft?.descender ?? -0.299,
      span_styles: targetItem?.spans?.map((span) => ({
        text: span.text,
        font_id: span.font_id,
        font_size: span.font_size,
        color: span.color,
        bold: span.bold,
        italic: span.italic,
        original_font: span.original_font ?? span.font,
        opacity: span.opacity ?? 1,
        ascender: span.ascender ?? 1.075,
        descender: span.descender ?? -0.299,
      })) ?? targetDraft?.span_styles ?? [],
      preserve_span_styles: style.preserve_span_styles ?? targetDraft?.preserve_span_styles ?? true,
    };
  };

  const queueEditForTarget = (
    targetId: string,
    text: string,
    style: Partial<Pick<QueuedEdit, 'font_id' | 'font_size' | 'color' | 'bold' | 'italic' | 'preserve_original_font' | 'preserve_span_styles'>> = {},
  ) => {
    const targetItem = documentInfo?.pages
      .flatMap((page) => page.items)
      .find((item) => item.id === targetId);
    const normalizedTargetText = targetItem?.text.replace(/\s+/g, ' ').trim();
    const matchingTargetIds = normalizedTargetText
      ? documentInfo?.pages
        .flatMap((page) => page.items)
        .filter((item) => item.text.replace(/\s+/g, ' ').trim() === normalizedTargetText)
        .map((item) => item.id) ?? []
      : [];
    const targetIds = matchingTargetIds.length ? matchingTargetIds : [targetId];
    const nextEdits = targetIds
      .map((id) => createSelectedEdit(text, style, id))
      .filter((edit): edit is QueuedEdit => edit !== null);
    if (nextEdits.length === 0) {
      if (targetId.startsWith('insert-') && !text.trim()) {
        inlineDraftsRef.current.delete(targetId);
        setQueuedEdits((current) => current.filter((edit) => edit.targetId !== targetId));
      }
      return;
    }
    const updatedTargetIds = new Set(nextEdits.map((edit) => edit.targetId));
    nextEdits.forEach((edit) => inlineDraftsRef.current.set(edit));
    setQueuedEdits((current) => [
      ...current.filter((edit) => !updatedTargetIds.has(edit.targetId)),
      ...nextEdits,
    ]);
    setError(null);
  };

  const queueSelectedEdit = (
    text: string,
    style: Partial<Pick<QueuedEdit, 'font_id' | 'font_size' | 'color' | 'bold' | 'italic' | 'preserve_original_font' | 'preserve_span_styles'>> = {},
  ) => {
    if (selectedId) queueEditForTarget(selectedId, text, style);
  };

  const commitInlineEditor = (
    editor: HTMLDivElement | null,
    targetId: string,
  ) => {
    if (!editor) return;
    const text = editor.innerText.replace(/\r/g, '').replace(/\n$/, '');
    queueEditForTarget(targetId, text);
  };

  const commitCurrentInlineEditor = () => {
    if (selectedId) commitInlineEditor(inlineInputRef.current, selectedId);
  };

  const updateSelectedStyle = (style: Partial<Pick<QueuedEdit, 'font_id' | 'font_size' | 'color' | 'bold' | 'italic' | 'preserve_original_font' | 'preserve_span_styles'>>) => {
    const nextStyle = { ...style };
    nextStyle.preserve_span_styles = false;
    if (style.font_id !== undefined) {
      setFontId(style.font_id);
      setPreserveOriginalFont(false);
      nextStyle.preserve_original_font = false;
    }
    if (style.font_size !== undefined) setFontSize(style.font_size);
    if (style.color !== undefined) setColor(style.color);
    if (style.bold !== undefined) setIsBold(style.bold);
    if (style.italic !== undefined) setIsItalic(style.italic);
    const text = inlineInputRef.current?.innerText.replace(/\r/g, '').replace(/\n$/, '')
      ?? selectedEdit?.text
      ?? selectedItem?.text
      ?? '';
    if (selectedId && (!selectedId.startsWith('insert-') || text.trim())) {
      queueSelectedEdit(text, nextStyle);
    }
  };

  const addTextAtPosition = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!placingText || !currentPage || !pageAreaRef.current) return;
    const bounds = pageAreaRef.current.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * currentPage.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * currentPage.height;
    const width = Math.min(currentPage.width - x, Math.max(100, fontSize * 3));
    const height = Math.max(24, fontSize * 1.8);
    if (x < 0 || y < 0 || width < 12 || y + height > currentPage.height) {
      setError('Click inside the page with enough room below for the new text.');
      return;
    }
    const targetId = `insert-${crypto.randomUUID()}`;
    setQueuedEdits((current) => [
      ...current,
      {
        targetId,
        page: pageNumber,
        bbox: [x, y, x + width, y + height],
        baseline: [x, y + fontSize * 1.2],
        layout_bbox: [x, y, currentPage.width, currentPage.height],
        text: '',
        font_id: fontId,
        font_size: fontSize,
        color,
        bold: isBold,
        italic: isItalic,
        source: 'insert',
        preserve_original_font: false,
      },
    ]);
    setSelectedId(targetId);
    setIsInlineEditing(true);
    setPlacingText(false);
    setError(null);
  };

  const save = async () => {
    const liveText = inlineInputRef.current?.innerText.replace(/\r/g, '').replace(/\n$/, '');
    const activeEdit = isInlineEditing && selectedId && liveText !== undefined
      ? createSelectedEdit(liveText, {}, selectedId)
      : null;
    const currentEdits = inlineDraftsRef.current.merge(queuedEdits);
    if (activeEdit) {
      const activeIndex = currentEdits.findIndex((edit) => edit.targetId === activeEdit.targetId);
      if (activeIndex < 0) currentEdits.push(activeEdit);
      else currentEdits[activeIndex] = activeEdit;
    }
    const editsToSave = currentEdits.filter((edit) => edit.text.trim() || edit.source !== 'insert');
    if (editsToSave.length === 0) {
      setError('Edit or add text on the page before saving changes.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const output = await applyPdfEdits(file, editsToSave);
      const blobUrl = URL.createObjectURL(output);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = `edited_${file.name}`;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      await onSaveCompleted({
        fileName: `edited_${file.name}`,
        fileSize: output.size,
        originalSize: file.size,
        blobUrl,
        type: 'application/pdf',
        rawBlob: output,
      });
    } catch (saveError) {
      console.error('Could not save PDF editor changes:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save the edited PDF.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderBox = (bbox: PdfTextItem['bbox']) => ({
    left: `${(bbox[0] / (currentPage?.width ?? 1)) * 100}%`,
    top: `${(bbox[1] / (currentPage?.height ?? 1)) * 100}%`,
    width: `${((bbox[2] - bbox[0]) / (currentPage?.width ?? 1)) * 100}%`,
    height: `${((bbox[3] - bbox[1]) / (currentPage?.height ?? 1)) * 100}%`,
  });
  const inlineStyle: React.CSSProperties | undefined = currentPage && selectedItem
    ? {
      ...renderBox(selectedItem.bbox),
      width: `${((selectedItem.bbox[2] - selectedItem.bbox[0]) / currentPage.width) * 100}%`,
      minWidth: `${((selectedItem.bbox[2] - selectedItem.bbox[0]) / currentPage.width) * 100}%`,
      maxWidth: `${((selectedItem.bbox[2] - selectedItem.bbox[0]) / currentPage.width) * 100}%`,
      minHeight: `${((selectedItem.bbox[3] - selectedItem.bbox[1]) / currentPage.height) * 100}%`,
      height: 'auto',
      fontSize: `${Math.max(6, (pageAreaRef.current?.clientHeight ?? 0) * fontSize / currentPage.height)}px`,
      lineHeight: 1.15,
      color,
      fontFamily: previewFontFamily ?? 'Arial, sans-serif',
      fontWeight: isBold ? 700 : 400,
      fontStyle: isItalic ? 'italic' : 'normal',
      paddingTop: `${Math.max(0, (selectedItem.baseline?.[1] ?? selectedItem.bbox[1] + fontSize) - selectedItem.bbox[1] - fontSize * 0.8) * (pageAreaRef.current?.clientHeight ?? 0) / currentPage.height}px`,
    }
    : currentPage && selectedEdit
      ? {
        ...renderBox(selectedEdit.bbox),
        width: `${((selectedEdit.bbox[2] - selectedEdit.bbox[0]) / currentPage.width) * 100}%`,
        minWidth: `${((selectedEdit.bbox[2] - selectedEdit.bbox[0]) / currentPage.width) * 100}%`,
        maxWidth: `${((selectedEdit.bbox[2] - selectedEdit.bbox[0]) / currentPage.width) * 100}%`,
        minHeight: `${((selectedEdit.bbox[3] - selectedEdit.bbox[1]) / currentPage.height) * 100}%`,
        height: 'auto',
        fontSize: `${Math.max(6, (pageAreaRef.current?.clientHeight ?? 0) * fontSize / currentPage.height)}px`,
        lineHeight: 1.15,
        color,
        fontFamily: previewFontFamily ?? 'Arial, sans-serif',
        fontWeight: isBold ? 700 : 400,
        fontStyle: isItalic ? 'italic' : 'normal',
        paddingTop: `${Math.max(0, (selectedEdit.baseline?.[1] ?? selectedEdit.bbox[1] + fontSize * 1.2) - selectedEdit.bbox[1] - fontSize * 0.8) * (pageAreaRef.current?.clientHeight ?? 0) / currentPage.height}px`,
      }
      : undefined;
  const renderEditPreviewStyle = (edit: QueuedEdit): React.CSSProperties => {
    if (!currentPage) return {};
    const pageHeight = pageAreaRef.current?.clientHeight ?? 0;
    const baseline = edit.baseline?.[1] ?? edit.bbox[1] + edit.font_size * 1.2;
    return {
      ...renderBox(edit.bbox),
      position: 'absolute',
      zIndex: 11,
      width: 'max-content',
      minWidth: `${((edit.bbox[2] - edit.bbox[0]) / currentPage.width) * 100}%`,
      maxWidth: `${((currentPage.width - edit.bbox[0]) / currentPage.width) * 100}%`,
      minHeight: `${((edit.bbox[3] - edit.bbox[1]) / currentPage.height) * 100}%`,
      height: 'auto',
      boxSizing: 'border-box',
      overflowWrap: 'anywhere',
      whiteSpace: 'pre-wrap',
      padding: `${Math.max(0, (baseline - edit.bbox[1] - edit.font_size * 0.8) * pageHeight / currentPage.height)}px 2px 1px`,
      background: 'white',
      color: edit.color,
      fontFamily: loadedFontFamilies[edit.font_id] ?? previewFontFamily ?? 'Arial, sans-serif',
      fontSize: `${Math.max(6, pageHeight * edit.font_size / currentPage.height)}px`,
      lineHeight: 1.15,
      fontWeight: edit.bold ? 700 : 400,
      fontStyle: edit.italic ? 'italic' : 'normal',
      pointerEvents: 'none',
    };
  };
  const toolbarPosition = currentPage && pageAreaRef.current && (selectedItem || selectedEdit)
    ? {
      left: `${Math.max(8, Math.min(
        ((selectedItem?.bbox[0] ?? selectedEdit?.bbox[0] ?? 0) / currentPage.width) * pageAreaRef.current.clientWidth,
        pageAreaRef.current.clientWidth - 400,
      ))}px`,
      top: `${Math.max(8, ((selectedItem?.bbox[1] ?? selectedEdit?.bbox[1] ?? 0) / currentPage.height) * pageAreaRef.current.clientHeight - 56)}px`,
    }
    : undefined;

  return (
    <section className="pdf-editor-shell">
      <header className="pdf-editor-header">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" /> Choose another PDF
        </button>
        <div className="flex items-center gap-2">
          {documentInfo && (
            <button type="button" onClick={() => { commitCurrentInlineEditor(); switchToInsertMode(); }} disabled={isLoading || isSaving} className="pdf-editor-action">
              <Plus className="h-4 w-4" /> Add text
            </button>
          )}
          <button type="button" onClick={() => void save()} disabled={isLoading || isSaving || allQueuedEdits.every((edit) => !edit.text.trim() && edit.source === 'insert')} className="pdf-editor-save">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes{allQueuedEdits.some((edit) => edit.text.trim() || edit.source !== 'insert') ? ` (${allQueuedEdits.filter((edit) => edit.text.trim() || edit.source !== 'insert').length})` : ''}
          </button>
        </div>
      </header>

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-neutral-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading PDF and detecting text locally. Scanned pages may take a little longer…</div>
      ) : documentInfo && currentPage ? (
        <main className="pdf-editor-main">
          <div className="pdf-editor-page-heading">
            <span>{file.name} · {documentInfo.page_count} page{documentInfo.page_count === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={pageNumber <= 1} onClick={() => { commitCurrentInlineEditor(); setPageNumber((page) => page - 1); }} className="pdf-editor-page-button" aria-label="Previous page"><ArrowLeft className="h-4 w-4" /></button>
              <span>Page {pageNumber}</span>
              <button type="button" disabled={pageNumber >= documentInfo.page_count} onClick={() => { commitCurrentInlineEditor(); setPageNumber((page) => page + 1); }} className="pdf-editor-page-button" aria-label="Next page"><ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
          <p className="mb-3 text-center text-xs text-neutral-500">
            {placingText ? 'Click on the page to place your new text.' : currentPage.ocr_used ? 'Click a text line to edit it. Scanned text is estimated by local OCR.' : 'Click any text on the page to edit it in place.'}
          </p>
          <div className="pdf-editor-canvas-wrap">
            <div
              ref={pageAreaRef}
              onClick={addTextAtPosition}
              className={`pdf-editor-page ${placingText ? 'is-placing' : ''}`}
              style={{ aspectRatio: `${currentPage.width} / ${currentPage.height}` }}
            >
              <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-label={`PDF page ${pageNumber}`} />
              {currentPage.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={`Edit ${item.source === 'ocr' ? 'OCR' : item.font} text: ${item.text}`}
                  onPointerDown={commitCurrentInlineEditor}
                  onClick={(event) => { event.stopPropagation(); switchToReplaceMode(item.id, true); }}
                  className={`pdf-text-target ${selectedId === item.id && isInlineEditing ? 'is-selected' : ''}`}
                  style={{
                    ...renderBox(item.bbox),
                    zIndex: isInlineEditing && item.id !== selectedId ? 30 : 10,
                    pointerEvents: isInlineEditing && item.id === selectedId ? 'none' : 'auto',
                  }}
                  aria-label={`Edit text: ${item.text}`}
                />
              ))}
              {allQueuedEdits
                .filter((edit) => edit.page === pageNumber && edit.targetId !== selectedId && edit.text.trim())
                .map((edit) => (
                  <div
                    key={`preview-${edit.targetId}`}
                    aria-hidden="true"
                    className="pdf-edit-preview"
                    style={renderEditPreviewStyle(edit)}
                  >
                    {edit.text}
                  </div>
                ))}
              {isInlineEditing && selectedId && inlineStyle && (
                <InlineTextOverlay
                  key={`${selectedId}:${isInlineEditing}`}
                  targetId={selectedId}
                  inputRef={inlineInputRef}
                  resetKey={`${selectedId}:${isInlineEditing}`}
                  initialText={inlineDraftsRef.current.get(selectedId)?.text ?? selectedEdit?.text ?? selectedItem?.text ?? ''}
                  style={inlineStyle}
                  onInput={(targetId, text) => {
                    queueEditForTarget(targetId, text);
                  }}
                  onBlur={commitInlineEditor}
                  onCommit={(targetId) => commitInlineEditor(inlineInputRef.current, targetId)}
                  onCancel={(targetId) => {
                    inlineDraftsRef.current.delete(targetId);
                    setQueuedEdits((current) => current.filter((edit) => edit.targetId !== targetId));
                    if (selectedIdRef.current !== targetId) return;
                    selectedIdRef.current = null;
                    setIsInlineEditing(false);
                    setSelectedId(null);
                  }}
                />
              )}
              {isInlineEditing && selectedId && toolbarPosition && (
                <div className="pdf-floating-toolbar" style={toolbarPosition} role="toolbar" aria-label="Text formatting">
                  <select
                    aria-label="Font family"
                    value={fontId}
                    onMouseDown={(event) => event.stopPropagation()}
                    onChange={(event) => updateSelectedStyle({ font_id: event.target.value })}
                    className="pdf-toolbar-font"
                  >
                    {fonts.map((font) => <option key={font.id} value={font.id}>{font.family}</option>)}
                  </select>
                  <button type="button" aria-label="Bold" aria-pressed={isBold} className={`pdf-toolbar-icon ${isBold ? 'is-active' : ''}`} onMouseDown={(event) => event.preventDefault()} onClick={() => updateSelectedStyle({ bold: !isBold })}><Bold className="h-4 w-4" /></button>
                  <button type="button" aria-label="Italic" aria-pressed={isItalic} className={`pdf-toolbar-icon ${isItalic ? 'is-active' : ''}`} onMouseDown={(event) => event.preventDefault()} onClick={() => updateSelectedStyle({ italic: !isItalic })}><Italic className="h-4 w-4" /></button>
                  <input aria-label="Font size" type="number" min={4} max={144} value={fontSize} onChange={(event) => updateSelectedStyle({ font_size: Math.max(4, Math.min(144, Number(event.target.value) || 4)) })} className="pdf-toolbar-size" />
                  <input aria-label="Text color" type="color" value={color} onChange={(event) => updateSelectedStyle({ color: event.target.value })} className="pdf-toolbar-color" />
                </div>
              )}
              {placingText && <div className="pointer-events-none absolute inset-x-0 top-2 z-30 text-center text-xs font-semibold text-blue-700">Click where the new text should start</div>}
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-neutral-500">
            Save Changes downloads an edited PDF copy; it does not overwrite the original file. Text stays on this device.
            Scanned text is restored with local inpainting; detailed backgrounds may need touch-up.
          </p>
        </main>
      ) : null}
    </section>
  );
};
