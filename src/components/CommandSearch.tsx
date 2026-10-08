import React, { useEffect, useState, useRef } from 'react';
import { Search, X, ArrowRight, Star } from 'lucide-react';
import { ALL_TOOLS } from '../data/tools';
import { ToolDef } from '../types';

interface CommandSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (tool: ToolDef) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

export const CommandSearch: React.FC<CommandSearchProps> = ({
  isOpen,
  onClose,
  onSelectTool,
  favorites,
  onToggleFavorite,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredTools = ALL_TOOLS.filter((t) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.subCategory && t.subCategory.toLowerCase().includes(q))
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredTools.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredTools.length) % Math.max(1, filteredTools.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTools[selectedIndex]) {
        onSelectTool(filteredTools[selectedIndex]);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 px-4 bg-neutral-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3.5 dark:border-neutral-800">
          <Search className="h-5 w-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a tool name (e.g. compress, merge, ocr, watermark)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-white"
          />
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredTools.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-500">
              No matching tools found for "{query}"
            </div>
          ) : (
            filteredTools.map((tool, index) => {
              const isFav = favorites.includes(tool.id);
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={tool.id}
                  onClick={() => {
                    onSelectTool(tool);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                      <span className="text-xs font-semibold">{tool.name.slice(0, 2)}</span>
                    </div>
                    <div className="truncate">
                      <div className="font-medium text-neutral-900 dark:text-white truncate">
                        {tool.name}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        {tool.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(tool.id);
                      }}
                      className="p-1 text-neutral-400 hover:text-amber-500 transition-colors"
                      title={isFav ? 'Remove favorite' : 'Add favorite'}
                    >
                      <Star
                        className={`h-4 w-4 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`}
                      />
                    </button>
                    <ArrowRight className="h-4 w-4 text-neutral-400" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal footer shortcut guide */}
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-[11px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950">
          <span>Use ↑ ↓ to navigate, Enter to select</span>
          <span>ESC to exit</span>
        </div>
      </div>
    </div>
  );
};
