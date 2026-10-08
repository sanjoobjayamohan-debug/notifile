import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Sparkles, X, ArrowUpRight, FileCheck } from 'lucide-react';
import { ActivityItem } from '../types';
import { formatFileSize } from '../services/activityExportService';

interface TaskSuccessBannerProps {
  latestActivity: ActivityItem | null;
  onDismiss?: () => void;
}

export const TaskSuccessBanner: React.FC<TaskSuccessBannerProps> = ({
  latestActivity,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (latestActivity) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onDismiss) onDismiss();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [latestActivity]);

  if (!latestActivity || !isVisible) return null;

  const spaceSaved =
    latestActivity.resultSize && latestActivity.originalSize > latestActivity.resultSize
      ? latestActivity.originalSize - latestActivity.resultSize
      : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/40 dark:via-neutral-900 dark:to-neutral-900"
      >
        {/* Animated Background Ripple Ring */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [1, 1.4, 1.6], opacity: [0.6, 0.2, 0] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'easeOut' }}
          className="absolute -left-6 -top-6 h-28 w-28 rounded-full bg-emerald-400/20 pointer-events-none"
        />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Animated Checkmark Badge */}
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.1 }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="h-5 w-5" />
              </motion.div>
              {/* Particle Sparkle */}
              <motion.span
                initial={{ scale: 0, rotate: 0 }}
                animate={{ scale: [0, 1.2, 1], rotate: [0, 45, 90] }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="absolute -top-1 -right-1 text-amber-500"
              >
                <Sparkles className="h-4 w-4" />
              </motion.span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>Task Completed Successfully</span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </h4>
              </div>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {latestActivity.fileName}
                </span>{' '}
                was processed with{' '}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {latestActivity.toolName}
                </span>
                .
                {spaceSaved > 0 && (
                  <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    Saved {formatFileSize(spaceSaved)}!
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setIsVisible(false);
                if (onDismiss) onDismiss();
              }}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
