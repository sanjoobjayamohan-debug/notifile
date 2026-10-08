import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Send,
  Mail,
  QrCode,
  FileText,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileSize: number;
  shareUrl: string;
  onOpenQR: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  fileName,
  fileSize,
  shareUrl,
  onOpenQR,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Download ${fileName} - Notifile`,
          text: `Here is the processed document "${fileName}" on Notifile:`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or not supported
      }
    } else {
      handleCopy();
    }
  };

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `Download "${fileName}" on Notifile:\n${shareUrl}`
  )}`;

  const emailUrl = `mailto:?subject=${encodeURIComponent(
    `Document: ${fileName}`
  )}&body=${encodeURIComponent(
    `Hi,\n\nHere is your processed document from Notifile:\n${fileName} (${formatBytes(
      fileSize
    )})\n\nDownload Link:\n${shareUrl}\n\nNote: Link is valid for 30 minutes.`
  )}`;

  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
    shareUrl
  )}&text=${encodeURIComponent(`Download ${fileName} (${formatBytes(fileSize)})`)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:p-7">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shadow-sm">
            <Share2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">
              Share Document
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Send download link to phone, colleagues, or apps
            </p>
          </div>
        </div>

        {/* File Details card */}
        <div className="mb-5 flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="flex items-center gap-2.5 truncate mr-2">
            <FileText className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="font-semibold text-xs text-neutral-900 dark:text-white truncate">
              {fileName}
            </span>
          </div>
          <span className="font-mono text-xs text-neutral-500 tabular-nums shrink-0">
            {formatBytes(fileSize)}
          </span>
        </div>

        {/* Share Link with Copy Button */}
        <div className="mb-5 space-y-1.5">
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Direct Download Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 font-mono"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Quick Social / Mobile channels */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
            Share via Channels
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white p-2.5 text-xs font-medium text-neutral-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-emerald-950/40 transition-colors"
            >
              <Send className="h-4 w-4 text-emerald-600" />
              <span>WhatsApp</span>
            </a>

            <a
              href={emailUrl}
              className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white p-2.5 text-xs font-medium text-neutral-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-blue-950/40 transition-colors"
            >
              <Mail className="h-4 w-4 text-blue-600" />
              <span>Email</span>
            </a>

            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white p-2.5 text-xs font-medium text-neutral-700 hover:border-sky-500 hover:bg-sky-50 hover:text-sky-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-sky-950/40 transition-colors"
            >
              <Send className="h-4 w-4 text-sky-500" />
              <span>Telegram</span>
            </a>

            <button
              onClick={() => {
                onClose();
                onOpenQR();
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 transition-colors"
            >
              <QrCode className="h-4 w-4 text-blue-600" />
              <span>QR Code Phone</span>
            </button>
          </div>
        </div>

        {/* Native mobile share if supported */}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-100 py-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              <span>More Sharing Options (System Dialog)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
