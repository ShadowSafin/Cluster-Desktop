import React from 'react';
import {
  Home,
  Layout,
  MessageSquare,
  Workflow,
  FileCode2,
  Terminal,
  Activity,
  Bookmark,
  Brain,
  Sparkles,
  Sliders,
  Settings,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { SessionSummary } from '../hooks/useSessions';
import { ClusterLogo } from './ClusterLogo';

export type PageId =
  | 'sessions'
  | 'workspace'
  | 'tasks'
  | 'diff'
  | 'logs'
  | 'background'
  | 'checkpoints'
  | 'memory'
  | 'skills'
  | 'provider'
  | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  workspaceName?: string;
  taskGraph?: any;
  running?: boolean;
  diffCount?: number;
  jobCount?: number;
  model?: string;
  onOpenWorkspaceSwitcher?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewSession,
  workspaceName = 'Workspace',
  taskGraph,
  running,
  diffCount = 0,
  jobCount = 0,
  model,
  onOpenWorkspaceSwitcher,
}) => {
  // Navigation items with real dynamic badges
  const navItems: { id: PageId; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'workspace', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'workspace', label: 'Workspace', icon: <Layout className="w-4 h-4" /> },
    {
      id: 'sessions',
      label: 'Sessions',
      icon: <MessageSquare className="w-4 h-4" />,
      badge: sessions.length > 0 ? sessions.length : undefined,
    },
    {
      id: 'tasks',
      label: 'Tasks & Plan',
      icon: <Workflow className="w-4 h-4" />,
      badge:
        taskGraph && Object.keys(taskGraph.tasks || {}).length > 0
          ? `${Object.values(taskGraph.tasks).filter((t: any) => t.status === 'done').length}/${Object.keys(taskGraph.tasks).length}`
          : undefined,
    },
    {
      id: 'diff',
      label: 'Diffs & Review',
      icon: <FileCode2 className="w-4 h-4" />,
      badge: diffCount > 0 ? diffCount : undefined,
    },
    { id: 'logs', label: 'Logs', icon: <Terminal className="w-4 h-4" /> },
    {
      id: 'background',
      label: 'Background Jobs',
      icon: <Activity className="w-4 h-4" />,
      badge: jobCount > 0 ? jobCount : undefined,
    },
    { id: 'checkpoints', label: 'Checkpoints', icon: <Bookmark className="w-4 h-4" /> },
    { id: 'memory', label: 'Memory', icon: <Brain className="w-4 h-4" /> },
    { id: 'skills', label: 'Skills Hub', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'provider', label: 'Provider / Model', icon: <Sliders className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const formatRelativeTime = (timestamp?: number | string) => {
    if (!timestamp) return '';
    const timeMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    if (isNaN(timeMs)) return '';
    const diffMs = Date.now() - timeMs;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <aside className="w-[230px] shrink-0 bg-[#0c0c0e] border-r border-[#1f1f24] flex flex-col h-full select-none text-xs overflow-hidden">
      {/* Brand Header */}
      <div className="h-11 px-3.5 border-b border-[#1f1f24] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ClusterLogo size={18} rounded={true} withShadow={false} />
          <span className="font-bold text-white text-xs tracking-wider">CLUSTER</span>
        </div>
        <button
          onClick={onNewSession}
          title="Create New Session"
          className="w-5 h-5 rounded hover:bg-[#18181e] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Navigation List */}
      <div className="p-2 space-y-0.5 border-b border-[#1f1f24] shrink-0">
        {navItems.map((item, idx) => {
          const isWorkspaceItem = item.label === 'Workspace' && currentPage === 'workspace';
          const isActive = isWorkspaceItem || (currentPage === item.id && item.label !== 'Home');

          return (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#1a1a20] text-white font-medium border border-[#262630] shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-[#141418]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={isActive ? 'text-zinc-200' : 'text-zinc-500'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#141418] text-zinc-400 border border-[#202026]">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Middle Sessions Section (Real Data, NO mock sessions!) */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        <div className="flex items-center justify-between px-1.5 mb-1.5">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Sessions
          </span>
          <span className="text-[10px] font-mono text-zinc-500">{sessions.length}</span>
        </div>

        {sessions.length > 0 ? (
          <div className="space-y-0.5">
            {sessions.slice(0, 12).map((s) => {
              const isSelected = s.id === activeSessionId;
              const isRunning = s.phase === 'running' || s.phase === 'thinking';

              return (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelectSession(s.id);
                    if (currentPage !== 'workspace') onNavigate('workspace');
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'text-white font-medium bg-[#16161c] border border-[#22222a]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#131317]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isRunning
                          ? 'bg-amber-400 animate-pulse'
                          : isSelected
                          ? 'bg-emerald-400'
                          : 'bg-zinc-600'
                      }`}
                    />
                    <span className="truncate">{s.title || 'Untitled Session'}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {formatRelativeTime(s.updatedAt || s.createdAt)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-[#111114] border border-[#1b1b20] text-center text-zinc-500 text-[11px] leading-relaxed">
            No sessions yet.
            <div className="mt-1 text-zinc-400">Press + to create one.</div>
          </div>
        )}

        {sessions.length > 5 && (
          <button
            onClick={() => onNavigate('sessions')}
            className="w-full text-left px-2 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mt-1 cursor-pointer block"
          >
            View all sessions
          </button>
        )}
      </div>

      {/* User Profile Footer Widget */}
      <div
        onClick={onOpenWorkspaceSwitcher}
        title="Click to switch workspace (Ctrl+O)"
        className="p-2.5 border-t border-[#1f1f24] bg-[#09090b] flex items-center justify-between gap-2 shrink-0 cursor-pointer hover:bg-[#131317] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-semibold text-[11px] shrink-0">
            AS
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-zinc-200 text-xs truncate">Abrar Safin</div>
            <div className="text-[10px] text-zinc-500 truncate">{workspaceName}</div>
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      </div>
    </aside>
  );
};
