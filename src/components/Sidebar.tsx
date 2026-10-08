import React from 'react';
import {
  FileText,
  Home,
  LayoutGrid,
  Clock,
  Star,
  GitMerge,
  Scissors,
  Minimize2,
  RefreshCw,
  Layers,
  Shield,
  Bot,
  QrCode,
  ArrowRight,
  User,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  onOpenQRModal: () => void;
  onOpenDashboard?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onOpenQRModal,
  onOpenDashboard,
}) => {
  const mainNav = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'all', label: 'All Tools', icon: LayoutGrid },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'favorites', label: 'Favorites', icon: Star },
  ];

  const categories = [
    { id: 'merge', label: 'Merge', icon: GitMerge },
    { id: 'split', label: 'Split', icon: Scissors },
    { id: 'compress', label: 'Compress', icon: Minimize2 },
    { id: 'convert', label: 'Convert', icon: RefreshCw },
    { id: 'organize', label: 'Organize', icon: Layers },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'automate', label: 'Automate', icon: Bot },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-900 flex flex-col justify-between p-4 h-screen sticky top-0 overflow-y-auto">
      <div>
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5 px-3 py-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
              Notifile
            </span>
            <span className="block text-[11px] font-medium text-neutral-400 -mt-1">
              PDF Toolkit
            </span>
          </div>
        </div>

        {/* Primary Navigation */}
        <div className="space-y-1 mb-5">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-950/60 dark:text-blue-400'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {onOpenDashboard && (
            <button
              onClick={onOpenDashboard}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
            >
              <User className="h-4 w-4 text-neutral-400" />
              <span>Account & Dashboard</span>
            </button>
          )}
        </div>

        {/* Categories Section */}
        <div>
          <div className="px-3.5 mb-2 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
            Categories
          </div>
          <div className="space-y-0.5">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = currentView === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => onSelectView(cat.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-950/60 dark:text-blue-400'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 text-neutral-400 group-hover:text-neutral-600" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom QR Code Card */}
      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/40">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm mb-2.5">
          <QrCode className="h-4 w-4" />
        </div>
        <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
          Generate QR Code
        </h4>
        <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal">
          Turn files, links or text into QR
        </p>
        <button
          onClick={onOpenQRModal}
          className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-xl bg-blue-600 py-1.5 px-3 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <span>Create QR</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </aside>
  );
};
