import React from 'react';
import { Coins, X } from 'lucide-react';

interface InsufficientBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuyCredits: () => void;
  currentBalance: number;
  requiredCredits: number;
}

export const InsufficientBalanceModal: React.FC<InsufficientBalanceModalProps> = ({
  isOpen,
  onClose,
  onBuyCredits,
  currentBalance,
  requiredCredits,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
          <Coins className="h-7 w-7" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Insufficient credits</h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Choose a credit pack to continue, or use an active team plan.</p>
        </div>
        <div className="rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-950">
          <div className="flex justify-between"><span className="text-neutral-500">Current balance</span><strong>{currentBalance.toLocaleString()} credits</strong></div>
          <div className="mt-2 flex justify-between"><span className="text-neutral-500">Required</span><strong>{requiredCredits.toLocaleString()} credits</strong></div>
        </div>
        <button onClick={onBuyCredits} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700">Buy Credits</button>
      </div>
    </div>
  );
};
