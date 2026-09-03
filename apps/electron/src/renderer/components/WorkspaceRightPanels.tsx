import React from 'react';
import {
  Check,
  Circle,
  FileCode,
  GitBranch,
  Folder,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { Plan } from '@cluster/shared';

export interface WorkspaceRightPanelsProps {
  plan?: Plan | null;
  taskGraph?: any;
  edits?: any[];
  activity?: string[];
  workspaceName?: string;
  projectRoot?: string;
  gitBranch?: string | null;
  model?: string;
  provider?: string;
  onOpenDiffs?: () => void;
  onOpenTasks?: () => void;
  onOpenLogs?: () => void;
}

export const WorkspaceRightPanels: React.FC<WorkspaceRightPanelsProps> = ({
  plan,
  taskGraph,
  edits = [],
  activity = [],
  workspaceName = 'Project Atlas',
  projectRoot = '~/projects/cluster',
  gitBranch = 'main',
  model = 'Claude 3.5 Sonnet',
  provider = 'Anthropic',
  onOpenDiffs,
  onOpenTasks,
  onOpenLogs,
}) => {
  // Compute plan steps
  const steps = React.useMemo(() => {
    if (plan?.steps && plan.steps.length > 0) {
      return plan.steps;
    }
    if (taskGraph?.tasks && Object.keys(taskGraph.tasks).length > 0) {
      return Object.values(taskGraph.tasks).map((t: any) => ({
        id: t.id,
        title: t.title || t.role || 'Task step',
        status: t.status === 'done' ? 'done' : t.status === 'running' ? 'in-progress' : 'pending',
      }));
    }
    // Clean default mock steps if no active plan
    return [
      { id: '1', title: 'Add dark mode toggle UI', status: 'done' as const },
      { id: '2', title: 'Persist preference', status: 'done' as const },
      { id: '3', title: 'Apply theme globally', status: 'in-progress' as const },
      { id: '4', title: 'Verify and test', status: 'pending' as const },
    ];
  }, [plan, taskGraph]);

  const completedCount = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const totalCount = steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Compute file changes
  const fileChanges = React.useMemo(() => {
    if (edits && edits.length > 0) {
      const map = new Map<string, { path: string; additions: number; deletions: number }>();
      for (const e of edits) {
        const p = e.path || 'file';
        const cur = map.get(p) || { path: p, additions: 0, deletions: 0 };
        cur.additions += e.additions || 0;
        cur.deletions += e.deletions || 0;
        map.set(p, cur);
      }
      return Array.from(map.values()).slice(0, 6);
    }
    return [
      { path: 'settings/appearance.tsx', additions: 28, deletions: 4 },
      { path: 'lib/theme/apply-theme.ts', additions: 14, deletions: 14 },
    ];
  }, [edits]);

  // Clean formatted path
  const shortPath = React.useMemo(() => {
    if (!projectRoot) return '~/projects/cluster';
    const normalized = projectRoot.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length <= 2) return `~/${parts.join('/')}`;
    return `~/${parts.slice(-2).join('/')}`;
  }, [projectRoot]);

  // Recent activity items
  const recentActivities = React.useMemo(() => {
    if (activity && activity.length > 0) {
      return activity.slice(-5).reverse().map((act, i) => {
        // Strip out brackets or timestamps from string
        const match = act.match(/^\[([^\]]+)\]\s*(.*)$/);
        const time = match ? match[1] : 'Just now';
        const text = match ? match[2] : act;
        return { id: `act-${i}`, text, time };
      });
    }
    return [
      { id: '1', text: 'Read file: settings/appearance.tsx', time: '10:24 AM' },
      { id: '2', text: 'Edited file: settings/appearance.tsx', time: '10:26 AM' },
      { id: '3', text: 'Created file: lib/theme/apply-theme.ts', time: '10:27 AM' },
    ];
  }, [activity]);

  return (
    <aside className="w-[310px] shrink-0 border-l border-[#1E2536] bg-[#0D1117] flex flex-col h-full select-none text-xs overflow-hidden">
      <div className="flex-1 overflow-y-auto divide-y divide-[#182030] min-h-0">
        {/* Panel 1: Current Plan */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white tracking-wide text-xs">Current Plan</h3>
            <span className="text-[11px] font-mono text-[#94A3B8]">
              {completedCount} / {totalCount} Steps
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 rounded-full bg-[#1A2234] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#3B82F6] to-[#6366F1] transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>

          {/* Step items */}
          <div className="space-y-2 pt-1">
            {steps.map((step) => {
              const isDone = step.status === 'done' || step.status === 'skipped';
              const isInProgress = step.status === 'in-progress';

              return (
                <div key={step.id} className="flex items-start gap-2.5 text-xs">
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <div className="w-3.5 h-3.5 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    ) : isInProgress ? (
                      <div className="w-3.5 h-3.5 rounded-full bg-[#3B82F6] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      </div>
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-[#475569]" />
                    )}
                  </div>
                  <span
                    className={`leading-tight truncate ${
                      isDone
                        ? 'text-[#94A3B8]'
                        : isInProgress
                        ? 'text-white font-medium'
                        : 'text-[#64748B]'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel 2: Files */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white tracking-wide text-xs">
              Files <span className="text-[#94A3B8] font-normal">({fileChanges.length})</span>
            </h3>
            {onOpenDiffs && (
              <button
                onClick={onOpenDiffs}
                className="text-[11px] text-[#64748B] hover:text-[#94A3B8] transition-colors cursor-pointer"
              >
                View all
              </button>
            )}
          </div>

          <div className="space-y-2">
            {fileChanges.map((file, idx) => (
              <div
                key={idx}
                onClick={onOpenDiffs}
                className="flex items-center justify-between gap-2 p-1.5 -mx-1.5 rounded-lg hover:bg-[#131926] cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileCode className="w-3.5 h-3.5 text-[#64748B] group-hover:text-white shrink-0 transition-colors" />
                  <span className="font-mono text-[11px] text-[#CBD5E1] group-hover:text-white truncate">
                    {file.path}
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
                  {file.additions > 0 && <span className="text-[#10B981]">+{file.additions}</span>}
                  {file.deletions > 0 && <span className="text-[#EF4444]">-{file.deletions}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 3: Context */}
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-white tracking-wide text-xs">Context</h3>
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Project</span>
              <span className="text-[#E2E8F0] font-medium truncate max-w-[160px]">{workspaceName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Workspace</span>
              <span className="font-mono text-[#CBD5E1] truncate max-w-[160px]" title={projectRoot}>
                {shortPath}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Branch</span>
              <span className="font-mono text-[#CBD5E1] truncate max-w-[160px] flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-[#64748B]" />
                {gitBranch || 'feature/dark-mode'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Provider</span>
              <span className="text-[#CBD5E1]">{provider || 'Anthropic'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Model</span>
              <span className="font-mono text-[#CBD5E1] truncate max-w-[150px]">{model || 'Claude 3.5 Sonnet'}</span>
            </div>
          </div>
        </div>

        {/* Panel 4: Recent Activity */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white tracking-wide text-xs">Recent Activity</h3>
            {onOpenLogs && (
              <button
                onClick={onOpenLogs}
                className="text-[11px] text-[#64748B] hover:text-[#94A3B8] transition-colors cursor-pointer"
              >
                View all
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="text-[#94A3B8] truncate flex-1 leading-snug">{act.text}</span>
                <span className="text-[#64748B] font-mono text-[10px] shrink-0">{act.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 5: Bottom Status Bar */}
      <div className="p-3 border-t border-[#1E2536] bg-[#0A0E15] flex items-center justify-between text-[11px] text-[#94A3B8] font-mono shrink-0">
        <span className="flex items-center gap-1.5 truncate">
          <span className="text-[#3B82F6] font-bold">&gt;</span>
          <span>Plan: {steps.length} steps</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <span className="text-[#CBD5E1]">Auto-save: On</span>
        </span>
      </div>
    </aside>
  );
};
