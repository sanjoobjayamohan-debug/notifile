import React from 'react';
import { ArrowRight, Upload, Shield, Zap, FileText, CheckCircle2 } from 'lucide-react';
import { ALL_TOOLS } from '../data/tools';
import { ToolDef } from '../types';

interface HeroSectionProps {
  onSelectTool: (tool: ToolDef) => void;
  onExploreClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onSelectTool,
  onExploreClick,
}) => {
  const popularTools = [
    ALL_TOOLS.find((t) => t.id === 'compress-pdf'),
    ALL_TOOLS.find((t) => t.id === 'merge-pdf'),
    ALL_TOOLS.find((t) => t.id === 'pdf-to-word'),
    ALL_TOOLS.find((t) => t.id === 'edit-pdf'),
    ALL_TOOLS.find((t) => t.id === 'jpg-to-pdf'),
    ALL_TOOLS.find((t) => t.id === 'image-ocr'),
    ALL_TOOLS.find((t) => t.id === 'compress-image'),
  ].filter((t): t is ToolDef => Boolean(t));

  return (
    <div className="relative overflow-hidden pt-8 pb-12 sm:pt-14 sm:pb-16 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-b from-white via-neutral-50/50 to-neutral-50 dark:from-neutral-950 dark:via-neutral-900/40 dark:to-neutral-950">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Anti-slop quiet text indicator */}
        <div className="inline-flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mb-4 font-medium">
          <span>All-in-one document suite</span>
          <span aria-hidden="true">·</span>
          <span>Zero server retention</span>
          <span aria-hidden="true">·</span>
          <span>45+ Professional Tools</span>
        </div>

        {/* Main Display Headline with text-wrap: balance */}
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-5xl lg:text-6xl text-balance">
          Everything you need to work with PDFs and files.
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-4 max-w-2xl text-base text-neutral-600 dark:text-neutral-400 sm:text-lg leading-relaxed">
          Convert, compress, edit, organize and protect your documents — all in one simple, fast, and
          completely private platform.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onExploreClick}
            className="flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 transition-colors"
          >
            <span>Explore All Tools</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Popular Tool Quick Access Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-neutral-400 mr-1 font-medium">Popular:</span>
          {popularTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool)}
              className="rounded-lg border border-neutral-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-400 hover:bg-white hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 transition-all shadow-2xs"
            >
              {tool.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
