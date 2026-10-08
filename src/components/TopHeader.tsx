import React, { useState } from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  CircleHelp,
} from 'lucide-react';

interface TopHeaderProps {
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  user: { email: string; name: string } | null;
  onOpenDashboard: () => void;
  onOpenAuth: () => void;
  onOpenPricing: () => void;
  onOpenHelp: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onOpenSearch,
  onToggleSidebar,
  isDark,
  onToggleTheme,
  user,
  onOpenDashboard,
  onOpenAuth,
  onOpenPricing,
  onOpenHelp,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: '1', title: 'File Compressed', desc: 'Financial_Report_2026.pdf was shrunk by 72%', time: '10m ago' },
    { id: '2', title: 'Mobile Transfer Active', desc: 'Scan code ready for iPhone transfer', time: '25m ago' },
    { id: '3', title: 'Batch Completed', desc: '3 PDF invoices were merged successfully', time: '1h ago' },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-neutral-200/80 bg-white/95 px-4 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95 sm:px-6">
      {/* Left: Mobile hamburger & Global Search bar */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search trigger */}
        <div
          onClick={onOpenSearch}
          className="flex flex-1 items-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3.5 py-2 text-xs text-neutral-500 hover:border-neutral-300 hover:bg-neutral-100/70 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-neutral-400 dark:hover:border-neutral-700 cursor-pointer transition-colors"
        >
          <Search className="h-4 w-4 text-neutral-400 shrink-0" />
          <span className="flex-1 truncate">Search tools...</span>
          <kbd className="hidden sm:inline-block rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-mono text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Pricing link */}
        <button
          onClick={onOpenPricing}
          className="hidden md:inline-flex text-xs font-semibold text-neutral-600 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400 transition-colors"
        >
          Pricing
        </button>
        <button
          onClick={onOpenHelp}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400 transition-colors"
        >
          <CircleHelp className="h-4 w-4" />
          <span>Help</span>
        </button>
        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
          title="Toggle Dark / Light"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-xs">
              3
            </span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 animate-fade-in z-50">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-xs font-bold text-neutral-900 dark:text-white">Notifications</span>
                <span className="text-[10px] text-neutral-400">3 new</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded-lg p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-xs">
                    <div className="font-semibold text-neutral-800 dark:text-neutral-200">{n.title}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{n.desc}</div>
                    <div className="text-[10px] text-neutral-400 mt-1">{n.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User avatar circle -> Opens Account & Activity Dashboard */}
        {user ? (
          <button
            onClick={onOpenDashboard}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-sm"
            title={`${user.name} - Account & Activity Dashboard`}
          >
            {user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'DS'}
          </button>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-xs font-bold text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 transition-colors"
            title="Sign in"
          >
            DS
          </button>
        )}
      </div>
    </header>
  );
};
