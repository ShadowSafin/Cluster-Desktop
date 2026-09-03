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

  // Specific rendering for User messages
  if (isUser) {
    return (
      <div className="w-full rounded-2xl bg-[#121215] border border-[#202026] p-4 text-xs transition-all shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2 select-none">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#1c1c22] border border-[#292933] flex items-center justify-center text-zinc-300 shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-zinc-200 text-xs">You</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">{timeLabel}</span>
        </div>
        <div className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap pl-8 font-sans">
          {safeSummary || safeDetail || title}
        </div>
      </div>
    );
  }

  // Specific rendering for Assistant messages
  if (isAssistant) {
    return (
      <div className="w-full rounded-2xl bg-[#121215] border border-[#202026] p-4 text-xs transition-all shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-2">
            <ClusterLogo size={20} rounded={true} withShadow={false} />
            <span className="font-semibold text-zinc-200 text-xs">Cluster Assistant</span>
            {metadata?.model && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#18181e] text-zinc-400 border border-[#25252e]">
                {metadata.model}
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-zinc-400">{timeLabel}</span>
        </div>

        {safeSummary && (
          <div className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap pl-7 font-sans">
            {safeSummary}
          </div>
        )}

        {/* If output or diff exists, render within the turn */}
        {safeOutput && safeOutput.trim() !== (safeSummary || '').trim() && (
          <div className="pl-7 pt-1">
            <div className="rounded-xl bg-[#09090b] border border-[#1f1f25] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1 bg-[#141418] border-b border-[#1f1f25] text-[10px] font-mono text-zinc-400">
                <span>OUTPUT</span>
                <button onClick={handleCopy} className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer">
                  <Copy className="w-2.5 h-2.5" />
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono text-zinc-300 max-h-56 overflow-y-auto whitespace-pre-wrap break-words leading-normal select-text">
                {safeOutput}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Specific rendering for Execution Plan Card (from real plan metadata)
  if (isExecutionPlan && metadata?.steps && metadata.steps.length > 0) {
    return (
      <div className="w-full rounded-2xl bg-[#121215] border border-[#202026] p-4 text-xs space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 tracking-wide">
          <Compass className="w-4 h-4 text-zinc-400" />
          <span>Execution Plan</span>
        </div>

        <div className="divide-y divide-[#1c1c22] rounded-xl bg-[#0e0e11] border border-[#1f1f25] p-1">
          {metadata.steps.map((st) => {
            const isDone = st.status === 'done' || st.status === 'skipped';
            const isInProgress = st.status === 'in-progress';

            return (
              <div key={st.id} className="p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    ) : isInProgress ? (
                      <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                      </div>
                    ) : (
                      <Circle className="w-4 h-4 text-zinc-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-zinc-200 text-xs">{st.title}</div>
                    {st.description && (
                      <div className="text-zinc-400 text-[11px] mt-0.5">{st.description}</div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 pt-0.5">
                  {isDone ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Completed
                    </span>
                  ) : isInProgress ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      In Progress
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#1a1a20] text-zinc-400 border border-[#262630]">
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

  // Running task / command card with progress
  if (isRunningCommand || (status === 'running' && type === 'command')) {
    const progress = metadata?.progressPercent;
    return (
      <div className="w-full rounded-2xl bg-[#121215] border border-[#202026] p-3.5 text-xs shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="font-mono text-xs">Running: {metadata?.path || safeDetail || title}</span>
          </div>
          {progress !== undefined && (
            <span className="font-mono text-xs text-zinc-400">{progress}%</span>
          )}
        </div>

        {/* Progress bar line if progress is known */}
        {progress !== undefined && (
          <div className="w-full h-1 rounded-full bg-[#18181c] overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {safeOutput && (
          <pre className="mt-2 p-2 rounded bg-black/60 border border-[#1c1c22] text-[10px] font-mono text-zinc-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
            {safeOutput}
          </pre>
        )}
      </div>
    );
  }

  // File edit card
  if (isFileEdit || (metadata?.additions || metadata?.deletions)) {
    const filePath = metadata?.path || safeDetail || title;
    return (
      <div className="w-full rounded-2xl bg-[#121215] border border-[#202026] p-3 text-xs shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <FileEdit className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-zinc-200 font-medium truncate">
            Edited: <span className="font-mono text-zinc-300">{filePath}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
          {(metadata?.additions !== undefined || metadata?.deletions !== undefined) && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#18181e] border border-[#262630]">
              <span className="text-emerald-400">+{metadata?.additions || 0}</span>
              <span className="text-rose-400">-{metadata?.deletions || 0}</span>
            </div>
          )}
          {diff && onAction && (
            <button
              onClick={() => onAction('view_diff', { path: filePath, diff })}
              className="text-zinc-300 hover:text-white transition-colors cursor-pointer text-xs"
            >
              Diff
            </button>
          )}
        </div>
      </div>
    );
  }

  // Standard generic card fallback (polished true black/charcoal theme, NO emojis)
  const getIcon = () => {
    switch (type) {
      case 'file_read':
        return <FileText className="w-4 h-4 text-zinc-400" />;
      case 'command':
        return <Terminal className="w-4 h-4 text-zinc-400" />;
      case 'thinking':
        return <Brain className="w-4 h-4 text-zinc-400" />;
      case 'verification':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'checkpoint':
        return <Bookmark className="w-4 h-4 text-zinc-400" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <Compass className="w-4 h-4 text-zinc-400" />;
    }
  };

  const hasCollapsible = Boolean(safeOutput || diff || (safeSummary && safeSummary.length > 250));

  return (
    <div className={`w-full rounded-2xl bg-[#121215] border border-[#202026] ${dense ? 'p-2.5' : 'p-3.5'} text-xs shadow-sm transition-all overflow-hidden`}>
      <div className="flex items-start justify-between gap-3 select-none">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="mt-0.5 shrink-0">{getIcon()}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-zinc-200 text-xs">{title}</span>
              {metadata?.role && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded uppercase bg-[#18181e] text-zinc-400 border border-[#262630]">
                  {metadata.role}
                </span>
              )}
              {safeDetail && (
                <span className="font-mono text-[11px] text-zinc-400 bg-[#16161b] border border-[#22222a] px-1.5 py-0.2 rounded truncate max-w-sm">
                  {safeDetail}
                </span>
              )}
            </div>
            {metadata?.reason && (
              <div className="text-[11px] text-zinc-400 mt-0.5">{metadata.reason}</div>
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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              done
            </span>
          )}
          {status === 'failed' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
              failed
            </span>
          )}

          {metadata?.durationMs !== undefined && (
            <span className="text-[10px] font-mono text-zinc-500">{metadata.durationMs}ms</span>
          )}

          {hasCollapsible && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#18181e] transition-colors cursor-pointer"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {safeSummary && (!safeOutput || !expanded) && (
        <div className="mt-2 text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-sans border-t border-white/[0.04] pt-2">
          {safeSummary}
        </div>
      )}

      {expanded && safeOutput && (
        <div className="mt-2.5 rounded-xl bg-[#09090b] border border-[#1f1f25] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1 bg-[#141418] border-b border-[#1f1f25] text-[10px] font-mono text-zinc-400">
            <span>OUTPUT STREAM</span>
            <button onClick={handleCopy} className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer">
              <Copy className="w-2.5 h-2.5" />
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-3 text-[11px] font-mono text-zinc-300 max-h-56 overflow-y-auto whitespace-pre-wrap break-words leading-normal select-text">
            {safeOutput}
          </pre>
        </div>
      )}

      {diff && (
        <div className="mt-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-2.5 flex items-center justify-between gap-3 text-[11px]">
          <span className="text-emerald-400 font-semibold">Diff Ready</span>
          {onAction && (
            <button
              onClick={() => onAction('view_diff', { path: metadata?.path, diff })}
              className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-medium transition-colors cursor-pointer"
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
