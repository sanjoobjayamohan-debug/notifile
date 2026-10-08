import React from 'react';
import { X, AlertTriangle, Clock, Wallet, ArrowRight, ShieldAlert } from 'lucide-react';
import { USAGE_CONFIG } from '../services/usageEngine';

interface PlanEndedNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'timeout' | 'plan_exhausted' | 'insufficient_balance';
  timeoutSecondsRemaining: number;
  onOpenRecharge: () => void;
  toolName?: string;
}

export const PlanEndedNotificationModal: React.FC<PlanEndedNotificationModalProps> = ({
  isOpen,
  onClose,
  reason,
  timeoutSecondsRemaining,
  onOpenRecharge,
  toolName,
}) => {
  if (!isOpen) return null;

  const formatSeconds = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl dark:border-red-900/60 dark:bg-neutral-900 text-center space-y-4">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Warning Icon Badge */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 shadow-inner">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <div>
          <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
            Plan Quota Ended · Activity Stopped
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {toolName ? `Operation "${toolName}" was paused` : 'Current operation was paused'}{' '}
            because your entitlement limit has been reached.
          </p>
        </div>

        {/* Detailed context box */}
        {reason === 'timeout' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 space-y-1">
            <div className="flex items-center justify-center gap-1.5 font-bold">
              <Clock className="h-4 w-4 text-amber-600" />
              <span>20-Minute Cooldown Window Active</span>
            </div>
            <p className="text-[11px] opacity-90">
              First 10 free uses completed. Time remaining until 5 additional free uses unlock:
            </p>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-800 dark:text-amber-300 pt-1">
              {formatSeconds(timeoutSecondsRemaining)}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200 space-y-1">
            <div className="font-bold flex items-center justify-center gap-1.5">
              <Wallet className="h-4 w-4 text-blue-600" />
              <span>Free Plan Completely Delivered</span>
            </div>
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              All 15 free activities have been consumed. Recharge your wallet (min ₹
              {USAGE_CONFIG.MINIMUM_RECHARGE_INR}) to unlock unlimited operations with 2% discount.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => {
              onClose();
              onOpenRecharge();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-all active:scale-98"
          >
            <Wallet className="h-4 w-4" />
            <span>Recharge Wallet (Min ₹{USAGE_CONFIG.MINIMUM_RECHARGE_INR} · 2% OFF)</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white"
          >
            I'll Wait for Cooldown
          </button>
        </div>
      </div>
    </div>
  );
};
