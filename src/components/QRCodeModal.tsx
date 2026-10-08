import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Smartphone,
  Copy,
  Check,
  Download,
  Share2,
  Clock,
  Upload,
  FileText,
  ExternalLink,
  Shield,
  Loader2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { getAppApiUrl } from '../services/apiUrls';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If sharing a specific processed file:
  initialFile?: {
    name: string;
    blob?: Blob;
    blobUrl?: string;
    size?: number;
  };
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  initialFile,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'text'>('file');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom generator states
  const [customUrl, setCustomUrl] = useState('');
  const [customText, setCustomText] = useState('');
  const [customFile, setCustomFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialFile && initialFile.blob) {
      setActiveTab('file');
      uploadAndGenerateQR(initialFile.blob, initialFile.name);
    } else {
      // Default to link/file generator
      const defaultUrl = window.location.origin;
      setShareUrl(defaultUrl);
      generateQRCodeImage(defaultUrl);
    }
  }, [isOpen, initialFile]);

  const generateQRCodeImage = async (textToEncode: string) => {
    try {
      setIsGenerating(true);
      const dataUrl = await QRCode.toDataURL(textToEncode, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUrl);
      setShareUrl(textToEncode);
    } catch (err: any) {
      console.error('QR generation error:', err);
      setErrorMsg('Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  const uploadAndGenerateQR = async (blob: Blob, fileName: string) => {
    try {
      setIsGenerating(true);
      setErrorMsg(null);

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const base64Data = await base64Promise;

      const response = await fetch(getAppApiUrl('/api/share/upload'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          base64Data,
          mimeType: blob.type,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create mobile share link');
      }

      const data = await response.json();
      const targetUrl = `${window.location.origin}/share/${data.id}`;
      setShareUrl(targetUrl);
      await generateQRCodeImage(targetUrl);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Could not upload file for sharing. Generating local link.');
      // Fallback to current URL with hash
      const fallbackUrl = `${window.location.origin}#download-${encodeURIComponent(fileName)}`;
      generateQRCodeImage(fallbackUrl);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setCustomFile(file);
      uploadAndGenerateQR(file, file.name);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    let url = customUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    generateQRCodeImage(url);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    generateQRCodeImage(customText.trim());
  };

  const copyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQrImage = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qrcode_${Date.now()}.png`;
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
              {initialFile ? 'Take File to Phone' : 'Generate QR Code'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {initialFile
                ? 'Scan with your smartphone camera to download instantly'
                : 'Turn documents, web links, or text into high-res QR codes'}
            </p>
          </div>
        </div>

        {/* Generator Tabs if not opened for a specific file */}
        {!initialFile && (
          <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-6">
            <button
              onClick={() => setActiveTab('file')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'file'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
              }`}
            >
              Share Any File
            </button>
            <button
              onClick={() => setActiveTab('url')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'url'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
              }`}
            >
              Website URL
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
              }`}
            >
              Plain Text / Notes
            </button>
          </div>
        )}

        {/* Tab Content for custom URL / Text */}
        {!initialFile && activeTab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="mb-4 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.com/document.pdf"
                className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Update QR
              </button>
            </div>
          </form>
        )}

        {!initialFile && activeTab === 'text' && (
          <form onSubmit={handleTextSubmit} className="mb-4 space-y-2">
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type or paste any text..."
                className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              />
              <button
                type="submit"
                className="self-end rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Update QR
              </button>
            </div>
          </form>
        )}

        {!initialFile && activeTab === 'file' && !customFile && (
          <div className="mb-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center hover:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950">
              <Upload className="h-5 w-5 text-neutral-400 mb-1" />
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Choose a PDF or file to share to phone
              </span>
              <input type="file" onChange={handleCustomFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* Main QR Display Card */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-950/60">
          {isGenerating ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-xs text-neutral-500">Preparing secure transfer link...</span>
            </div>
          ) : qrDataUrl ? (
            <div className="space-y-4 text-center">
              <div className="inline-block rounded-xl bg-white p-3 shadow-md border border-neutral-200/80 dark:border-neutral-700">
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="h-52 w-52 sm:h-56 sm:w-56 rounded-lg object-contain"
                />
              </div>

              {/* Instructions badge */}
              <div className="flex items-center justify-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                <Smartphone className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Open your phone's Camera app and point it here</span>
              </div>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-neutral-400">
              No QR code available
            </div>
          )}
        </div>

        {/* File & Expiration details */}
        {(initialFile || customFile) && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-2.5 truncate mr-2">
              <FileText className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="font-medium text-neutral-900 dark:text-white truncate">
                {initialFile?.name || customFile?.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-500 shrink-0">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>Link valid for 30m</span>
            </div>
          </div>
        )}

        {/* Action Buttons: Copy Link & Download QR */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={copyShareLink}
            disabled={!shareUrl}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white py-2 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copied ? 'Link Copied!' : 'Copy Share Link'}</span>
          </button>

          <button
            onClick={downloadQrImage}
            disabled={!qrDataUrl}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 py-2 px-4 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Save QR Image</span>
          </button>
        </div>

        {/* Privacy Note */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
          <Shield className="h-3 w-3 text-emerald-600" />
          <span>Encrypted ephemeral storage · Auto-deleted after 30 minutes</span>
        </div>
      </div>
    </div>
  );
};
