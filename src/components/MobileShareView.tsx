import React, { useEffect, useState } from 'react';
import { FileText, Download, ShieldCheck, Clock, AlertCircle, ArrowLeft, Smartphone } from 'lucide-react';
import { getAppApiUrl } from '../services/apiUrls';

interface FileInfo {
  id: string;
  fileName: string;
  size: number;
  mimeType: string;
  createdAt: number;
}

interface MobileShareViewProps {
  shareId: string;
  onGoHome: () => void;
}

export const MobileShareView: React.FC<MobileShareViewProps> = ({ shareId, onGoHome }) => {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInfo() {
      try {
        setLoading(true);
        const res = await fetch(getAppApiUrl(`/api/share/info/${shareId}`));
        if (!res.ok) {
          throw new Error('This shared file has expired or was removed.');
        }
        const data = await res.json();
        setFileInfo(data);
      } catch (err: any) {
        setError(err.message || 'File not found');
      } finally {
        setLoading(false);
      }
    }
    loadInfo();
  }, [shareId]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <button
          onClick={onGoHome}
          className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Notifile</span>
        </button>
        <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono">
          <Smartphone className="h-3.5 w-3.5" />
          <span>Mobile Transfer</span>
        </div>
      </div>

      {/* Main Download Card */}
      <div className="my-auto max-w-md mx-auto w-full">
        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="animate-pulse space-y-4">
              <div className="mx-auto h-12 w-12 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-4 w-48 mx-auto rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-10 w-full rounded-lg bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
        ) : error || !fileInfo ? (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900/40 dark:bg-neutral-900">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-3" />
            <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
              File Link Expired
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              This transfer link is no longer valid. Files are automatically cleared after 30 minutes
              to protect your data privacy.
            </p>
            <button
              onClick={onGoHome}
              className="mt-6 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900"
            >
              Go to Notifile Home
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-md dark:border-neutral-800 dark:bg-neutral-900 space-y-6">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mb-3 shadow-inner">
                <FileText className="h-7 w-7" />
              </div>
              <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white break-words">
                {fileInfo.fileName}
              </h2>
              <div className="mt-1 flex items-center justify-center gap-2 text-xs text-neutral-500 font-mono tabular-nums">
                <span>{formatBytes(fileInfo.size)}</span>
                <span aria-hidden="true">·</span>
                <span>{fileInfo.mimeType.split('/')[1]?.toUpperCase() || 'DOCUMENT'}</span>
              </div>
            </div>

            {/* Direct download button for phone */}
            <a
              href={getAppApiUrl(`/api/share/download/${fileInfo.id}`)}
              download={fileInfo.fileName}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all"
            >
              <Download className="h-5 w-5" />
              <span>Download File to Phone</span>
            </a>

            {/* In-browser preview if image or pdf */}
            {fileInfo.mimeType.startsWith('image/') && (
              <div className="rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
                <img
                  src={getAppApiUrl(`/api/share/download/${fileInfo.id}`)}
                  alt="Preview"
                  className="max-h-60 w-full rounded object-contain"
                />
              </div>
            )}

            {/* Transfer security notice */}
            <div className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500 dark:bg-neutral-950/60 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Private Ephemeral Transfer</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                This document was sent from your desktop. All transfer caches are permanently wiped.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-neutral-400 pt-4">
        Powered by Notifile · Document & Image Powerhouse
      </div>
    </div>
  );
};
