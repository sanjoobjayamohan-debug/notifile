import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Save, Trash2, Undo2, X, ZoomIn } from 'lucide-react';
import { deletePdfPages } from '../services/pdfEngine';
import { loadPdfJsDoc, renderPageToCanvas } from '../services/pdfRenderService';
import { ProcessedFileResult } from '../types';

interface PdfDeletePagesWorkspaceProps {
  file: File;
  onBack: () => void;
  onSaveCompleted: (result: ProcessedFileResult) => Promise<void>;
}

const PdfPageCanvas: React.FC<{
  document: Awaited<ReturnType<typeof loadPdfJsDoc>>;
  pageNumber: number;
  large?: boolean;
}> = ({ document, pageNumber, large = false }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(large);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (large) {
      setIsVisible(true);
      return;
    }
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [large]);

  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;
    let cancelled = false;
    let page: Awaited<ReturnType<typeof document.getPage>> | null = null;
    const render = async () => {
      try {
        page = await document.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: 1 });
        const scale = large
          ? Math.min(1400 / viewport.width, 1600 / viewport.height)
          : Math.min(220 / viewport.width, 270 / viewport.height);
        await renderPageToCanvas(document, pageNumber, canvasRef.current, scale);
      } catch (error) {
        if (!cancelled) {
          console.error(`Could not render PDF page ${pageNumber}:`, error);
          setFailed(true);
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
  }, [document, isVisible, large, pageNumber]);

  return (
    <div ref={wrapperRef} className={large ? 'flex max-h-[78vh] max-w-[82vw] items-center justify-center' : 'flex h-full w-full items-center justify-center overflow-hidden bg-neutral-100 p-2 dark:bg-neutral-800'}>
      {failed ? (
        <div className="flex h-56 w-full items-center justify-center rounded bg-white text-xs text-red-600 dark:bg-neutral-900">
          Preview unavailable
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-label={`Preview of PDF page ${pageNumber}`}
          className={large
            ? 'max-h-[78vh] max-w-[82vw] rounded border border-neutral-200 bg-white object-contain shadow dark:border-neutral-700'
            : 'max-h-full max-w-full rounded border border-neutral-200 bg-white object-contain dark:border-neutral-700'}
        />
      )}
    </div>
  );
};

export const PdfDeletePagesWorkspace: React.FC<PdfDeletePagesWorkspaceProps> = ({
  file,
  onBack,
  onSaveCompleted,
}) => {
  const [pdfDocument, setPdfDocument] = useState<Awaited<ReturnType<typeof loadPdfJsDoc>> | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [deletedPages, setDeletedPages] = useState<number[]>([]);
  const [zoomPage, setZoomPage] = useState<number | null>(null);
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
        setPageCount(document.numPages);
      } catch (loadError) {
        if (!cancelled) {
          console.error('Could not load PDF in delete pages tool:', loadError);
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

  const remainingCount = pageCount - deletedPages.length;
  const togglePageDelete = (pageIndex: number) => {
    const isDeleted = deletedPages.includes(pageIndex);
    if (!isDeleted && remainingCount <= 1) {
      setError('A PDF must keep at least one page.');
      return;
    }
    setDeletedPages((current) => isDeleted
      ? current.filter((index) => index !== pageIndex)
      : [...current, pageIndex]);
    setError(null);
  };

  const handleSave = async () => {
    if (deletedPages.length === 0) {
      setError('Select at least one page to delete.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const output = await deletePdfPages(file, deletedPages);
      await onSaveCompleted({
        fileName: `trimmed_${file.name}`,
        fileSize: output.size,
        originalSize: file.size,
        blobUrl: URL.createObjectURL(output),
        type: 'application/pdf',
        rawBlob: output,
      });
    } catch (saveError) {
      console.error('Could not delete selected PDF pages:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save the updated PDF.');
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
            <h1 className="text-sm font-bold text-neutral-900 dark:text-white">Delete PDF Pages</h1>
            <p className="text-xs text-neutral-500">Select pages to remove, or zoom in to review a page.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-neutral-500">
            {remainingCount} of {pageCount} pages remaining
          </span>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!pdfDocument || isSaving || deletedPages.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving…' : 'Save PDF'}
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          All Pages ({pageCount})
        </div>
        {!pdfDocument ? (
          <div className="py-20 text-center text-sm text-neutral-500">Loading PDF pages…</div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: pageCount }, (_, pageIndex) => {
              const isDeleted = deletedPages.includes(pageIndex);
              return (
                <article
                  key={pageIndex}
                  className={`group relative aspect-[4/5] overflow-hidden rounded-xl border bg-neutral-100 transition-all dark:bg-neutral-800 ${
                    isDeleted
                      ? 'border-red-400 ring-2 ring-red-300 dark:border-red-800 dark:ring-red-900'
                      : 'border-neutral-200 hover:border-blue-400 dark:border-neutral-800 dark:hover:border-blue-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setZoomPage(pageIndex)}
                    className="absolute inset-0 flex h-full w-full items-center justify-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                    aria-label={`Zoom page ${pageIndex + 1}`}
                  >
                    <PdfPageCanvas document={pdfDocument} pageNumber={pageIndex + 1} />
                  </button>
                  <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/65 px-2 py-1 text-[11px] font-semibold text-white">
                    Page {pageIndex + 1}
                  </span>
                  {isDeleted && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-red-950/35 text-sm font-bold text-white">
                      Marked for deletion
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex translate-y-0 items-center justify-center gap-2 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-3 pb-3 pt-10 opacity-100 transition-opacity md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => setZoomPage(pageIndex)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/95 px-3 text-xs font-semibold text-neutral-800 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-900/95 dark:text-neutral-100"
                      aria-label={`Zoom page ${pageIndex + 1}`}
                    >
                      <ZoomIn className="h-4 w-4" />
                      Zoom
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePageDelete(pageIndex)}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow focus:outline-none focus:ring-2 focus:ring-white ${
                        isDeleted
                          ? 'bg-white/95 text-neutral-800 hover:bg-white dark:bg-neutral-900/95 dark:text-neutral-100'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                      aria-label={isDeleted ? `Keep page ${pageIndex + 1}` : `Delete page ${pageIndex + 1}`}
                    >
                      {isDeleted ? <Undo2 className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      {isDeleted ? 'Keep' : 'Delete'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      {zoomPage !== null && pdfDocument && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-6"
          role="presentation"
          onClick={() => setZoomPage(null)}
        >
          <div
            className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3 rounded-xl bg-white p-5 shadow-2xl dark:bg-neutral-900"
            role="dialog"
            aria-modal="true"
            aria-label={`Zoom preview of page ${zoomPage + 1}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomPage(null)}
              className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"
              aria-label="Close page preview"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="pr-10 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              Page {zoomPage + 1}
            </h2>
            <PdfPageCanvas document={pdfDocument} pageNumber={zoomPage + 1} large />
            <button
              type="button"
              onClick={() => togglePageDelete(zoomPage)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                deletedPages.includes(zoomPage)
                  ? 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {deletedPages.includes(zoomPage) ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              {deletedPages.includes(zoomPage) ? 'Keep Page' : 'Delete Page'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
