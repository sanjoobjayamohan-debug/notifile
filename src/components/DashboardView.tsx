import React, { useState } from 'react';
import {
  FileText,
  Clock,
  HardDrive,
  Trash2,
  Shield,
  Star,
  ArrowRight,
  LogOut,
  Sliders,
  CheckCircle2,
  Wallet,
  Plus,
  Tag,
  QrCode,
  ShieldCheck,
  Zap,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { ActivityItem, ToolDef } from '../types';
import { ALL_TOOLS } from '../data/tools';
import { BillingState, isUnlimitedActive } from '../services/billingService';
import { exportActivityAsCSV, exportActivityAsPDF } from '../services/activityExportService';
import { TaskSuccessBanner } from './TaskSuccessBanner';

interface DashboardViewProps {
  user: { email: string; name: string };
  activities: ActivityItem[];
  favorites: string[];
  onSelectTool: (tool: ToolDef) => void;
  onClearHistory: () => void;
  onSignOut: () => void;
  onBackToTools: () => void;
  billing: BillingState;
  onOpenPricing: () => void;
  currentPlan?: string;
  latestActivity?: ActivityItem | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  activities,
  favorites,
  onSelectTool,
  onClearHistory,
  onSignOut,
  onBackToTools,
  billing,
  onOpenPricing,
  currentPlan = 'free_tier',
  latestActivity,
}) => {
  const [retentionPeriod, setRetentionPeriod] = useState<'1h' | '24h' | 'immediate'>('1h');
  const [saveToast, setSaveToast] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalSavedBytes = activities.reduce((acc, act) => {
    if (act.resultSize && act.originalSize > act.resultSize) {
      return acc + (act.originalSize - act.resultSize);
    }
    return acc;
  }, 0);

  const favoriteTools = favorites
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter((t): t is ToolDef => Boolean(t));

  const handleSaveSettings = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      await exportActivityAsPDF(activities, user, billing.creditBalance);
    } catch (e) {
      console.error('Error generating PDF report:', e);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const activeTeam = isUnlimitedActive(billing) ? billing.teamSubscription : null;
  const nextCreditExpiry = billing.creditLots
    .filter((lot) => lot.remaining > 0 && lot.expiresAt !== null)
    .sort((first, second) => (first.expiresAt || 0) - (second.expiresAt || 0))[0]?.expiresAt;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in space-y-6">
      {/* Subtle Framer Motion Success Animation Banner if a task was just completed */}
      {latestActivity && <TaskSuccessBanner latestActivity={latestActivity} />}

      {/* Top Bar with user info & back button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <div>
          <button
            onClick={onBackToTools}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-2 inline-flex items-center gap-1.5 transition-colors"
          >
            ← Return to Tool Catalog
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
            Account & Activity Dashboard
          </h1>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Signed in as <span className="font-semibold text-neutral-900 dark:text-white">{user.email}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Credit balance and team access */}
      <div className="rounded-2xl border-2 border-blue-600/30 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 p-6 shadow-sm dark:border-blue-500/30 dark:from-neutral-900 dark:via-neutral-900 dark:to-blue-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">Credits</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {activeTeam ? `${activeTeam.teamName} · unlimited plan active` : 'Use credits when you need flexibility.'}
                </p>
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-extrabold text-blue-700 dark:text-blue-300 font-mono tabular-nums">
                {billing.creditBalance.toLocaleString()}
              </span>
              <span className="text-xs text-neutral-500 font-medium">credits available</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
              <span>Credits used: <strong>{billing.creditsUsed.toLocaleString()}</strong></span>
              <span>Credits purchased: <strong>{billing.creditsPurchased.toLocaleString()}</strong></span>
              {billing.lastPurchaseAt && <span>Last purchase: <strong>{new Date(billing.lastPurchaseAt).toLocaleDateString()}</strong></span>}
              {nextCreditExpiry && <span>Next credit expiry: <strong>{new Date(nextCreditExpiry).toLocaleDateString()}</strong></span>}
              {activeTeam && <span>Expires: <strong>{new Date(activeTeam.expiresAt).toLocaleDateString()}</strong></span>}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={onOpenPricing}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:scale-98 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Buy Credits</span>
            </button>
          </div>
        </div>

      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 text-base font-bold text-neutral-900 dark:text-white">Recent credit transactions</h2>
        {billing.transactions.length === 0 ? (
          <p className="py-5 text-center text-sm text-neutral-400">Your credit activity will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="border-b border-neutral-100 text-neutral-400 dark:border-neutral-800">
                <tr><th className="pb-3 font-semibold">Date</th><th className="pb-3 font-semibold">Tool / Activity</th><th className="pb-3 font-semibold">Credits</th><th className="pb-3 text-right font-semibold">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {billing.transactions.slice(0, 8).map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="py-3 text-neutral-500">{new Date(transaction.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 font-medium text-neutral-800 dark:text-neutral-200">{transaction.description}</td>
                    <td className={`py-3 font-mono font-semibold ${transaction.credits > 0 ? 'text-emerald-600' : 'text-neutral-700 dark:text-neutral-300'}`}>{transaction.credits > 0 ? '+' : ''}{transaction.credits}</td>
                    <td className="py-3 text-right text-emerald-600">{transaction.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Files Processed
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white font-mono tabular-nums">
            {activities.length}
          </div>
          <div className="mt-1 text-xs text-neutral-400">Total lifetime operations</div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Storage Space Saved
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            {formatBytes(totalSavedBytes)}
          </div>
          <div className="mt-1 text-xs text-neutral-400">Across PDF & image compression</div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Credits Used
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white font-mono tabular-nums">
            {billing.creditsUsed.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-neutral-400">Credits spent on completed work</div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Privacy Policy
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            Zero-Retention
          </div>
          <div className="mt-1 text-xs text-neutral-400">Browser sandbox memory active</div>
        </div>
      </div>

      {/* Recent Activity Table with CSV & PDF Export */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-500" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              Recent File Operations
            </h2>
            <span className="text-xs text-neutral-400 font-mono">({activities.length})</span>
          </div>

          {/* Export and Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportActivityAsCSV(activities, user)}
              disabled={activities.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40 disabled:pointer-events-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-emerald-950/40 transition-colors"
              title="Download activity log as a CSV spreadsheet"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={activities.length === 0 || isExportingPdf}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 disabled:pointer-events-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-blue-950/40 transition-colors"
              title="Download activity & spending statement as PDF"
            >
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              <span>{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
            </button>

            {activities.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-xs text-neutral-400 hover:text-red-500 flex items-center gap-1 transition-colors ml-1 px-2 py-1"
                title="Clear local activity history"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-400">
            No file activity yet. Process a PDF or image to see logs, metrics, and export reports here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-100 text-neutral-400 dark:border-neutral-800">
                <tr>
                  <th className="pb-3 font-semibold">File Name</th>
                  <th className="pb-3 font-semibold">Tool</th>
                  <th className="pb-3 font-semibold">Original Size</th>
                  <th className="pb-3 font-semibold">Result Size</th>
                  <th className="pb-3 font-semibold">Credits Used</th>
                  <th className="pb-3 font-semibold">Time</th>
                  <th className="pb-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {activities.map((act) => (
                  <tr key={act.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 font-medium text-neutral-900 dark:text-white max-w-xs truncate">
                      {act.fileName}
                    </td>
                    <td className="py-3 text-neutral-600 dark:text-neutral-300 font-medium">
                      {act.toolName}
                    </td>
                    <td className="py-3 font-mono text-neutral-500 tabular-nums">
                      {formatBytes(act.originalSize)}
                    </td>
                    <td className="py-3 font-mono text-neutral-500 tabular-nums">
                      {act.resultSize ? formatBytes(act.resultSize) : '—'}
                    </td>
                    <td className="py-3 font-mono text-neutral-700 dark:text-neutral-300 font-semibold tabular-nums">
                      {act.creditsCharged || 0}
                    </td>
                    <td className="py-3 text-neutral-400 whitespace-nowrap">
                      {new Date(act.timestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}{' '}
                      {new Date(act.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Starred Shortcuts */}
      {favoriteTools.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              Your Starred Shortcuts ({favoriteTools.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {favoriteTools.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTool(t)}
                className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 text-left hover:border-blue-500 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-blue-600 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div>
                  <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                    {t.name}
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate max-w-[200px]">
                    {t.description}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-neutral-400 shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Security & Retention Settings */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-2">
          Privacy & Storage Lifecycle
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
          Configure how long temporary process caches and session logs remain in your local browser sandbox.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
          {[
            { id: 'immediate', label: 'Immediate Erasure', desc: 'Clear right after download' },
            { id: '1h', label: '1 Hour (Default)', desc: 'Auto-delete after 60 mins' },
            { id: '24h', label: '24 Hours', desc: 'Retain for current workday' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setRetentionPeriod(opt.id as any)}
              className={`rounded-xl border p-3 text-left text-xs transition-colors ${
                retentionPeriod === opt.id
                  ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                  : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
              }`}
            >
              <div className="font-semibold">{opt.label}</div>
              <div className="text-[11px] opacity-75 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSaveSettings}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-colors"
          >
            Save Lifecycle Preferences
          </button>
          {saveToast && (
            <span className="text-xs text-emerald-600 font-semibold animate-fade-in">
              Preferences updated!
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
