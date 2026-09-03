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
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  workspaceName = 'Project Atlas',
  taskGraph,
  running,
  diffCount = 12,
  jobCount = 3,
  model,
  onOpenWorkspaceSwitcher,
}) => {
  const navItems: { id: PageId; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'workspace', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'workspace', label: 'Workspace', icon: <Layout className="w-4 h-4" /> },
    { id: 'sessions', label: 'Sessions', icon: <MessageSquare className="w-4 h-4" /> },
    {
      id: 'tasks',
      label: 'Tasks & Plan',
      icon: <Workflow className="w-4 h-4" />,
      badge: 7,
    },
    {
      id: 'diff',
      label: 'Diffs & Review',
      icon: <FileCode2 className="w-4 h-4" />,
      badge: diffCount > 0 ? diffCount : 12,
    },
    { id: 'logs', label: 'Logs', icon: <Terminal className="w-4 h-4" /> },
    {
      id: 'background',
      label: 'Background Jobs',
      icon: <Activity className="w-4 h-4" />,
      badge: jobCount > 0 ? jobCount : 3,
    },
    { id: 'checkpoints', label: 'Checkpoints', icon: <Bookmark className="w-4 h-4" />, badge: 4 },
    { id: 'memory', label: 'Memory', icon: <Brain className="w-4 h-4" /> },
    { id: 'skills', label: 'Skills Hub', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'provider', label: 'Provider / Model', icon: <Sliders className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  // Formatted sessions for sidebar list
  const displaySessions = React.useMemo(() => {
    if (sessions && sessions.length > 0) {
      return sessions.slice(0, 5).map((s, idx) => ({
        id: s.id,
        title: s.title || 'Untitled Session',
        time: idx === 0 ? '2h ago' : `${idx}d ago`,
        isActive: s.id === activeSessionId,
      }));
    }
    return [
      { id: 's1', title: workspaceName || 'Project Atlas', time: '2h ago', isActive: true },
      { id: 's2', title: 'Auth System Refactor', time: '1d ago', isActive: false },
      { id: 's3', title: 'UI Redesign Sprint', time: '2d ago', isActive: false },
      { id: 's4', title: 'API Integration', time: '3d ago', isActive: false },
      { id: 's5', title: 'Bug Fixing Session', time: '5d ago', isActive: false },
    ];
  }, [sessions, activeSessionId, workspaceName]);

  return (
    <aside className="w-[240px] shrink-0 bg-[#0D1117] border-r border-[#1E2536] flex flex-col h-full select-none text-xs overflow-hidden">
      {/* Brand Header */}
      <div className="h-12 px-4 border-b border-[#1E2536] flex items-center gap-2.5 shrink-0">
        <ClusterLogo size={20} rounded={true} withShadow={false} />
        <span className="font-bold text-white text-sm tracking-wider">CLUSTER</span>
      </div>

      {/* Main Navigation List */}
      <div className="p-3 space-y-1 border-b border-[#1E2536] shrink-0">
        {navItems.map((item, idx) => {
          // Highlight workspace if on workspace page
          const isWorkspaceItem = item.label === 'Workspace' && currentPage === 'workspace';
          const isActive = isWorkspaceItem || (currentPage === item.id && item.label !== 'Home');

          return (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#161F30] text-white font-medium border border-[#202E48] shadow-sm'
                  : 'text-[#94A3B8] hover:text-white hover:bg-[#131824]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={isActive ? 'text-[#3B82F6]' : 'text-[#64748B]'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#182030] text-[#64748B]">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Middle Sessions Section */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[11px] font-medium text-[#64748B]">Sessions</span>
          <button
            onClick={onNewSession}
            className="w-4 h-4 rounded hover:bg-[#1C2436] text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Create session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          {displaySessions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onSelectSession(s.id);
                if (currentPage !== 'workspace') onNavigate('workspace');
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                s.isActive
                  ? 'text-white font-medium bg-[#141B29]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-[#111722]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {s.isActive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent shrink-0" />
                )}
                <span className="truncate">{s.title}</span>
              </div>
              <span className="text-[10px] font-mono text-[#64748B] shrink-0">{s.time}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => onNavigate('sessions')}
          className="w-full text-left px-2.5 py-2 text-[11px] text-[#64748B] hover:text-[#94A3B8] transition-colors mt-2 cursor-pointer block"
        >
          View all sessions
        </button>
      </div>

      {/* User Profile Footer Widget */}
      <div
        onClick={onOpenWorkspaceSwitcher}
        className="p-3 border-t border-[#1E2536] bg-[#0A0E15] flex items-center justify-between gap-2 shrink-0 cursor-pointer hover:bg-[#111722] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center font-semibold text-xs shrink-0">
            AS
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-white text-xs truncate">Abrar</div>
            <div className="text-[10px] text-[#64748B] truncate">Personal Workspace</div>
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
      </div>
    </aside>
  );
};
