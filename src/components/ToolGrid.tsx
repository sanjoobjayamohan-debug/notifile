import React from 'react';
import { ToolDef } from '../types';
import { ALL_TOOLS, CATEGORIES_LIST } from '../data/tools';
import { ToolCard } from './ToolCard';
import { Sparkles, Clock, Star, ArrowRight } from 'lucide-react';

interface ToolGridProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onSelectTool: (tool: ToolDef) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  recentToolIds: string[];
}

export const ToolGrid: React.FC<ToolGridProps> = ({
  selectedCategory,
  onSelectCategory,
  onSelectTool,
  favorites,
  onToggleFavorite,
  recentToolIds,
}) => {
  const recentTools = recentToolIds
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter((t): t is ToolDef => Boolean(t));

  const favoriteTools = favorites
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter((t): t is ToolDef => Boolean(t));

  const filteredTools =
    selectedCategory === 'all'
      ? ALL_TOOLS
      : ALL_TOOLS.filter((t) => {
          if (selectedCategory === 'compress') {
            return t.category === 'compress' || t.id === 'compress-image';
          }
          return t.category === selectedCategory;
        });

  return (
    <div className="space-y-10">
      {/* Category selector filter tabs */}
      <div className="flex items-center justify-start gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-neutral-200 dark:border-neutral-800">
        {CATEGORIES_LIST.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`font-mono text-[10px] ${
                  isActive ? 'opacity-80' : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Recents strip if any */}
      {selectedCategory === 'all' && recentTools.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-neutral-500" />
            <h2 className="font-display text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
              Recently Used
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {recentTools.slice(0, 4).map((tool) => (
              <ToolCard
                key={`recent-${tool.id}`}
                tool={tool}
                onSelect={onSelectTool}
                isFavorite={favorites.includes(tool.id)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>
      )}

      {/* Favorites strip if any */}
      {selectedCategory === 'all' && favoriteTools.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
            <h2 className="font-display text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
              Starred Shortcuts
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {favoriteTools.map((tool) => (
              <ToolCard
                key={`fav-${tool.id}`}
                tool={tool}
                onSelect={onSelectTool}
                isFavorite={true}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>
      )}

      {/* Main Grid display */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
              {selectedCategory === 'all'
                ? 'All Available Tools'
                : CATEGORIES_LIST.find((c) => c.id === selectedCategory)?.label || 'Tools'}
            </h2>
            <span className="text-xs text-neutral-400">({filteredTools.length})</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onSelect={onSelectTool}
              isFavorite={favorites.includes(tool.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </section>
    </div>
  );
};
