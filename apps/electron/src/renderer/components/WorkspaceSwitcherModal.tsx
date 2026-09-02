import React, { useState, useEffect } from 'react';

export interface RecentWorkspace {
  path: string;
  name: string;
  lastOpenedAt: string;
}

interface WorkspaceSwitcherModalProps {
  open: boolean;
  onClose: () => void;
  currentRoot: string;
  onSelectWorkspace: (path: string) => void;
  onOpenFolderDialog: () => void;
  recentWorkspaces: RecentWorkspace[];
  onRemoveRecent: (path: string) => void;
}

export const WorkspaceSwitcherModal: React.FC<WorkspaceSwitcherModalProps> = ({
  open,
  onClose,
  currentRoot,
  onSelectWorkspace,
  onOpenFolderDialog,
  recentWorkspaces,
  onRemoveRecent,
}) => {
  const [manualPath, setManualPath] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (open) {
      setManualPath('');
      setFilter('');
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualPath.trim();
    if (trimmed) {
      onSelectWorkspace(trimmed);
      onClose();
    }
  };

  const filteredRecents = recentWorkspaces.filter(w =>
    w.name.toLowerCase().includes(filter.toLowerCase()) ||
    w.path.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-xl rounded-2xl border border-[#27272a] bg-[#0c0c0f] shadow-2xl flex flex-col overflow-hidden text-xs max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#232326] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-sm">
              📁
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Switch Workspace</h2>
              <p className="text-[11px] text-[#71717a]">
                Choose a project folder, open a new directory, or switch recents
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-[#71717a] hover:text-white hover:bg-[#1f1f23] transition-colors flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Primary Action: Browse Folder button */}
        <div className="p-4 border-b border-[#1f1f23] bg-[#0f0f13]/60 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              onClose();
              onOpenFolderDialog();
            }}
            className="flex-1 flex items-center justify-between p-3 rounded-xl bg-white text-black hover:bg-neutral-200 transition-all font-semibold shadow-sm group"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">📂</span>
              <div className="text-left">
                <div className="text-xs font-bold leading-tight">Open Folder...</div>
                <div className="text-[10px] text-neutral-600 font-normal">
                  Browse native folder dialog
                </div>
              </div>
            </div>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10 text-neutral-800">
              Ctrl+O
            </kbd>
          </button>
        </div>

        {/* Manual Path Input */}
        <div className="px-4 py-3 border-b border-[#1f1f23]">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualPath}
              onChange={e => setManualPath(e.target.value)}
              placeholder="Or paste directory path (e.g. C:/Projects/my-app)..."
              className="flex-1 px-3 py-2 rounded-xl bg-[#141418] border border-[#27272a] text-white placeholder-[#52525b] text-xs font-mono focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={!manualPath.trim()}
              className="px-3 py-2 rounded-xl bg-[#1c1c21] border border-[#2e2e33] text-white hover:bg-[#282830] disabled:opacity-40 transition-colors font-medium text-xs"
            >
              Open
            </button>
          </form>
        </div>

        {/* Search filter for recents if more than 3 */}
        {recentWorkspaces.length > 3 && (
          <div className="px-4 pt-3 pb-1">
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter recent workspaces..."
              className="w-full px-3 py-1.5 rounded-lg bg-[#121215] border border-[#232326] text-white placeholder-[#52525b] text-[11px] focus:outline-none focus:border-[#3f3f46]"
            />
          </div>
        )}

        {/* Recent Workspaces List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          <div className="text-[10px] font-semibold text-[#52525b] uppercase tracking-wider px-1 pb-1">
            Recent Workspaces ({filteredRecents.length})
          </div>

          {filteredRecents.length === 0 ? (
            <div className="p-6 text-center text-[#71717a] border border-dashed border-[#232326] rounded-xl">
              No recent workspaces found
            </div>
          ) : (
            filteredRecents.map(w => {
              const isCurrent = w.path.toLowerCase() === currentRoot.toLowerCase();
              return (
                <div
                  key={w.path}
                  onClick={() => {
                    onSelectWorkspace(w.path);
                    onClose();
                  }}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all group ${
                    isCurrent
                      ? 'bg-[#141418] border-cyan-500/30 text-white'
                      : 'bg-[#101013] border-[#1f1f23] text-[#a1a1aa] hover:border-[#38383e] hover:bg-[#16161a] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-sm">📁</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white truncate">
                          {w.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-[#71717a] truncate mt-0.5" title={w.path}>
                        {w.path}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onRemoveRecent(w.path);
                      }}
                      title="Remove from recents"
                      className="p-1 rounded text-[#52525b] hover:text-red-400 hover:bg-red-950/20 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                    <span className="text-xs text-[#52525b] group-hover:text-white transition-colors">
                      →
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#1f1f23] bg-[#09090c] flex items-center justify-between text-[11px] text-[#71717a]">
          <div className="truncate max-w-sm">
            Current: <span className="font-mono text-[#a1a1aa]">{currentRoot}</span>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1 rounded bg-[#18181b] hover:bg-[#232326] text-[#e4e4e7] transition-colors"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
