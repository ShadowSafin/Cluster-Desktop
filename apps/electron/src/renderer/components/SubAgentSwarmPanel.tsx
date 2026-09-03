import React, { useState } from 'react';
import {
  Bot,
  Users,
  Search,
  Layout,
  Server,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { SubAgentState, SubAgentHandoff, AgentRole } from '@cluster/shared';

interface SubAgentSwarmPanelProps {
  subAgents: Record<string, SubAgentState>;
  handoffs?: SubAgentHandoff[];
}

const ROLE_META: Record<
  AgentRole,
  { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string; border: string; text: string }
> = {
  planner: {
    label: 'Planner',
    icon: Cpu,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    text: 'text-indigo-300',
  },
  researcher: {
    label: 'Researcher',
    icon: Search,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    text: 'text-cyan-300',
  },
  coder: {
    label: 'Coder Alpha',
    icon: Bot,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    text: 'text-purple-300',
  },
  'ui-builder': {
    label: 'UI Specialist',
    icon: Layout,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-300',
  },
  'backend-builder': {
    label: 'Backend Builder',
    icon: Server,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-300',
  },
  reviewer: {
    label: 'Reviewer',
    icon: ShieldCheck,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-300',
  },
  tester: {
    label: 'Tester',
    icon: Zap,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-300',
  },
  context: {
    label: 'Context',
    icon: Search,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    text: 'text-teal-300',
  },
  coordinator: {
    label: 'Coordinator',
    icon: Users,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-300',
  },
};

export const SubAgentSwarmPanel: React.FC<SubAgentSwarmPanelProps> = ({
  subAgents,
  handoffs = [],
}) => {
  const [showHandoffs, setShowHandoffs] = useState(false);
  const agentList = Object.values(subAgents);

  if (agentList.length === 0) return null;

  const runningCount = agentList.filter((a) => a.status === 'running').length;
  const reportedCount = agentList.filter((a) => a.status === 'reported' || a.status === 'done').length;
  const totalCount = agentList.length;

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-[#13151b]/95 p-4 backdrop-blur shadow-lg shadow-black/20">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-sm">
            <Users className="h-4 w-4" />
            {runningCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-wide truncate">
                Sub-Agent Swarm
              </h3>
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-400 border border-cyan-500/20">
                {runningCount > 0 ? `${runningCount} active in parallel` : 'Coordinated'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 truncate">
              {reportedCount}/{totalCount} sub-agents completed & reported back to Main Coordinator
            </p>
          </div>
        </div>

        {handoffs.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHandoffs((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <span>Handoffs ({handoffs.length})</span>
            {showHandoffs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Grid of Sub-Agents */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {agentList.map((agent) => {
          const meta = ROLE_META[agent.role] || ROLE_META.coder;
          const RoleIcon = meta.icon;
          const isRunning = agent.status === 'running';
          const isReported = agent.status === 'reported' || agent.status === 'done';
          const isFailed = agent.status === 'failed';
          const isWaiting = agent.status === 'waiting';

          return (
            <div
              key={agent.id}
              className={`flex flex-col justify-between rounded-lg border p-3 transition-all ${
                isRunning
                  ? 'border-cyan-500/30 bg-cyan-950/15 shadow-sm shadow-cyan-900/10 ring-1 ring-cyan-500/20'
                  : isReported
                  ? 'border-emerald-500/20 bg-emerald-950/10'
                  : isFailed
                  ? 'border-red-500/30 bg-red-950/20'
                  : 'border-white/5 bg-white/[0.02]'
              }`}
            >
              {/* Top row: Role Icon, Name, Status Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${meta.bg} ${meta.color} border ${meta.border}`}>
                    <RoleIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-white truncate">
                      {agent.name}
                    </h4>
                    <span className={`text-[10px] ${meta.text}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="shrink-0">
                  {isRunning ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                      Working
                    </span>
                  ) : isReported ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Reported
                    </span>
                  ) : isFailed ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400 border border-red-500/20">
                      <AlertCircle className="h-2.5 w-2.5" />
                      Failed
                    </span>
                  ) : isWaiting ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2 py-0.5 text-[10px] font-medium text-neutral-400 border border-neutral-500/20">
                      <Clock className="h-2.5 w-2.5" />
                      Waiting
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400 border border-indigo-500/20">
                      Ready
                    </span>
                  )}
                </div>
              </div>

              {/* Current task or message */}
              <div className="mt-2.5 min-w-0">
                <p className="text-[11px] font-medium text-neutral-200 truncate">
                  {agent.currentTask || 'Assigned task'}
                </p>
                {agent.message && agent.message !== agent.currentTask && (
                  <p className="mt-0.5 text-[10px] text-neutral-400 truncate">
                    {agent.message}
                  </p>
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                  <span>Progress</span>
                  <span className="font-mono">{agent.progress ?? (isReported ? 100 : 0)}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isReported
                        ? 'bg-emerald-400'
                        : isFailed
                        ? 'bg-red-400'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, agent.progress || (isReported ? 100 : 15)))}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Handoff Coordination Feed */}
      {showHandoffs && handoffs.length > 0 && (
        <div className="mt-3 rounded-lg border border-white/5 bg-black/30 p-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <span className="text-xs font-medium text-neutral-300">
              Coordinator & Sub-Agent Handoff Log
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">
              Latest {Math.min(handoffs.length, 12)} events
            </span>
          </div>

          <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {handoffs.slice(-12).reverse().map((h) => {
              const isMerge = h.action === 'merged';
              const isReport = h.action === 'reported';
              const isDelegated = h.action === 'delegated';

              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 rounded bg-white/[0.02] px-2.5 py-1.5 text-[11px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${
                        isMerge
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isReport
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : isDelegated
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-white/10 text-neutral-300 border border-white/10'
                      }`}
                    >
                      {h.action}
                    </span>

                    <span className="text-white font-medium truncate">
                      {h.fromAgentName || h.fromAgentId}
                    </span>

                    <ArrowRight className="h-3 w-3 shrink-0 text-neutral-500" />

                    <span className="text-neutral-300 truncate">
                      {h.toAgentId === 'main-coordinator' ? 'Main Coordinator' : h.toAgentId}
                    </span>

                    {h.taskTitle && (
                      <span className="text-neutral-400 truncate max-w-[180px]">
                        ({h.taskTitle})
                      </span>
                    )}
                  </div>

                  <span className="shrink-0 text-[10px] text-neutral-500 font-mono">
                    {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
