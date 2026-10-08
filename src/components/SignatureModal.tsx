import React, { useRef, useState, useEffect } from 'react';
import { X, Check, RotateCcw, PenTool, Type } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave }) => {
  const [tab, setTab] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState<'cursive' | 'serif'>('cursive');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (isOpen && tab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [isOpen, tab]);

  if (!isOpen) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleApply = () => {
    if (tab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
      onClose();
    } else {
      if (!typedName.trim()) return;
      // Render typed text onto an offscreen canvas
      const offscreen = document.createElement('canvas');
      offscreen.width = 400;
      offscreen.height = 120;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, offscreen.width, offscreen.height);
      ctx.font = selectedFont === 'cursive' ? 'italic 44px "Brush Script MT", "Caveat", cursive' : 'italic 38px Georgia, serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, offscreen.width / 2, offscreen.height / 2);

      const dataUrl = offscreen.toDataURL('image/png');
      onSave(dataUrl);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">
          Create Signature
        </h3>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800 mb-4">
          <button
            onClick={() => setTab('draw')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              tab === 'draw'
                ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-900 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
            <span>Draw Signature</span>
          </button>
          <button
            onClick={() => setTab('type')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              tab === 'type'
                ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-900 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
            }`}
          >
            <Type className="h-3.5 w-3.5" />
            <span>Type Signature</span>
          </button>
        </div>

        {tab === 'draw' ? (
          <div>
            <div className="relative rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={380}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-40 cursor-crosshair touch-none"
              />
              <button
                onClick={clearCanvas}
                className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-semibold text-neutral-600 shadow-xs hover:bg-white dark:bg-neutral-800/90 dark:text-neutral-300"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear</span>
              </button>
            </div>
            <p className="mt-2 text-[11px] text-neutral-400 text-center">
              Draw your handwritten signature using your mouse, trackpad, or touch screen.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Type your full name..."
              className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {typedName && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center dark:border-neutral-800 dark:bg-neutral-950">
                <span
                  className={`text-2xl text-neutral-900 dark:text-white ${
                    selectedFont === 'cursive' ? 'italic font-serif' : 'font-serif'
                  }`}
                  style={{ fontFamily: selectedFont === 'cursive' ? 'cursive, "Brush Script MT"' : 'Georgia, serif' }}
                >
                  {typedName}
                </span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedFont('cursive')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  selectedFont === 'cursive'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-400'
                }`}
              >
                Calligraphy Script
              </button>
              <button
                type="button"
                onClick={() => setSelectedFont('serif')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  selectedFont === 'serif'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-400'
                }`}
              >
                Classic Serif
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={tab === 'draw' ? !hasDrawn : !typedName.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm"
          >
            Add to Document
          </button>
        </div>
      </div>
    </div>
  );
};
