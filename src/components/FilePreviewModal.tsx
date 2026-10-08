import React, { useEffect, useState } from 'react';
import { X, FileText, Download, Eye, Maximize2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  fileUrl?: string;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  fileUrl,
}) => {
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!file && !fileUrl) {
      setPreviewContent(null);
      setTextContent(null);
      return;
    }

    if (file) {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewContent(url);
        setTextContent(null);
        return () => URL.revokeObjectURL(url);
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const url = URL.createObjectURL(file);
        setPreviewContent(url);
        setTextContent(null);
        return () => URL.revokeObjectURL(url);
      } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        file.text().then((txt) => {
          setTextContent(txt);
          setPreviewContent(null);
        });
      }
    } else if (fileUrl) {
      setPreviewContent(fileUrl);
    }
  }, [file, fileUrl]);

  if (!isOpen) return null;

  const isImage = file?.type.startsWith('image/') || (!file && fileUrl?.startsWith('data:image'));
  const isPdf = file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative flex flex-col h-[90vh] w-full max-w-4xl rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
          <div className="flex items-center gap-2.5 truncate mr-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="truncate">
              <h3 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-white truncate">
                {file?.name || 'File Document Preview'}
              </h3>
              <p className="text-[11px] text-neutral-500 font-mono">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isImage && (
              <>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                  title="Rotate"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Viewer Viewport */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-neutral-100/70 dark:bg-neutral-950/80">
          {isImage && previewContent && (
            <div className="max-h-full max-w-full flex items-center justify-center overflow-auto p-2">
              <img
                src={previewContent}
                alt="Document preview"
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease',
                }}
                className="max-h-[75vh] max-w-full rounded-lg shadow-md object-contain"
              />
            </div>
          )}

          {isPdf && previewContent && (
            <iframe
              src={`${previewContent}#toolbar=0`}
              title="PDF Document Preview"
              className="h-full w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white"
            />
          )}

          {textContent && (
            <div className="h-full w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-6 font-mono text-xs text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 whitespace-pre-wrap">
              {textContent}
            </div>
          )}

          {!isImage && !isPdf && !textContent && (
            <div className="text-center p-8 text-neutral-500">
              <FileText className="mx-auto h-12 w-12 text-neutral-400 mb-2" />
              <p className="text-sm font-medium">Document loaded</p>
              <p className="text-xs text-neutral-400 mt-1">Ready for high-speed processing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
