import React from 'react';
import { Search, Plus, Settings, Clock, Bot, ChevronDown } from 'lucide-react';
import type { PageId } from './Sidebar';
import { getModelDisplayName } from './ModelSelectorModal';

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
  onOpenModelSelector?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentPage,
  projectRoot,
  workspaceName = 'Workspace',
  model = 'Claude 3.5 Sonnet',
  sessionTitle,
  running,
  onCommandPalette,
  onNewCheckpoint,
  onNewSession,
  onOpenWorkspaceSwitcher,
  onOpenFolderDialog,
  onNavigate,
  onOpenModelSelector,
}) => {
  const isWindows =
    typeof navigator !== 'undefined' &&
    /win/i.test(navigator.userAgent || (navigator as any).platform || '');

  return (
    <header
      className={`h-11 shrink-0 flex items-center justify-between pl-4 ${
        isWindows ? 'pr-[140px]' : 'pr-4'
      } bg-[#0c0c0e] border-b border-[#1f1f24] drag-region select-none text-xs overflow-hidden`}
    >
      {/* Breadcrumb: Workspace / [Workspace Name] */}
      <div className="flex items-center gap-2 no-drag min-w-0 flex-1">
        <button
          onClick={() => onNavigate?.('workspace')}
          className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          Workspace
        </button>
        <span className="text-zinc-600">/</span>
        <button
          onClick={onOpenWorkspaceSwitcher}
          title={`Current Workspace: ${workspaceName}\nClick to switch workspace (Ctrl+O)`}
          className="font-medium text-zinc-200 hover:text-white transition-colors truncate max-w-[200px] cursor-pointer"
        >
          {workspaceName}
        </button>
      </div>

      {/* Center Search / Command Palette Pill */}
      <div className="hidden md:flex items-center justify-center no-drag flex-1 max-w-md mx-4">
        <button
          onClick={onCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1 rounded-xl bg-[#131316] hover:bg-[#18181d] border border-[#1f1f25] hover:border-[#2a2a34] text-zinc-400 hover:text-zinc-200 transition-all shadow-sm group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            <span className="text-xs text-zinc-400 font-sans">Quick actions &amp; commands...</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c22] border border-[#272730] text-zinc-400">
            Ctrl+K
          </span>
        </button>
      </div>

      {/* Right Controls: Model Picker, + New Session, Settings, History */}
      <div className="flex items-center gap-2 no-drag shrink-0">
        {model && (
          <button
            onClick={onOpenModelSelector}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#131316] hover:bg-[#1c1c22] border border-[#1f1f25] hover:border-[#2a2a34] text-[11px] font-mono text-zinc-300 hover:text-white transition-all shadow-sm cursor-pointer group"
            title="Click to switch model"
          >
            <Bot className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
            <span className="truncate max-w-[120px]">{getModelDisplayName(model)}</span>
            <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          </button>
        )}

        <button
          onClick={onNewSession}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#16161b] hover:bg-[#202028] border border-[#22222a] text-zinc-200 hover:text-white text-xs font-medium transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Session</span>
        </button>

        <button
          onClick={() => onNavigate?.('settings')}
          className="w-7 h-7 rounded-xl bg-[#131316] hover:bg-[#1c1c22] border border-[#1f1f25] text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onNavigate?.('checkpoints')}
          className="w-7 h-7 rounded-xl bg-[#131316] hover:bg-[#1c1c22] border border-[#1f1f25] text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
          title="History & Checkpoints"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
