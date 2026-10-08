import React, { useState, useRef } from 'react';
import {
  Upload,
  ArrowRight,
  FolderOpen,
  X,
  GitMerge,
  Scissors,
  Minimize2,
  FileUp,
  FileText,
  Table,
  Presentation,
  Shield,
  Lock,
  Droplets,
  Layers,
  Binary,
  Bookmark,
  Crop,
  Tag,
  Image,
  FlipHorizontal,
  Sliders,
  Heading,
  Grid,
  Hash,
  FileSignature,
  Wrench,
  Maximize,
  RotateCw,
  Eraser,
  Info,
  Wand2,
  ListOrdered,
} from 'lucide-react';
import { ToolDef } from '../types';
import { ALL_TOOLS } from '../data/tools';

interface MainDashboardProps {
  onSelectTool: (tool: ToolDef) => void;
  onViewAllTools: () => void;
  userName?: string;
  creditBalance: number;
  hasUnlimitedAccess: boolean;
  onOpenPricing: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  onSelectTool,
  onViewAllTools,
  userName = 'David',
  creditBalance,
  hasUnlimitedAccess,
  onOpenPricing,
}) => {
  const [activeTaskVisible, setActiveTaskVisible] = useState(true);
  const [activeTaskProgress, setActiveTaskProgress] = useState(68);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleHeroDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const tool = ALL_TOOLS.find((t) => t.id === 'compress-pdf') || ALL_TOOLS[0];
      onSelectTool(tool);
    }
  };

  const handleHeroFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const tool = ALL_TOOLS.find((t) => t.id === 'compress-pdf') || ALL_TOOLS[0];
      onSelectTool(tool);
    }
  };

  // Quick-access tools
  const quickTools = [
    {
      id: 'merge-pdf',
      name: 'Merge PDF',
      description: 'Combine multiple PDFs into one.',
      icon: GitMerge,
      colorBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    },
    {
      id: 'split-pdf',
      name: 'Split PDF',
      description: 'Extract pages or split by bookmarks.',
      icon: Scissors,
      colorBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
    },
    {
      id: 'rearrange-pdf',
      name: 'Rearrange PDF',
      description: 'Drag pages into a new order and remove pages.',
      icon: ListOrdered,
      colorBg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
    },
    {
      id: 'edit-pdf',
      name: 'Edit PDF Text',
      description: 'Replace detected text or insert text using bundled fonts.',
      icon: FileText,
      colorBg: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
    },
    {
      id: 'compress-pdf',
      name: 'Compress PDF',
      description: 'Reduce file size without losing quality.',
      icon: Minimize2,
      colorBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    },
    {
      id: 'jpg-to-pdf',
      name: 'Convert to PDF',
      description: 'From Word, Excel, JPG and more.',
      icon: FileUp,
      colorBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
    },
    {
      id: 'pdf-to-word',
      name: 'PDF to Word',
      description: 'Convert PDF to editable Word document.',
      icon: FileText,
      colorBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
    },
    {
      id: 'pdf-to-excel',
      name: 'PDF to Excel',
      description: 'Convert PDF to editable Excel spreadsheet.',
      icon: Table,
      colorBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    },
    {
      id: 'pdf-to-ppt',
      name: 'PDF to PowerPoint',
      description: 'Convert PDF to editable PowerPoint presentation.',
      icon: Presentation,
      colorBg: 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400',
    },
  ];

  // More tools 3-column dense items
  const moreToolsItems = [
    { id: 'remove-bg', name: 'Remove Background (HD)', icon: Wand2, color: 'text-amber-500' },
    { id: 'bates-numbering', name: 'Bates Numbering', icon: Binary, color: 'text-purple-500' },
    { id: 'create-bookmarks', name: 'Create Bookmarks', icon: Bookmark, color: 'text-blue-500' },
    { id: 'crop-image', name: 'Crop', icon: Crop, color: 'text-blue-500' },
    { id: 'edit-metadata', name: 'Edit Metadata', icon: Tag, color: 'text-purple-500' },
    { id: 'extract-pages', name: 'Extract Images', icon: Image, color: 'text-pink-500' },
    { id: 'rotate-image', name: 'Flip', icon: FlipHorizontal, color: 'text-purple-500' },
    { id: 'grayscale-image', name: 'Grayscale', icon: Sliders, color: 'text-slate-500' },
    { id: 'page-numbers', name: 'Header & Footer', icon: Heading, color: 'text-blue-500' },
    { id: 'flatten-pdf', name: 'N-up', icon: Grid, color: 'text-purple-500' },
    { id: 'page-numbers', name: 'Page Numbers', icon: Hash, color: 'text-blue-500' },
    { id: 'edit-metadata', name: 'Rename', icon: FileSignature, color: 'text-purple-500' },
    { id: 'enhance-image', name: 'Repair', icon: Wrench, color: 'text-blue-500' },
    { id: 'resize-image', name: 'Resize', icon: Maximize, color: 'text-amber-500' },
    { id: 'rotate-pdf', name: 'Rotate', icon: RotateCw, color: 'text-teal-500' },
    { id: 'delete-pages', name: 'Remove annotations', icon: Eraser, color: 'text-purple-500', isNew: true },
  ];

  // Security & Automation items
  const securityItems = [
    {
      id: 'protect-pdf',
      name: 'Protect',
      desc: 'Add password protection to your PDF.',
      icon: Shield,
    },
    {
      id: 'unlock-pdf',
      name: 'Unlock',
      desc: 'Remove password protection from PDF.',
      icon: Lock,
    },
    {
      id: 'add-watermark',
      name: 'Watermark',
      desc: 'Add text or image watermark.',
      icon: Droplets,
    },
    {
      id: 'flatten-pdf',
      name: 'Flatten',
      desc: 'Flatten layered PDF files.',
      icon: Layers,
    },
  ];

  const handleToolClick = (toolId: string) => {
    const found = ALL_TOOLS.find((t) => t.id === toolId || t.slug === toolId) || ALL_TOOLS[0];
    onSelectTool(found);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Greeting & Active Task Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
            <span>Good morning, {userName}</span>
            <span role="img" aria-label="wave">👋</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Your all-in-one PDF solution. Edit, convert, compress and do more.
          </p>

          <div className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1 text-xs dark:border-blue-900/60 dark:bg-blue-950/40">
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              {hasUnlimitedAccess ? 'Team Unlimited active' : `${creditBalance.toLocaleString()} credits available`}
            </span>
            {!hasUnlimitedAccess && <button onClick={onOpenPricing} className="font-bold underline underline-offset-2">Buy credits</button>}
          </div>
        </div>

        {/* Active Task Progress Widget matching screenshot */}
        {activeTaskVisible && (
          <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 shrink-0">
            {/* Circular Gauge */}
            <div className="relative flex h-12 w-12 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-neutral-100 dark:text-neutral-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-blue-600 transition-all duration-500"
                  strokeDasharray={`${activeTaskProgress}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[11px] font-bold text-neutral-900 dark:text-white font-mono tabular-nums">
                {activeTaskProgress}%
              </span>
            </div>

            {/* Task text info */}
            <div className="min-w-[180px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                  Compressing Document.pdf
                </span>
                <button
                  onClick={() => setActiveTaskVisible(false)}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white ml-2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
                <span>Processing...</span>
                <span className="font-mono tabular-nums">2.4 MB / 3.5 MB</span>
              </div>
              <div className="mt-1.5 h-1 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${activeTaskProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Drop Your PDF Hero Zone matching screenshot */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleHeroDrop}
        className="relative flex flex-col md:flex-row items-center justify-between rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-6 sm:p-8 dark:border-blue-900/50 dark:bg-blue-950/20"
      >
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left mb-4 md:mb-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 shadow-inner">
            <Upload className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
              Drop your PDF here
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:underline font-medium dark:text-blue-400"
              >
                browse files
              </button>{' '}
              from your device
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*,.docx,.txt"
            onChange={handleHeroFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
          >
            <FolderOpen className="h-4 w-4" />
            <span>Choose Files</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span>Supports PDF files</span>
            <span aria-hidden="true">·</span>
          </div>
        </div>
      </div>

      {/* Quick Tools Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
            Quick Tools
          </h2>
          <button
            onClick={onViewAllTools}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
          >
            <span>View all tools</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
          The most commonly used tools, all in one place.
        </p>

        {/* 8 Cards in 4x2 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickTools.map((qt) => {
            const IconComponent = qt.icon;
            return (
              <div
                key={qt.id}
                onClick={() => handleToolClick(qt.id)}
                className="group relative flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-2xs hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 cursor-pointer transition-all duration-200"
              >
                <div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl mb-4 ${qt.colorBg} shadow-2xs`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-neutral-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {qt.name}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {qt.description}
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Sections: More Tools + Security & Automation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* More Tools (2 columns width on large screen) */}
        <div className="lg:col-span-2 rounded-2xl border border-neutral-200/80 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="font-display text-base font-bold text-neutral-900 dark:text-white">
            More Tools
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
            Explore additional features to get more done.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
            {moreToolsItems.map((item) => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.name}
                  onClick={() => handleToolClick(item.id)}
                  className="flex items-center gap-2.5 text-xs text-neutral-700 hover:text-blue-600 dark:text-neutral-300 dark:hover:text-blue-400 cursor-pointer group transition-colors"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/60">
                    <IconComp className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <span className="font-medium truncate">{item.name}</span>
                  {item.isNew && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      New
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Security & Automation (1 column width on large screen) */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="font-display text-base font-bold text-neutral-900 dark:text-white">
            Security & Automation
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
            Keep your files safe and get more done automatically.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {securityItems.map((sec) => {
              const SecIcon = sec.icon;
              return (
                <div
                  key={sec.name}
                  onClick={() => handleToolClick(sec.id)}
                  className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mt-0.5">
                    <SecIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                      {sec.name}
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal">
                      {sec.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
