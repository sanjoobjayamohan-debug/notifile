import React from 'react';
import {
  FileText,
  Search,
  Moon,
  Sun,
  User,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { ToolCategory } from '../types';

interface NavbarProps {
  currentCategory: string;
  onSelectCategory: (cat: string) => void;
  onOpenSearch: () => void;
  onOpenPricing: () => void;
  onOpenAuth: () => void;
  onOpenDashboard: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  user: { email: string; name: string } | null;
  onHomeClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentCategory,
  onSelectCategory,
  onOpenSearch,
  onOpenPricing,
  onOpenAuth,
  onOpenDashboard,
  isDark,
  onToggleTheme,
  user,
  onHomeClick,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navLinks = [
    { label: 'All Tools', id: 'all' },
    { label: 'PDF', id: 'pdf-organize' },
    { label: 'Images', id: 'image' },
    { label: 'Compress', id: 'compress' },
    { label: 'OCR & Scan', id: 'ocr' },
    { label: 'Convert', id: 'pdf-convert' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single element wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={onHomeClick}
            className="flex items-center gap-2.5 text-left focus:outline-none group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white transition-transform group-hover:scale-105 dark:bg-neutral-100 dark:text-neutral-900 shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                Notifile
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: 4-6 clean text navigation links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
          {navLinks.map((item) => {
            const isActive = currentCategory === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectCategory(item.id);
                  onHomeClick();
                }}
                className={`transition-colors py-1 relative text-sm ${
                  isActive
                    ? 'text-neutral-950 font-semibold dark:text-white'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white rounded-full" />
                )}
              </button>
            );
          })}
          <button
            onClick={onOpenPricing}
            className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            Pricing
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions & search trigger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search Ctrl+K trigger */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-500 hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-700 transition-colors"
            title="Search tools (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search tools</span>
            <kbd className="hidden sm:inline-block rounded bg-neutral-200 px-1 py-0.2 text-[10px] font-mono text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              ⌘K
            </kbd>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle color theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white transition-colors"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* User Sign In / Profile */}
          {user ? (
            <button
              onClick={onOpenDashboard}
              className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 transition-colors"
            >
              <div className="h-5 w-5 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 flex items-center justify-center text-[10px] font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline max-w-[100px] truncate">{user.name}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="rounded-lg bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap shadow-sm"
            >
              Sign In
            </button>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-col gap-2">
            {navLinks.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelectCategory(item.id);
                  onHomeClick();
                  setMobileMenuOpen(false);
                }}
                className={`text-left px-3 py-2 rounded-md text-sm font-medium ${
                  currentCategory === item.id
                    ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-white'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                onOpenPricing();
                setMobileMenuOpen(false);
              }}
              className="text-left px-3 py-2 rounded-md text-sm font-medium text-neutral-600 dark:text-neutral-400"
            >
              Pricing Plans
            </button>
            {user && (
              <button
                onClick={() => {
                  onOpenDashboard();
                  setMobileMenuOpen(false);
                }}
                className="text-left px-3 py-2 rounded-md text-sm font-medium text-neutral-600 dark:text-neutral-400"
              >
                User Workspace & Settings
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
