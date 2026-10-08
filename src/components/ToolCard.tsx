import React from 'react';
import {
  Combine,
  Scissors,
  Minimize2,
  RotateCw,
  Trash2,
  Layers,
  Stamp,
  Hash,
  Tag,
  FileCheck,
  Lock,
  Unlock,
  FileText,
  Table,
  Image,
  ImageIcon,
  FileCode,
  Globe,
  FileUp,
  FileImage,
  FileCheck2,
  FilePlus,
  Zap,
  Maximize,
  Crop,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  ScanText,
  FileSearch,
  Compass,
  Binary,
  Star,
  ArrowUpRight,
  Edit3,
  ListOrdered,
} from 'lucide-react';
import { ToolDef } from '../types';

const ICON_MAP: Record<string, React.ElementType> = {
  Edit3,
  ListOrdered,
  Combine,
  Scissors,
  Minimize2,
  RotateCw,
  Trash2,
  Layers,
  Stamp,
  Hash,
  Tag,
  FileCheck,
  Lock,
  Unlock,
  FileText,
  Table,
  Image,
  ImageIcon,
  FileCode,
  Globe,
  FileUp,
  FileImage,
  FileCheck2,
  FilePlus,
  Zap,
  Maximize,
  Crop,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  ScanText,
  FileSearch,
  Compass,
  Binary,
};

interface ToolCardProps {
  tool: ToolDef;
  onSelect: (tool: ToolDef) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  onSelect,
  isFavorite,
  onToggleFavorite,
}) => {
  const IconComponent = ICON_MAP[tool.iconName] || FileText;

  return (
    <div
      onClick={() => onSelect(tool)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(tool);
        }
      }}
      className="group relative flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900/70 dark:hover:border-blue-600 cursor-pointer"
    >
      <div>
        {/* Top row: Icon + Favorite button */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950/60 dark:text-blue-400 dark:group-hover:bg-blue-600 dark:group-hover:text-white shadow-2xs">
            <IconComponent className="h-5 w-5" />
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(tool.id);
            }}
            className="rounded p-1.5 text-neutral-400 hover:text-amber-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
          >
            <Star
              className={`h-4 w-4 transition-colors ${
                isFavorite ? 'fill-amber-400 text-amber-500' : 'text-neutral-400'
              }`}
            />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center justify-between transition-colors">
          <span>{tool.name}</span>
          <ArrowUpRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-500" />
        </h3>

        {/* Description */}
        <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 line-clamp-2">
          {tool.description}
        </p>
      </div>

      {/* Quiet unboxed metadata at bottom */}
      <div className="mt-4 flex items-center gap-2 pt-3 border-t border-neutral-100 text-[11px] text-neutral-400 dark:border-neutral-800/80 dark:text-neutral-500">
        <span>{tool.subCategory || 'Utility'}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono text-[10px]">{tool.acceptedTypes.replace(/\*/g, '')}</span>
      </div>
    </div>
  );
};
