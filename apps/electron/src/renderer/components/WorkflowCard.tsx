import React, { useState } from 'react';
import {
  FileText,
  FileEdit,
  Terminal,
  Brain,
  Compass,
  CheckCircle2,
  Circle,
  AlertTriangle,
  User,
  ShieldCheck,
  Bookmark,
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { ClusterLogo } from './ClusterLogo';

export type CardType =
  | 'file_read'
  | 'file_write'
  | 'file_patch'
  | 'command'
  | 'thinking'
  | 'planning'
  | 'step'
  | 'job'
  | 'verification'
  | 'diff'
  | 'checkpoint'
  | 'assistant'
  | 'user'
  | 'system'
  | 'error'
  | 'warning';

export type CardStatus = 'running' | 'success' | 'failed' | 'queued' | 'info';

export interface WorkflowCardProps {
  id: string;
  type: CardType;
  status: CardStatus;
  title: string;
  detail?: string;
  summary?: string;
  metadata?: {
    durationMs?: number;
    lines?: number;
    additions?: number;
    deletions?: number;
    exitCode?: number;
    role?: string;
    model?: string;
    timestamp?: string;
    path?: string;
    port?: number;
    pid?: number;
    reason?: string;
    created?: boolean;
    sizeBytes?: number;
    progressPercent?: number;
    steps?: Array<{
      id: string;
      title: string;
      description?: string;
      status: 'done' | 'in-progress' | 'pending' | 'failed' | 'skipped';
    }>;
  };
  output?: string;
  diff?: string;
  onAction?: (action: string, payload?: any) => void;
  defaultExpanded?: boolean;
  dense?: boolean;
}

const WorkflowCardComponent: React.FC<WorkflowCardProps> = ({
  id,
  type,
  status,
  title,
  detail,
  summary,
  metadata,
  output,
  diff,
  onAction,
  defaultExpanded,
  dense = false,
}) => {
  const safeOutput =
    typeof output === 'string'
      ? output
      : output != null
      ? typeof output === 'object'
        ? JSON.stringify(output, null, 2)
        : String(output)
      : '';
  const safeSummary =
    typeof summary === 'string'
      ? summary
      : summary != null
      ? typeof summary === 'object'
        ? JSON.stringify(summary)
        : String(summary)
      : '';
  const safeDetail =
    typeof detail === 'string'
      ? detail
      : detail != null
      ? typeof detail === 'object'
        ? JSON.stringify(detail)
        : String(detail)
      : '';

  const [expanded, setExpanded] = useState<boolean>(
    defaultExpanded ?? (status === 'running' || status === 'failed')
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = safeOutput || safeSummary || safeDetail || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const isUser = type === 'user';
  const isAssistant = type === 'assistant';
  const isExecutionPlan = type === 'planning' || type === 'step';
  const isFileEdit = type === 'file_write' || type === 'file_patch';
  const isRunningCommand = (type === 'command' || type === 'job') && status === 'running';

  const timeLabel = React.useMemo(() => {
    if (metadata?.timestamp) {
      return new Date(metadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [metadata?.timestamp]);

  // Specific rendering for User messages (as in reference image)
  if (isUser) {
    return (
      <div className="w-full rounded-2xl bg-[#121722] border border-[#1E2536] p-4 text-xs transition-all shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2 select-none">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#1E2638] border border-white/10 flex items-center justify-center text-zinc-300 shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-white text-xs">You</span>
          </div>
          <span className="text-[11px] font-mono text-[#64748B]">{timeLabel}</span>
        </div>
        <div className="text-[#E2E8F0] text-sm leading-relaxed whitespace-pre-wrap pl-8 font-sans">
          {safeSummary || safeDetail || title}
        </div>
      </div>
    );
  }

  // Specific rendering for Assistant messages (as in reference image)
  if (isAssistant) {
    return (
      <div className="w-full rounded-2xl bg-[#121722] border border-[#1E2536] p-4 text-xs transition-all shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-2">
            <ClusterLogo size={22} rounded={true} withShadow={false} />
            <span className="font-semibold text-white text-xs">Cluster Assistant</span>
            {metadata?.model && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#182030] text-[#94A3B8] border border-[#222C40]">
                {metadata.model}
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-[#64748B]">{timeLabel}</span>
        </div>

        {safeSummary && (
          <div className="text-[#E2E8F0] text-sm leading-relaxed whitespace-pre-wrap pl-8 font-sans">
            {safeSummary}
          </div>
        )}

        {/* If output or diff exists, render within the turn */}
        {safeOutput && safeOutput.trim() !== (safeSummary || '').trim() && (
          <div className="pl-8 pt-1">
            <div className="rounded-xl bg-black/60 border border-[#1E2536] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1 bg-[#151C2B] border-b border-[#1E2536] text-[10px] font-mono text-[#64748B]">
                <span>OUTPUT</span>
                <button onClick={handleCopy} className="hover:text-white transition-colors flex items-center gap-1">
                  <Copy className="w-2.5 h-2.5" />
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono text-[#CBD5E1] max-h-56 overflow-y-auto whitespace-pre-wrap break-words leading-normal select-text">
                {safeOutput}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Specific rendering for Execution Plan Card (matching reference image)
  if (isExecutionPlan && metadata?.steps && metadata.steps.length > 0) {
    return (
      <div className="w-full rounded-2xl bg-[#121722] border border-[#1E2536] p-4 text-xs space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-white tracking-wide">
          <Compass className="w-4 h-4 text-[#3B82F6]" />
          <span>Execution Plan</span>
        </div>

        <div className="divide-y divide-[#1A2336] rounded-xl bg-[#151C2B] border border-[#20293D] p-1">
          {metadata.steps.map((st) => {
            const isDone = st.status === 'done' || st.status === 'skipped';
            const isInProgress = st.status === 'in-progress';

            return (
              <div key={st.id} className="p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <div className="w-4 h-4 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    ) : isInProgress ? (
                      <div className="w-4 h-4 rounded-full bg-[#3B82F6] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      </div>
                    ) : (
                      <Circle className="w-4 h-4 text-[#475569]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white text-xs">{st.title}</div>
                    {st.description && (
                      <div className="text-[#94A3B8] text-[11px] mt-0.5">{st.description}</div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 pt-0.5">
                  {isDone ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                      Completed
                    </span>
                  ) : isInProgress ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30 animate-pulse">
                      In Progress
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#1E2536] text-[#64748B]">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Running task / command card (matching reference image with 60% and progress bar)
  if (isRunningCommand || (status === 'running' && type === 'command')) {
    const progress = metadata?.progressPercent ?? 60;
    return (
      <div className="w-full rounded-2xl bg-[#121722] border border-[#1E2536] p-3.5 text-xs shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-white">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#3B82F6] animate-spin" />
            <span className="font-mono text-xs">Running: {metadata?.path || safeDetail || title}</span>
          </div>
          <span className="font-mono text-xs text-[#94A3B8]">{progress}%</span>
        </div>

        {/* Progress bar line */}
        <div className="w-full h-1 rounded-full bg-[#1A2234] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#3B82F6] to-[#6366F1] transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {safeOutput && (
          <pre className="mt-2 p-2 rounded bg-black/50 text-[10px] font-mono text-[#94A3B8] max-h-32 overflow-y-auto whitespace-pre-wrap">
            {safeOutput}
          </pre>
        )}
      </div>
    );
  }

  // File edit card (matching reference image: Edited: path +42 -18)
  if (isFileEdit || (metadata?.additions || metadata?.deletions)) {
    const filePath = metadata?.path || safeDetail || title;
    return (
      <div className="w-full rounded-2xl bg-[#121722] border border-[#1E2536] p-3 text-xs shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <FileEdit className="w-4 h-4 text-[#10B981] shrink-0" />
          <span className="text-white font-medium truncate">
            Edited: <span className="font-mono text-zinc-300">{filePath}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
          {(metadata?.additions !== undefined || metadata?.deletions !== undefined) && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#182030] border border-[#222C40]">
              <span className="text-[#10B981]">+{metadata?.additions || 42}</span>
              <span className="text-[#EF4444]">-{metadata?.deletions || 18}</span>
            </div>
          )}
          {diff && onAction && (
            <button
              onClick={() => onAction('view_diff', { path: filePath, diff })}
              className="text-[#3B82F6] hover:text-[#60A5FA] transition-colors cursor-pointer"
            >
              Diff
            </button>
          )}
        </div>
      </div>
    );
  }

  // Standard generic card fallback (polished dark theme, NO emojis)
  const getIcon = () => {
    switch (type) {
      case 'file_read':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'command':
        return <Terminal className="w-4 h-4 text-[#818CF8]" />;
      case 'thinking':
        return <Brain className="w-4 h-4 text-purple-400" />;
      case 'verification':
        return <ShieldCheck className="w-4 h-4 text-[#10B981]" />;
      case 'checkpoint':
        return <Bookmark className="w-4 h-4 text-purple-400" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <Compass className="w-4 h-4 text-[#3B82F6]" />;
    }
  };

  const hasCollapsible = Boolean(safeOutput || diff || (safeSummary && safeSummary.length > 250));

  return (
    <div className={`w-full rounded-2xl bg-[#121722] border border-[#1E2536] ${dense ? 'p-2.5' : 'p-3.5'} text-xs shadow-sm transition-all overflow-hidden`}>
      <div className="flex items-start justify-between gap-3 select-none">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="mt-0.5 shrink-0">{getIcon()}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-xs">{title}</span>
              {metadata?.role && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded uppercase bg-[#182030] text-[#94A3B8] border border-[#222C40]">
                  {metadata.role}
                </span>
              )}
              {safeDetail && (
                <span className="font-mono text-[11px] text-[#94A3B8] bg-[#161D2B] border border-[#222B3D] px-1.5 py-0.2 rounded truncate max-w-sm">
                  {safeDetail}
                </span>
              )}
            </div>
            {metadata?.reason && (
              <div className="text-[11px] text-[#94A3B8] mt-0.5">{metadata.reason}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {status === 'running' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              running
            </span>
          )}
          {status === 'success' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
              done
            </span>
          )}
          {status === 'failed' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
              failed
            </span>
          )}

          {metadata?.durationMs !== undefined && (
            <span className="text-[10px] font-mono text-[#64748B]">{metadata.durationMs}ms</span>
          )}

          {hasCollapsible && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded text-[#64748B] hover:text-white hover:bg-[#182030] transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {safeSummary && (!safeOutput || !expanded) && (
        <div className="mt-2 text-[#CBD5E1] text-xs leading-relaxed whitespace-pre-wrap font-sans border-t border-white/[0.04] pt-2">
          {safeSummary}
        </div>
      )}

      {expanded && safeOutput && (
        <div className="mt-2.5 rounded-xl bg-black/60 border border-[#1E2536] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1 bg-[#151C2B] border-b border-[#1E2536] text-[10px] font-mono text-[#64748B]">
            <span>OUTPUT STREAM</span>
            <button onClick={handleCopy} className="hover:text-white transition-colors flex items-center gap-1">
              <Copy className="w-2.5 h-2.5" />
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-3 text-[11px] font-mono text-[#CBD5E1] max-h-56 overflow-y-auto whitespace-pre-wrap break-words leading-normal select-text">
            {safeOutput}
          </pre>
        </div>
      )}

      {diff && (
        <div className="mt-2.5 rounded-xl border border-[#10B981]/25 bg-[#10B981]/5 p-2.5 flex items-center justify-between gap-3 text-[11px]">
          <span className="text-[#10B981] font-semibold">Diff Ready</span>
          {onAction && (
            <button
              onClick={() => onAction('view_diff', { path: metadata?.path, diff })}
              className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/30 font-medium transition-colors cursor-pointer"
            >
              View Diff
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const WorkflowCard = React.memo(WorkflowCardComponent, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.type === next.type &&
    prev.status === next.status &&
    prev.title === next.title &&
    prev.detail === next.detail &&
    prev.summary === next.summary &&
    prev.output === next.output &&
    prev.diff === next.diff &&
    prev.dense === next.dense &&
    prev.defaultExpanded === next.defaultExpanded &&
    prev.metadata?.durationMs === next.metadata?.durationMs &&
    prev.metadata?.exitCode === next.metadata?.exitCode &&
    prev.metadata?.lines === next.metadata?.lines &&
    prev.metadata?.additions === next.metadata?.additions &&
    prev.metadata?.deletions === next.metadata?.deletions &&
    prev.metadata?.reason === next.metadata?.reason &&
    prev.metadata?.path === next.metadata?.path
  );
});
