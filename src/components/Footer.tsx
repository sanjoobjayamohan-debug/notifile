import React from 'react';
import { FileText, Shield, Zap, Lock, Heart } from 'lucide-react';

interface FooterProps {
  onSelectCategory: (cat: string) => void;
  onOpenPricing: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectCategory, onOpenPricing }) => {
  return (
    <footer className="border-t border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand Col */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
                <FileText className="h-4 w-4" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                Notifile
              </span>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mb-4 leading-relaxed">
              All-in-one document and image utility suite. Convert, compress, edit, organize, and
              protect your files directly in your browser with privacy by design.
            </p>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                Browser sandbox privacy
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Zero waiting queues
              </span>
            </div>
          </div>

          {/* Col 1: PDF Tools */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white mb-3">
              PDF Utilities
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => onSelectCategory('pdf-organize')}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Merge PDF
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('pdf-organize')}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Split PDF
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('compress')}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Compress PDF
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('pdf-edit')}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Rotate & Organize
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('pdf-edit')}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Add Watermark
                </button>
              </li>
            </ul>
          </div>

          {/* Col 2: Image & Scans */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white mb-3">
              Images & OCR
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => onSelectCategory('image')}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Compress Images
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('image')}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Resize & Crop
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('convert-to-pdf')}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  JPG / PNG to PDF
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('ocr')}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Multi-Language OCR
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('ocr')}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Malayalam & Hindi OCR
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Company & Privacy */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-white mb-3">
              Platform
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={onOpenPricing}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Pricing & Plans
                </button>
              </li>
              <li>
                <span className="text-neutral-400">Security Architecture</span>
              </li>
              <li>
                <span className="text-neutral-400">Privacy Policy</span>
              </li>
              <li>
                <span className="text-neutral-400">Terms of Service</span>
              </li>
              <li>
                <span className="text-neutral-400">API Documentation</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between border-t border-neutral-100 pt-6 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-500">
          <div>
            © {new Date().getFullYear()} Notifile. Simple, private, high-performance file tools.
          </div>
          <div className="flex items-center gap-4 mt-3 sm:mt-0">
            <span>Client-side execution</span>
            <span aria-hidden="true">·</span>
            <span>No data retention</span>
            <span aria-hidden="true">·</span>
            <span>Encrypted in memory</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
