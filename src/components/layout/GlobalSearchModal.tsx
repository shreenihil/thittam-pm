'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FolderKanban, CheckSquare, X, Command } from 'lucide-react';
import { StatusGlyph } from '../ui/StatusGlyph';
import { useOsShortcut } from '@/lib/useOsShortcut';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ projects: any[]; tasks: any[] }>({
    projects: [],
    tasks: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { shortcutLabel } = useOsShortcut();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        isOpen ? onClose() : null;
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults({ projects: [], tasks: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div 
        className="w-full max-w-xl bg-[#101114] hairline-border rounded-xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3 hairline-b flex items-center gap-2">
          <Search size={18} className="text-gray-400 ml-1 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects (e.g. DM-0042) or tasks..."
            className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
          />
          <button 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-md transition-colors"
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Results Dropdown */}
        <div className="max-h-80 md:max-h-96 overflow-y-auto p-2 space-y-3 overscroll-contain">
          {isLoading && (
            <div className="p-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-[#5e6ad2] rounded-full animate-spin" />
              Searching workspace...
            </div>
          )}

          {!isLoading && query.length >= 2 && results.projects.length === 0 && results.tasks.length === 0 && (
            <div className="p-6 text-center text-xs text-gray-500">
              No projects or tasks match "{query}".
            </div>
          )}

          {!isLoading && query.length < 2 && (
            <div className="p-6 text-center text-xs text-gray-500">
              Type at least 2 characters to search projects and tasks...
            </div>
          )}

          {/* Projects Results */}
          {results.projects.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Projects
              </div>
              <div className="space-y-0.5 mt-1">
                {results.projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      router.push(`/projects/${p.id}`);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 truncate pr-2">
                      <FolderKanban size={14} className="text-[#5e6ad2] shrink-0" />
                      <span className="font-mono text-gray-400 shrink-0">{p.projectNumber}</span>
                      <span className="font-medium text-gray-100 truncate">{p.title}</span>
                    </span>
                    <StatusGlyph status={p.status} size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tasks Results */}
          {results.tasks.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Tasks
              </div>
              <div className="space-y-0.5 mt-1">
                {results.tasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      router.push(`/projects/${t.projectId}?taskId=${t.id}`);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 truncate pr-2">
                      <CheckSquare size={14} className="text-gray-400 shrink-0" />
                      <span className="font-mono text-gray-400 shrink-0">{t.taskNumber}</span>
                      <span className="font-medium text-gray-100 truncate">{t.title}</span>
                    </span>
                    <StatusGlyph status={t.status} size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with OS Shortcut Hint */}
        <div className="p-2.5 hairline-t bg-[#0c0d10] flex items-center justify-between text-[11px] text-gray-500 font-mono">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">{shortcutLabel}</kbd>
            <span>to toggle</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">ESC</kbd>
            <span>to close</span>
          </span>
        </div>
      </div>
    </div>
  );
};

