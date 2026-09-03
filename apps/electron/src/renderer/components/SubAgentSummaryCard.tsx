import React from 'react';
import {
  CheckCircle2,
  FileCode,
  Users,
  ShieldCheck,
  ListOrdered,
  Bot,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import type { SubAgentSwarmSummary } from '@cluster/shared';

interface SubAgentSummaryCardProps {
  summary: SubAgentSwarmSummary;
}

export const SubAgentSummaryCard: React.FC<SubAgentSummaryCardProps> = ({ summary }) => {
  const isPassed = summary.verification?.passed ?? true;

  return (
    <div className="my-4 rounded-xl border border-white/10 bg-gradient-to-b from-[#13151b] to-[#0f1117] p-5 shadow-xl shadow-black/30">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Users className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-wide truncate">
                Multi-Agent Swarm Synthesis
              </h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                  isPassed
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
              >
                {isPassed ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {isPassed ? 'All Roles Verified' : 'Check Completed'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 truncate">
              {summary.coordinatorNotes || 'Tasks planned, executed, and merged across specialized workers.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-mono text-neutral-300 border border-white/10">
            {summary.subAgentsCount || summary.subAgents.length} Agents Deployed
          </span>
          {summary.filesChanged.length > 0 && (
            <span className="rounded-md bg-cyan-500/10 px-2.5 py-1 text-xs font-mono text-cyan-400 border border-cyan-500/20">
              {summary.filesChanged.length} Files Modified
            </span>
          )}
        </div>
      </div>

      {/* Sub-Agent Contributions Breakdown */}
      <div className="mt-4">
        <h4 className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-2">
          <Bot className="h-3.5 w-3.5 text-indigo-400" />
          <span>Sub-Agent Contributions</span>
        </h4>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {summary.subAgents.map((sa, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium text-white truncate">
                    {sa.name}
                  </span>
                </div>
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
                  {sa.role}
                </span>
              </div>

              <p className="mt-2 text-xs text-neutral-300 line-clamp-2">
                {sa.summary}
              </p>

              <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500 border-t border-white/5 pt-1.5">
                <span>Tasks completed: {sa.tasksCompleted}</span>
                {sa.filesModified && sa.filesModified.length > 0 && (
                  <span>{sa.filesModified.length} files touched</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Architectural Decisions & Verification */}
      {summary.decisions && summary.decisions.length > 0 && (
        <div className="mt-4 rounded-lg border border-white/5 bg-black/20 p-3">
          <h4 className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-2">
            <ListOrdered className="h-3.5 w-3.5 text-cyan-400" />
            <span>Coordination Decisions</span>
          </h4>
          <ul className="space-y-1 text-xs text-neutral-400">
            {summary.decisions.map((dec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-cyan-500 font-mono text-[10px] mt-0.5">0{i + 1}</span>
                <span>{dec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Files Touched List */}
      {summary.filesChanged.length > 0 && (
        <div className="mt-4">
          <h4 className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-2">
            <FileCode className="h-3.5 w-3.5 text-purple-400" />
            <span>Files Modified by Swarm</span>
          </h4>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {summary.filesChanged.map((file, idx) => (
              <span
                key={idx}
                className="rounded bg-white/5 px-2 py-0.5 text-[11px] font-mono text-neutral-300 border border-white/5"
              >
                {file}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
