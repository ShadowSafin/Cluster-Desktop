import React from 'react';
import {
  Check,
  Circle,
  FileCode,
  GitBranch,
  Folder,
  Layers,
  Sparkles,
  Activity,
  ListTodo,
  ChevronDown,
  Sliders,
} from 'lucide-react';
import type { Plan } from '@cluster/shared';
import { getModelDisplayName } from './ModelSelectorModal';
import { EffortLevel, formatEffortDisplayName } from './EffortSelectorModal';
import { detectProvider } from '../services/providerDetect';

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
  baseUrl?: string;
  effort?: EffortLevel;
  onOpenDiffs?: () => void;
  onOpenTasks?: () => void;
  onOpenLogs?: () => void;
  onOpenModelSelector?: () => void;
  onOpenEffortSelector?: () => void;
}

export const WorkspaceRightPanels: React.FC<WorkspaceRightPanelsProps> = ({
  plan,
  taskGraph,
  edits = [],
  activity = [],
  workspaceName = 'Workspace',
  projectRoot,
  gitBranch = null,
  model = 'agnes-2.5-flash',
  provider,
  baseUrl,
  effort = 'balanced',
  onOpenDiffs,
  onOpenTasks,
  onOpenLogs,
  onOpenModelSelector,
  onOpenEffortSelector,
}) => {
  // Compute real plan steps from plan or taskGraph (NO hardcoded mock steps!)
  const steps = React.useMemo(() => {
    if (plan?.steps && plan.steps.length > 0) {
      return plan.steps.map((s: any) => ({
        id: s.id,
        title: s.title || s.description || 'Step',
        status: s.status === 'done' || s.status === 'completed' || s.status === 'skipped'
          ? 'done'
          : s.status === 'in-progress' || s.status === 'running'
          ? 'in-progress'
          : 'pending',
      }));
    }
    if (taskGraph?.tasks && Object.keys(taskGraph.tasks).length > 0) {
      return Object.values(taskGraph.tasks).map((t: any) => ({
        id: t.id,
        title: t.title || t.role || 'Task step',
        status: t.status === 'done' ? 'done' : t.status === 'running' ? 'in-progress' : 'pending',
      }));
    }
    return [];
  }, [plan, taskGraph]);

  const hasPlan = steps.length > 0;
  const completedCount = steps.filter((s) => s.status === 'done').length;
  const totalCount = steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Compute real file changes from edits (NO hardcoded mock files!)
  const fileChanges = React.useMemo(() => {
    if (!edits || edits.length === 0) return [];
    const map = new Map<string, { path: string; additions: number; deletions: number }>();
    for (const e of edits) {
      const p = e.path || e.file || 'file';
      const cur = map.get(p) || { path: p, additions: 0, deletions: 0 };
      cur.additions += e.additions || 0;
      cur.deletions += e.deletions || 0;
      map.set(p, cur);
    }
    return Array.from(map.values()).slice(0, 8);
  }, [edits]);

  // Clean formatted path
  const displayPath = React.useMemo(() => {
    if (!projectRoot) return 'projects/cluster';
    const normalized = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');
    if (/^[a-zA-Z]:/i.test(normalized)) {
      return normalized;
    }
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length <= 2) return normalized.startsWith('/') ? normalized : `~/${parts.join('/')}`;
    return `.../${parts.slice(-2).join('/')}`;
  }, [projectRoot]);

  // Real recent activity items (NO hardcoded mock activities!)
  const recentActivities = React.useMemo(() => {
    if (!activity || activity.length === 0) return [];
    return activity.slice(-6).reverse().map((act, i) => {
      const match = act.match(/^\[([^\]]+)\]\s*(.*)$/);
      const time = match ? match[1] : 'Just now';
      const text = match ? match[2] : act;
      return { id: `act-${i}`, text, time };
    });
  }, [activity]);

  return (
    <aside className="w-[300px] shrink-0 border-l border-[#1f1f24] bg-[#0c0c0e] flex flex-col h-full select-none text-xs overflow-hidden">
      <div className="flex-1 overflow-y-auto divide-y divide-[#18181c] min-h-0">
        {/* Panel 1: Current Plan */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-zinc-200 tracking-wide text-xs flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5 text-zinc-400" />
              <span>Current Plan</span>
            </h3>
            {hasPlan ? (
              <span className="text-[11px] font-mono text-zinc-400">
                {completedCount} / {totalCount} Steps
              </span>
            ) : (
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Idle
              </span>
            )}
          </div>

          {hasPlan ? (
            <>
              {/* Progress bar */}
              <div className="w-full h-1 rounded-full bg-[#18181c] overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, progressPercent)}%` }}
                />
              </div>

              {/* Real Step list */}
              <div className="space-y-1.5 pt-1">
                {steps.map((step) => {
                  const isDone = step.status === 'done';
                  const isInProgress = step.status === 'in-progress';

                  return (
                    <div key={step.id} className="flex items-start gap-2 text-xs">
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : isInProgress ? (
                          <div className="w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                          </div>
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-zinc-600" />
                        )}
                      </div>
                      <span
                        className={`leading-tight truncate ${
                          isDone
                            ? 'text-zinc-400 line-through opacity-80'
                            : isInProgress
                            ? 'text-zinc-100 font-medium'
                            : 'text-zinc-500'
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-[#121215] border border-[#1b1b20] p-2.5 text-[11px] text-zinc-400 text-center leading-relaxed">
              No active plan. Steps appear automatically when executing complex coding tasks.
            </div>
          )}
        </div>

        {/* Panel 2: Files Changed */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-zinc-200 tracking-wide text-xs flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-zinc-400" />
              <span>Files</span>
              {fileChanges.length > 0 && (
                <span className="text-zinc-400 font-normal">({fileChanges.length})</span>
              )}
            </h3>
            {fileChanges.length > 0 && onOpenDiffs && (
              <button
                onClick={onOpenDiffs}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                View diff
              </button>
            )}
          </div>

          {fileChanges.length > 0 ? (
            <div className="space-y-1">
              {fileChanges.map((file, idx) => (
                <div
                  key={idx}
                  onClick={onOpenDiffs}
                  className="flex items-center justify-between gap-2 p-1.5 -mx-1 rounded-lg hover:bg-[#151519] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileCode className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 shrink-0 transition-colors" />
                    <span className="font-mono text-[11px] text-zinc-300 group-hover:text-white truncate">
                      {file.path}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
                    {file.additions > 0 && <span className="text-emerald-400">+{file.additions}</span>}
                    {file.deletions > 0 && <span className="text-rose-400">-{file.deletions}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-[#121215] border border-[#1b1b20] p-2.5 text-[11px] text-zinc-400 text-center leading-relaxed">
              No files modified yet in this session.
            </div>
          )}
        </div>

        {/* Panel 3: Real Workspace Context */}
        <div className="p-3.5 space-y-2.5">
          <h3 className="font-semibold text-zinc-200 tracking-wide text-xs flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Context</span>
          </h3>
          <div className="space-y-2 text-[11px] bg-[#121215] border border-[#1b1b20] rounded-xl p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Project</span>
              <span className="text-zinc-200 font-medium truncate max-w-[150px]">{workspaceName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Workspace</span>
              <span className="font-mono text-zinc-300 truncate max-w-[150px]" title={projectRoot}>
                {displayPath}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Git Branch</span>
              {gitBranch ? (
                <span className="font-mono text-zinc-300 truncate max-w-[150px] flex items-center gap-1" title={`Branch: ${gitBranch}`}>
                  <GitBranch className="w-3 h-3 text-emerald-400" />
                  {gitBranch}
                </span>
              ) : (
                <span className="text-zinc-500 font-mono text-[10px]" title="No Git repository found in this workspace">
                  Not a git repo
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Provider</span>
              <span className="text-zinc-300 font-medium">
                {detectProvider(baseUrl, model, provider)}
              </span>
            </div>
            <div
              onClick={onOpenModelSelector}
              className="flex items-center justify-between p-1 -mx-1 rounded-lg hover:bg-[#18181f] cursor-pointer transition-colors group"
              title="Click to switch model"
            >
              <span className="text-zinc-400 group-hover:text-zinc-200">Model</span>
              <span className="font-mono text-zinc-300 group-hover:text-white truncate max-w-[140px] flex items-center gap-1">
                <span>{getModelDisplayName(model)}</span>
                <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 shrink-0" />
              </span>
            </div>
            <div
              onClick={onOpenEffortSelector}
              className="flex items-center justify-between p-1 -mx-1 rounded-lg hover:bg-[#18181f] cursor-pointer transition-colors group"
              title="Click to adjust reasoning effort (Low, Balanced, High)"
            >
              <span className="text-zinc-400 group-hover:text-zinc-200 flex items-center gap-1.5">
                <Sliders className="w-3 h-3 text-zinc-500 group-hover:text-cyan-400" />
                <span>Effort</span>
              </span>
              <span className="font-mono text-zinc-300 group-hover:text-white truncate max-w-[140px] flex items-center gap-1">
                <span>{formatEffortDisplayName(effort)}</span>
                <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 shrink-0" />
              </span>
            </div>
          </div>
        </div>

        {/* Panel 4: Real Recent Activity */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-zinc-200 tracking-wide text-xs flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-zinc-400" />
              <span>Recent Activity</span>
            </h3>
            {recentActivities.length > 0 && onOpenLogs && (
              <button
                onClick={onOpenLogs}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                View all
              </button>
            )}
          </div>

          {recentActivities.length > 0 ? (
            <div className="space-y-2">
              {recentActivities.map((act) => (
                <div key={act.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="text-zinc-300 truncate flex-1 leading-snug">{act.text}</span>
                  <span className="text-zinc-400 font-mono text-[10px] shrink-0">{act.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-[#121215] border border-[#1b1b20] p-2.5 text-[11px] text-zinc-400 text-center leading-relaxed">
              No actions recorded yet for this session.
            </div>
          )}
        </div>
      </div>

      {/* Panel Footer Status Bar */}
      <div className="p-3 border-t border-[#1f1f24] bg-[#09090b] flex items-center justify-between text-[11px] text-zinc-400 font-mono shrink-0">
        <span className="flex items-center gap-1.5 truncate">
          <span className="text-zinc-400 font-bold">&gt;</span>
          <span>{hasPlan ? `Plan: ${completedCount}/${steps.length} steps` : 'Status: Ready'}</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-zinc-300">Auto-save: On</span>
        </span>
      </div>
    </aside>
  );
};
