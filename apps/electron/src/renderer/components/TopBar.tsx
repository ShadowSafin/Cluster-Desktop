import React from 'react';
import { Search, Plus, Settings, Clock, ChevronRight } from 'lucide-react';
import type { PageId } from './Sidebar';

interface TopBarProps {
  currentPage: PageId;
  projectRoot?: string;
  workspaceName?: string;
  model?: string;
  sessionTitle?: string;
  running?: boolean;
  onCommandPalette: () => void;
  onNewCheckpoint?: () => void;
  onNewSession: () => void;
  onOpenWorkspaceSwitcher?: () => void;
  onOpenFolderDialog?: () => void;
  onNavigate?: (page: PageId) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentPage,
  projectRoot,
  workspaceName = 'Project Atlas',
  model = 'Claude 3.5 Sonnet',
  sessionTitle,
  running,
  onCommandPalette,
  onNewCheckpoint,
  onNewSession,
  onOpenWorkspaceSwitcher,
  onOpenFolderDialog,
  onNavigate,
}) => {
  const isWindows =
    typeof navigator !== 'undefined' &&
    /win/i.test(navigator.userAgent || (navigator as any).platform || '');

  return (
    <header
      className={`h-12 shrink-0 flex items-center justify-between pl-4 ${
        isWindows ? 'pr-[140px]' : 'pr-4'
      } bg-[#0D1117] border-b border-[#1E2536] drag-region select-none text-xs overflow-hidden`}
    >
      {/* Breadcrumb: Workspace / Project Atlas */}
      <div className="flex items-center gap-2 no-drag min-w-0 flex-1">
        <button
          onClick={() => onNavigate?.('workspace')}
          className="text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
        >
          Workspace
        </button>
        <span className="text-[#475569]">/</span>
        <button
          onClick={onOpenWorkspaceSwitcher}
          title={`Active Workspace: ${workspaceName}\nClick to switch (Ctrl+O)`}
          className="font-semibold text-white hover:text-[#3B82F6] transition-colors truncate max-w-[200px] cursor-pointer"
        >
          {workspaceName}
        </button>
      </div>

      {/* Center Search / Command Palette Pill */}
      <div className="hidden md:flex items-center justify-center no-drag flex-1 max-w-md mx-4">
        <button
          onClick={onCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-[#121722] hover:bg-[#161D2B] border border-[#1E2536] hover:border-[#27324B] text-[#94A3B8] hover:text-white transition-all shadow-sm group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-3.5 h-3.5 text-[#64748B] group-hover:text-white transition-colors" />
            <span className="text-xs text-[#94A3B8] font-sans">Quick actions &amp; commands...</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1A2234] border border-[#242E46] text-[#94A3B8]">
            ⌘K
          </span>
        </button>
      </div>

      {/* Right Controls: + New Session, Settings, History */}
      <div className="flex items-center gap-2 no-drag shrink-0">
        <button
          onClick={onNewSession}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161D2B] hover:bg-[#1F273A] border border-[#222B3D] text-white text-xs font-medium transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Session</span>
        </button>

        <button
          onClick={() => onNavigate?.('settings')}
          className="w-8 h-8 rounded-xl bg-[#121722] hover:bg-[#161D2B] border border-[#1E2536] text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={() => onNavigate?.('checkpoints')}
          className="w-8 h-8 rounded-xl bg-[#121722] hover:bg-[#161D2B] border border-[#1E2536] text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="History & Checkpoints"
        >
          <Clock className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
