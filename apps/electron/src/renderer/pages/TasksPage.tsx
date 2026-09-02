import React, { useMemo, useState } from 'react';

interface TasksPageProps {
  taskGraph: any;
  plan: any;
  liveOutput: Record<string, string>;
}

export const TasksPage: React.FC<TasksPageProps> = ({
  taskGraph,
  plan,
  liveOutput,
}) => {
  const [filterRole, setFilterRole] = useState<string>('all');

  const tasks = useMemo(() => {
    if (!taskGraph || !taskGraph.tasks) return [];
    return Object.values(taskGraph.tasks) as any[];
  }, [taskGraph]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t: any) => t.status === 'done').length;
    const running = tasks.filter((t: any) => t.status === 'running' || t.status === 'ready').length;
    const failed = tasks.filter((t: any) => t.status === 'failed').length;
    const pending = tasks.filter((t: any) => t.status === 'pending' || t.status === 'blocked').length;
    return { total, done, running, failed, pending };
  }, [tasks]);

  // Compute dependency batches for DAG parallel timeline
  const batches = useMemo(() => {
    if (!taskGraph || !taskGraph.tasks) return [];
    const map = new Map<number, any[]>();
    const levelMap = new Map<string, number>();
    const visiting = new Set<string>();

    const getLevel = (id: string): number => {
      if (levelMap.has(id)) return levelMap.get(id)!;
      if (visiting.has(id)) return 0;
      visiting.add(id);
      const t = taskGraph.tasks[id];
      const l = t && t.dependsOn?.length
        ? Math.max(...t.dependsOn.map((d: string) => getLevel(d))) + 1
        : 0;
      levelMap.set(id, l);
      visiting.delete(id);
      return l;
    };

    tasks.forEach(t => getLevel(t.id));
    tasks.forEach(t => {
      const l = levelMap.get(t.id) ?? 0;
      if (!map.has(l)) map.set(l, []);
      map.get(l)!.push(t);
    });

    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }, [taskGraph, tasks]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      if (t.agentRole) set.add(t.agentRole);
    });
    return ['all', ...Array.from(set)];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (filterRole === 'all') return tasks;
    return tasks.filter(t => t.agentRole === filterRole);
  }, [tasks, filterRole]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'coder':
        return 'bg-emerald-950/30 text-emerald-300 border-emerald-800/30';
      case 'reviewer':
        return 'bg-amber-950/30 text-amber-300 border-amber-800/30';
      case 'tester':
        return 'bg-sky-950/30 text-sky-300 border-sky-800/30';
      case 'planner':
        return 'bg-purple-950/30 text-purple-300 border-purple-800/30';
      case 'context':
        return 'bg-neutral-800 text-neutral-300 border-neutral-700';
      default:
        return 'bg-neutral-900 text-neutral-400 border-neutral-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <span className="text-emerald-400 font-bold">✓</span>;
      case 'running':
      case 'ready':
        return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />;
      case 'failed':
        return <span className="text-red-400 font-bold">✕</span>;
      case 'blocked':
        return <span className="text-orange-400 font-bold">⊘</span>;
      default:
        return <span className="w-2 h-2 rounded-full bg-[#52525b]" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#232326]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">Tasks & Plan</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
              taskGraph?.status === 'done'
                ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/40'
                : taskGraph?.status === 'running'
                ? 'bg-amber-950/30 text-amber-400 border border-amber-900/40'
                : 'bg-[#18181b] text-[#71717a] border border-[#27272a]'
            }`}>
              {taskGraph?.status || 'No Active Graph'}
            </span>
          </div>
          <p className="text-xs text-[#71717a] mt-1 font-mono truncate max-w-xl">
            Goal: {taskGraph?.goal || plan?.goal || 'No task goal recorded'}
          </p>
        </div>

        {/* Progress percent bar */}
        {stats.total > 0 && (
          <div className="sm:w-48">
            <div className="flex justify-between text-xs text-[#a1a1aa] mb-1">
              <span>Progress</span>
              <span className="font-mono">{Math.round((stats.done / stats.total) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#18181b] border border-[#27272a] overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${(stats.done / stats.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-[#232326] bg-[#0f0f12] p-3 text-center">
          <div className="text-xs text-[#71717a] uppercase font-semibold">Total</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-[#232326] bg-[#0f0f12] p-3 text-center">
          <div className="text-xs text-[#71717a] uppercase font-semibold">Done</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{stats.done}</div>
        </div>
        <div className="rounded-xl border border-[#232326] bg-[#0f0f12] p-3 text-center">
          <div className="text-xs text-[#71717a] uppercase font-semibold">Running</div>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-1">{stats.running}</div>
        </div>
        <div className="rounded-xl border border-[#232326] bg-[#0f0f12] p-3 text-center">
          <div className="text-xs text-[#71717a] uppercase font-semibold">Pending</div>
          <div className="text-2xl font-bold text-[#a1a1aa] font-mono mt-1">{stats.pending}</div>
        </div>
        <div className="rounded-xl border border-[#232326] bg-[#0f0f12] p-3 text-center">
          <div className="text-xs text-[#71717a] uppercase font-semibold">Failed</div>
          <div className="text-2xl font-bold text-red-400 font-mono mt-1">{stats.failed}</div>
        </div>
      </div>

      {/* Step-by-Step Plan Outline (if available) */}
      {plan && plan.steps && (
        <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-4">
          <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase mb-3">
            High-Level Plan ({plan.steps.length} Steps)
          </h3>
          <div className="space-y-2">
            {plan.steps.map((step: any, index: number) => (
              <div
                key={step.id || index}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-[#141418] border border-[#1f1f23] text-xs"
              >
                <span className="w-5 h-5 rounded-full bg-[#202025] flex items-center justify-center font-mono text-[11px] text-[#a1a1aa]">
                  {index + 1}
                </span>
                <span className="text-white flex-1">{step.text}</span>
                <span className="text-[11px] text-[#71717a] capitalize">{step.status || 'pending'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline: Parallel Batches */}
      {batches.length > 0 && (
        <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-4">
          <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase mb-3">
            Execution Timeline (Parallel Batches)
          </h3>
          <div className="space-y-3">
            {batches.map((batch, batchIndex) => (
              <div key={batchIndex} className="p-3 rounded-xl bg-[#121215] border border-[#1c1c20]">
                <div className="text-[11px] font-mono font-semibold text-[#71717a] mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  BATCH {batchIndex + 1} ({batch.length} {batch.length === 1 ? 'task' : 'tasks'} in parallel)
                </div>
                <div className="flex flex-wrap gap-2">
                  {batch.map((t: any) => (
                    <div
                      key={t.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                        t.status === 'done'
                          ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300'
                          : t.status === 'running'
                          ? 'bg-amber-950/20 border-amber-900/30 text-amber-300 animate-pulse'
                          : t.status === 'failed'
                          ? 'bg-red-950/20 border-red-900/30 text-red-300'
                          : 'bg-[#18181b] border-[#27272a] text-[#a1a1aa]'
                      }`}
                    >
                      {getStatusIcon(t.status)}
                      <span className="font-medium truncate max-w-xs">{t.title}</span>
                      {t.agentRole && (
                        <span className="text-[10px] opacity-70 font-mono uppercase">
                          [{t.agentRole}]
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Tasks List */}
      <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase">
            Task Graph Execution List ({filteredTasks.length})
          </h3>

          {/* Role Filter Tabs */}
          {roles.length > 1 && (
            <div className="flex items-center gap-1 bg-[#141418] border border-[#232326] p-1 rounded-xl">
              {roles.map(r => (
                <button
                  key={r}
                  onClick={() => setFilterRole(r)}
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium capitalize transition-colors ${
                    filterRole === r
                      ? 'bg-[#27272a] text-white'
                      : 'text-[#71717a] hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#71717a]">
            No tasks registered yet. Submit a task in Workspace to trigger the Multi-Agent Planner.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task: any) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#141418] border border-[#1c1c20] hover:border-[#27272a] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {getStatusIcon(task.status)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{task.title}</div>
                    {task.description && (
                      <div className="text-[11px] text-[#71717a] truncate max-w-lg mt-0.5">
                        {task.description}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {task.agentRole && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono border ${getRoleBadge(
                        task.agentRole
                      )}`}
                    >
                      {task.agentRole}
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-[#71717a] uppercase bg-[#1a1a1e] px-2 py-0.5 rounded">
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
