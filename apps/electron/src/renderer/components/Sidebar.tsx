import React from 'react';
import { SessionSummary } from '../hooks/useSessions';

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
  workspaceName = 'cluster',
  taskGraph,
  running,
  diffCount = 0,
  jobCount = 0,
  model,
  onOpenWorkspaceSwitcher,
}) => {
  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Dynamic agent roles from real taskGraph
  const agentRoles = React.useMemo(() => {
    if (!taskGraph || !taskGraph.tasks) return [];
    const map = new Map<string, { role: string; count: number; done: number; running: boolean }>();
    for (const t of Object.values(taskGraph.tasks) as any[]) {
      const r = t.agentRole || 'coder';
      const item = map.get(r) || { role: r, count: 0, done: 0, running: false };
      item.count++;
      if (t.status === 'done') item.done++;
      if (t.status === 'running') item.running = true;
      map.set(r, item);
    }
    return Array.from(map.values());
  }, [taskGraph]);

  const navItems: { id: PageId; label: string; shortcut: string; badge?: string | number }[] = [
    { id: 'sessions', label: 'Sessions', shortcut: '1', badge: sessions.length },
    { id: 'workspace', label: 'Workspace', shortcut: '2' },
    {
      id: 'tasks',
      label: 'Tasks & Plan',
      shortcut: '3',
      badge: taskGraph ? `${Object.values(taskGraph.tasks || {}).filter((t: any) => t.status === 'done').length}/${Object.keys(taskGraph.tasks || {}).length}` : undefined,
    },
    { id: 'diff', label: 'Diffs & Review', shortcut: '4', badge: diffCount > 0 ? diffCount : undefined },
    { id: 'logs', label: 'Logs', shortcut: '5' },
    { id: 'background', label: 'Background Jobs', shortcut: '6', badge: jobCount > 0 ? jobCount : undefined },
    { id: 'checkpoints', label: 'Checkpoints', shortcut: '7' },
    { id: 'memory', label: 'Memory', shortcut: '8' },
    { id: 'skills', label: 'Skills Hub', shortcut: 'S' },
    { id: 'provider', label: 'Provider / Model', shortcut: '9' },
    { id: 'settings', label: 'Settings', shortcut: '0' },
  ];

  return (
    <aside className="w-64 shrink-0 bg-[#0c0c0f] border-r border-[#232326] flex flex-col h-full select-none text-xs">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#232326] flex items-center justify-between shrink-0">
        <div
          onClick={onOpenWorkspaceSwitcher}
          title="Click to switch workspace (Ctrl+O)"
          className="flex items-center gap-2.5 p-1.5 -m-1.5 rounded-xl hover:bg-[#18181b] border border-transparent hover:border-[#27272a] transition-all cursor-pointer group flex-1 mr-2 min-w-0"
        >
          <div className="w-7 h-7 rounded-lg bg-white text-black font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
            ◈
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white tracking-wide text-xs leading-none">CLUSTER</span>
              <span className="text-[10px] text-[#71717a] group-hover:text-cyan-400 transition-colors">▾</span>
            </div>
            <div className="text-[10px] text-[#a1a1aa] group-hover:text-white font-mono mt-1 truncate max-w-[125px] transition-colors">
              {workspaceName}
            </div>
          </div>
        </div>

        <button
          onClick={onNewSession}
          title="Create New Session"
          className="w-6 h-6 rounded-lg bg-[#18181b] border border-[#27272a] text-white flex items-center justify-center hover:bg-[#27272a] transition-colors shrink-0"
        >
          +
        </button>
      </div>

      {/* Main Navigation Pages */}
      <div className="p-2.5 space-y-0.5 border-b border-[#232326] shrink-0">
        <div className="px-2.5 py-1 text-[10px] font-semibold text-[#52525b] uppercase tracking-wider">
          Views
        </div>
        {navItems.map(item => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white text-black shadow-sm font-semibold'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#151518]'
              }`}
            >
              <span className="truncate">{item.label}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      isActive ? 'bg-neutral-200 text-black' : 'bg-[#18181b] text-[#a1a1aa] border border-[#27272a]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                <span
                  className={`text-[10px] font-mono opacity-50 px-1 rounded ${
                    isActive ? 'text-neutral-700' : 'text-[#71717a]'
                  }`}
                >
                  {item.shortcut}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active & Recent Sessions Scroll Area */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1 min-h-0">
        <div className="flex items-center justify-between px-2.5 py-1">
          <span className="text-[10px] font-semibold text-[#52525b] uppercase tracking-wider">
            Sessions
          </span>
          <span className="text-[10px] font-mono text-[#71717a]">{sessions.length}</span>
        </div>

        {sessions.slice(0, 8).map(s => {
          const isSelected = s.id === activeSessionId;
          const isRunning = s.phase === 'running' || s.phase === 'thinking' || s.phase === 'planning';

          return (
            <button
              key={s.id}
              onClick={() => {
                onSelectSession(s.id);
                if (currentPage !== 'workspace') onNavigate('workspace');
              }}
              className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all ${
                isSelected
                  ? 'bg-[#1a1a20] text-white border border-[#2e2e36]'
                  : 'text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#121215]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isRunning ? 'bg-amber-400 animate-pulse' : isSelected ? 'bg-emerald-400' : 'bg-[#3f3f46]'
                }`}
              />
              <span className="truncate flex-1 font-medium">{s.title || 'Untitled Session'}</span>
              <span className="text-[10px] font-mono text-[#52525b] shrink-0">{s.messageCount || 0}m</span>
            </button>
          );
        })}
      </div>

      {/* Multi-Agent Dynamic Status Bar at Bottom */}
      <div className="p-3 border-t border-[#232326] bg-[#09090c] shrink-0 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-[#71717a] flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                running ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            {running ? 'Agent Running' : 'Coordinator Idle'}
          </span>
          <span className="text-[10px] font-mono text-[#71717a] truncate max-w-[110px]" title={model || activeSession?.model || 'No model'}>
            {model || activeSession?.model || 'No model'}
          </span>
        </div>

        {agentRoles.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {agentRoles.map(a => (
              <span
                key={a.role}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#141418] border border-[#232326] text-[#a1a1aa] flex items-center gap-1"
              >
                <span className={`w-1 h-1 rounded-full ${a.running ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                {a.role}: {a.done}/{a.count}
              </span>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
