import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, GripVertical, Save, Trash2 } from 'lucide-react';
import { deletePdfPages, reorderPdfPages } from '../services/pdfEngine';
import { loadPdfJsDoc, renderPageToCanvas } from '../services/pdfRenderService';
import { ProcessedFileResult } from '../types';

interface PdfRearrangeWorkspaceProps {
  file: File;
  onBack: () => void;
  onSaveCompleted: (result: ProcessedFileResult) => Promise<void>;
}

const PagePreview: React.FC<{
  document: Awaited<ReturnType<typeof loadPdfJsDoc>>;
  pageNumber: number;
  scrollRoot: React.RefObject<HTMLElement | null>;
}> = ({ document, pageNumber, scrollRoot }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot.current, rootMargin: '300px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    let cancelled = false;
    let page: Awaited<ReturnType<typeof document.getPage>> | null = null;
    const render = async () => {
      try {
        page = await document.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(180 / viewport.width, 230 / viewport.height);
        await renderPageToCanvas(document, pageNumber, canvasRef.current, scale);
      } catch (renderError) {
        if (!cancelled) {
          console.error(`Could not render page ${pageNumber} in rearrange tool:`, renderError);
          setError(true);
        }
      } finally {
        page?.cleanup();
      }
    };
    void render();
    return () => {
      cancelled = true;
      page?.cleanup();
    };
  }, [document, pageNumber, visible]);

  return (
    <div ref={wrapperRef} className="flex h-60 w-48 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-100 p-2 dark:border-neutral-700 dark:bg-neutral-800">
      {error ? (
        <div className="flex h-48 w-full items-center justify-center rounded bg-white text-xs text-red-600 dark:bg-neutral-900">
          Preview unavailable
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-label={`Preview of page ${pageNumber}`}
          className="max-h-48 max-w-full rounded border border-neutral-200 bg-white object-contain dark:border-neutral-700"
        />
      )}
      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Page {pageNumber}</span>
    </div>
  );
};

export const PdfRearrangeWorkspace: React.FC<PdfRearrangeWorkspaceProps> = ({
  file,
  onBack,
  onSaveCompleted,
}) => {
  const pageScrollRef = useRef<HTMLElement>(null);
  const [pdfDocument, setPdfDocument] = useState<Awaited<ReturnType<typeof loadPdfJsDoc>> | null>(null);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [deletedPages, setDeletedPages] = useState<number[]>([]);
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let document: Awaited<ReturnType<typeof loadPdfJsDoc>> | null = null;
    const load = async () => {
      try {
        document = await loadPdfJsDoc(file);
        if (cancelled) {
          await document.cleanup();
          return;
        }
        setPdfDocument(document);
        setPageOrder(Array.from({ length: document.numPages }, (_, index) => index));
      } catch (loadError) {
        if (!cancelled) {
          console.error('Could not load PDF in rearrange tool:', loadError);
          setError(loadError instanceof Error ? loadError.message : 'Could not load this PDF.');
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (document) void document.cleanup();
    };
  }, [file]);

  const visiblePages = pageOrder.filter((pageIndex) => !deletedPages.includes(pageIndex));
  const handleDrop = (targetPageIndex: number) => {
    if (draggedPageIndex === null || draggedPageIndex === targetPageIndex) return;
    setPageOrder((currentOrder) => {
      const updated = [...currentOrder];
      const from = updated.indexOf(draggedPageIndex);
      const to = updated.indexOf(targetPageIndex);
      if (from < 0 || to < 0) return currentOrder;
      updated.splice(from, 1);
      updated.splice(to, 0, draggedPageIndex);
      return updated;
    });
    setDraggedPageIndex(null);
  };

  const handleDelete = (pageIndex: number) => {
    if (visiblePages.length <= 1) {
      setError('A PDF must keep at least one page.');
      return;
    }
    setDeletedPages((current) => [...current, pageIndex]);
    setError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      let output: Blob = file;
      if (pageOrder.some((pageIndex, position) => pageIndex !== position)) {
        output = await reorderPdfPages(output, pageOrder);
      }
      const deletedPositions = pageOrder
        .map((originalIndex, position) => deletedPages.includes(originalIndex) ? position : -1)
        .filter((position) => position >= 0);
      if (deletedPositions.length > 0) {
        output = await deletePdfPages(output, deletedPositions);
      }
      await onSaveCompleted({
        fileName: `rearranged_${file.name}`,
        fileSize: output.size,
        originalSize: file.size,
        blobUrl: URL.createObjectURL(output),
        type: 'application/pdf',
        rawBlob: output,
      });
    } catch (saveError) {
      console.error('Could not save rearranged PDF:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save the rearranged PDF.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-neutral-100 dark:bg-neutral-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h1 className="text-sm font-bold text-neutral-900 dark:text-white">Rearrange PDF Pages</h1>
            <p className="text-xs text-neutral-500">Drag pages to reorder them. Delete any page you do not need.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!pdfDocument || isSaving || visiblePages.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving…' : 'Save PDF'}
        </button>
      </header>
      {error && (
        <div role="alert" className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
      <main ref={pageScrollRef} className="flex-1 overflow-auto p-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Pages ({visiblePages.length})
        </div>
        {!pdfDocument ? (
          <div className="py-20 text-center text-sm text-neutral-500">Loading PDF pages…</div>
        ) : (
          <div className="flex min-h-72 flex-wrap items-start gap-4">
            {visiblePages.map((pageIndex, index) => (
              <div
                key={pageIndex}
                draggable
                onDragStart={(event) => {
                  setDraggedPageIndex(pageIndex);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(pageIndex));
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(pageIndex);
                }}
                onDragEnd={() => setDraggedPageIndex(null)}
                className={`group relative cursor-grab active:cursor-grabbing ${draggedPageIndex === pageIndex ? 'opacity-40' : ''}`}
                aria-label={`Page ${index + 1}, drag to rearrange`}
              >
                {pdfDocument && (
                  <PagePreview document={pdfDocument} pageNumber={pageIndex + 1} scrollRoot={pageScrollRef} />
                )}
                <div className="absolute right-2 top-2 flex gap-1">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/95 text-neutral-500 shadow dark:bg-neutral-900/95">
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(pageIndex)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-white/95 text-neutral-500 shadow hover:bg-red-50 hover:text-red-600 dark:bg-neutral-900/95 dark:hover:bg-red-950"
                    aria-label={`Delete page ${index + 1}`}
                    title="Delete page"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
