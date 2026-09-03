import React from 'react';
import type { PageId } from './Sidebar';
import { ClusterLogo } from './ClusterLogo';

interface TopBarProps {
  currentPage: PageId;
  projectRoot?: string;
  workspaceName?: string;
  model?: string;
  sessionTitle?: string;
  running?: boolean;
  onCommandPalette: () => void;
  onNewCheckpoint: () => void;
  onNewSession: () => void;
  onOpenWorkspaceSwitcher?: () => void;
  onOpenFolderDialog?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentPage,
  projectRoot,
  workspaceName = 'cluster',
  model = 'gpt-4o-mini',
  sessionTitle,
  running,
  onCommandPalette,
  onNewCheckpoint,
  onNewSession,
  onOpenWorkspaceSwitcher,
  onOpenFolderDialog,
}) => {
  const pageTitles: Record<PageId, string> = {
    sessions: 'Sessions',
    workspace: 'Workspace',
    tasks: 'Tasks & Plan',
    diff: 'Diff & Review',
    logs: 'Logs',
    background: 'Background Jobs',
    checkpoints: 'Checkpoints',
    memory: 'Memory',
    skills: 'Skills & Marketplace',
    provider: 'Provider Setup',
    settings: 'Settings',
  };

  const displayPath = projectRoot ? projectRoot.replace(/\\/g, '/') : '~/projects/cluster';

  return (
    <header className="h-10 shrink-0 flex items-center justify-between px-3 bg-[#0a0a0d] border-b border-[#232326] drag-region select-none text-xs">
      {/* Breadcrumb & Status */}
      <div className="flex items-center gap-2 no-drag min-w-0">
        <ClusterLogo size={16} rounded={true} />
        <span className="font-bold text-white text-xs tracking-wider">CLUSTER</span>
        <span className="text-[#52525b]">/</span>

        {/* Interactive Workspace Button */}
        <button
          onClick={onOpenWorkspaceSwitcher}
          title={`Current Workspace: ${displayPath}\nClick to switch workspace (Ctrl+O)`}
          className="flex items-center gap-1.5 px-2 py-1 -my-1 rounded-lg bg-[#141418] hover:bg-[#1f1f23] border border-[#27272a] hover:border-cyan-500/40 text-white transition-all max-w-[180px] sm:max-w-xs group cursor-pointer"
        >
          <span className="text-xs">📁</span>
          <span className="font-semibold text-xs text-cyan-300 truncate">{workspaceName}</span>
          <span className="text-[10px] text-[#71717a] group-hover:text-white transition-colors">▾</span>
        </button>

        <span className="text-[#52525b]">/</span>
        <span className="font-medium text-[#a1a1aa] capitalize">{pageTitles[currentPage]}</span>
        {sessionTitle && currentPage === 'workspace' && (
          <>
            <span className="text-[#52525b]">·</span>
            <span className="text-[#71717a] font-mono truncate max-w-[140px] sm:max-w-xs">
              {sessionTitle}
            </span>
          </>
        )}
      </div>

      {/* Middle Search / Palette Trigger */}
      <div className="hidden md:flex items-center no-drag">
        <button
          onClick={onCommandPalette}
          className="flex items-center gap-2 bg-[#141418] border border-[#232326] hover:border-[#3f3f46] text-[#71717a] hover:text-white px-3 py-1 rounded-xl transition-all shadow-sm"
        >
          <span className="text-xs">🔍</span>
          <span className="text-[11px] font-mono">Quick Actions & Commands...</span>
          <span className="text-[10px] font-mono bg-[#1f1f24] border border-[#2c2c33] px-1.5 py-0.5 rounded text-[#a1a1aa]">
            Ctrl+K
          </span>
        </button>
      </div>

      {/* Right Actions & Model Indicator */}
      <div className="flex items-center gap-2 no-drag">
        <button
          onClick={onNewCheckpoint}
          title="Create Snapshot Checkpoint (Ctrl+G)"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141418] border border-[#232326] text-[#a1a1aa] hover:text-white transition-colors"
        >
          <span className="text-[10px]">⎌</span>
          <span className="text-[11px] font-mono">Checkpoint</span>
        </button>

        <button
          onClick={onOpenFolderDialog}
          title="Open Project Folder (Ctrl+O)"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141418] border border-[#232326] hover:border-[#38383e] text-[#a1a1aa] hover:text-white transition-colors text-[11px]"
        >
          <span>📂</span>
          <span>Open Folder</span>
        </button>

        <button
          onClick={onNewSession}
          title="Create New Session"
          className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141418] border border-[#232326] text-[#a1a1aa] hover:text-white transition-colors text-[11px]"
        >
          + Session
        </button>

        {model && (
          <span className="font-mono text-[11px] bg-[#141418] border border-[#232326] px-2.5 py-1 rounded-lg text-[#a1a1aa]">
            {model}
          </span>
        )}

        {running && (
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-1" title="Agent is working" />
        )}
      </div>
    </header>
  );
};
