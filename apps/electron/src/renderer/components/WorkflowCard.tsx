import React, { useState } from 'react';
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

  // Color themes and icons
  const getTheme = () => {
    switch (type) {
      case 'file_read':
        return {
          icon: '📄',
          accentBorder: 'border-cyan-500/20 hover:border-cyan-500/40',
          accentBadge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
          accentText: 'text-cyan-400',
          bgGlow: 'bg-[#0b1015]/70',
        };
      case 'file_write':
      case 'file_patch':
        return {
          icon: '✍️',
          accentBorder: 'border-blue-500/20 hover:border-blue-500/40',
          accentBadge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          accentText: 'text-blue-400',
          bgGlow: 'bg-[#0b121c]/70',
        };
      case 'command':
        return {
          icon: '⚡',
          accentBorder:
            status === 'failed'
              ? 'border-red-500/30'
              : 'border-indigo-500/20 hover:border-indigo-500/40',
          accentBadge:
            status === 'failed'
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          accentText: status === 'failed' ? 'text-red-400' : 'text-indigo-400',
          bgGlow: 'bg-[#0e0d17]/70',
        };
      case 'thinking':
      case 'planning':
        return {
          icon: '🧠',
          accentBorder: 'border-teal-500/20 hover:border-teal-500/40',
          accentBadge: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
          accentText: 'text-teal-400',
          bgGlow: 'bg-[#0a1414]/70',
        };
      case 'step':
        return {
          icon: '🎯',
          accentBorder:
            status === 'failed'
              ? 'border-red-500/30'
              : 'border-amber-500/20 hover:border-amber-500/40',
          accentBadge:
            status === 'failed'
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/20',
          accentText: 'text-amber-400',
          bgGlow: 'bg-[#14120a]/70',
        };
      case 'job':
        return {
          icon: '⚙️',
          accentBorder: 'border-violet-500/20 hover:border-violet-500/40',
          accentBadge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
          accentText: 'text-violet-400',
          bgGlow: 'bg-[#120d18]/70',
        };
      case 'verification':
        return {
          icon: '🧪',
          accentBorder:
            status === 'failed'
              ? 'border-rose-500/30'
              : 'border-emerald-500/20 hover:border-emerald-500/40',
          accentBadge:
            status === 'failed'
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          accentText: status === 'failed' ? 'text-rose-400' : 'text-emerald-400',
          bgGlow: 'bg-[#0d1410]/70',
        };
      case 'diff':
        return {
          icon: '✨',
          accentBorder: 'border-emerald-500/20 hover:border-emerald-500/40',
          accentBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          accentText: 'text-emerald-400',
          bgGlow: 'bg-[#0d1410]/70',
        };
      case 'checkpoint':
        return {
          icon: '⎌',
          accentBorder: 'border-purple-500/20 hover:border-purple-500/40',
          accentBadge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          accentText: 'text-purple-400',
          bgGlow: 'bg-[#120b18]/70',
        };
      case 'user':
        return {
          icon: '👤',
          accentBorder: 'border-cyan-500/30 hover:border-cyan-500/50',
          accentBadge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
          accentText: 'text-cyan-300',
          bgGlow: 'bg-[#141418]',
        };
      case 'assistant':
        return {
          icon: <ClusterLogo size={14} />,
          accentBorder: 'border-[#27272d] hover:border-[#383842]',
          accentBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          accentText: 'text-white',
          bgGlow: 'bg-[#0f0f13]',
        };
      case 'error':
        return {
          icon: '⚠️',
          accentBorder: 'border-red-500/40',
          accentBadge: 'bg-red-500/15 text-red-300 border-red-500/30',
          accentText: 'text-red-400',
          bgGlow: 'bg-red-950/15',
        };
      case 'warning':
        return {
          icon: '⚡',
          accentBorder: 'border-amber-500/40',
          accentBadge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          accentText: 'text-amber-400',
          bgGlow: 'bg-amber-950/15',
        };
      case 'system':
      default:
        return {
          icon: 'ℹ️',
          accentBorder: 'border-[#27272a]',
          accentBadge: 'bg-[#18181b] text-[#a1a1aa] border-[#27272a]',
          accentText: 'text-[#d4d4d8]',
          bgGlow: 'bg-[#0d0d10]',
        };
    }
  };

  const theme = getTheme();

  const renderStatusBadge = () => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            running
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            done
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            failed
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1c1c21] text-[#a1a1aa] border border-[#27272a]">
            queued
          </span>
        );
      case 'info':
      default:
        return null;
    }
  };

  const hasCollapsible = Boolean(safeOutput || diff || (safeSummary && safeSummary.length > 250));

  return (
    <div
      className={`w-full ${dense ? 'rounded-xl' : 'rounded-2xl'} border transition-all duration-200 shadow-sm overflow-hidden ${theme.bgGlow} ${theme.accentBorder} text-xs`}
    >
      {/* Card Header */}
      <div className={`${dense ? 'p-2.5' : 'p-3.5'} flex items-center justify-between gap-3 select-none`}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="text-sm shrink-0">{theme.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold tracking-tight text-white text-[12px]">
                {title}
              </span>
              {metadata?.role && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#18181b] border border-[#27272a] text-[#a1a1aa]">
                  {metadata.role}
                </span>
              )}
              {safeDetail && (
                <span
                  className="font-mono text-[11px] text-[#a1a1aa] bg-[#141418] border border-[#232328] px-2 py-0.5 rounded-md truncate max-w-[280px] sm:max-w-md"
                  title={safeDetail}
                >
                  {safeDetail}
                </span>
              )}
              {metadata?.lines !== undefined && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {metadata.lines} lines
                </span>
              )}
              {metadata?.additions !== undefined && metadata.additions > 0 && (
                <span className="text-[10px] font-mono font-semibold text-emerald-400">
                  +{metadata.additions}
                </span>
              )}
              {metadata?.deletions !== undefined && metadata.deletions > 0 && (
                <span className="text-[10px] font-mono font-semibold text-rose-400">
                  -{metadata.deletions}
                </span>
              )}
            </div>
            {metadata?.reason && (
              <div className="flex items-center gap-1.5 text-[11px] text-blue-300/90 font-sans mt-0.5">
                <span className="font-semibold text-blue-400">Why:</span>
                <span className="truncate">{metadata.reason}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Status & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {renderStatusBadge()}

          {metadata?.durationMs !== undefined && (
            <span className="text-[10px] font-mono text-[#71717a]">
              {metadata.durationMs}ms
            </span>
          )}

          {metadata?.timestamp && (
            <span className="text-[10px] text-[#52525b]">
              {new Date(metadata.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}

          {hasCollapsible && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1 rounded-md text-[#71717a] hover:text-white hover:bg-[#1a1a20] transition-colors"
              title={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? '▴' : '▾'}
            </button>
          )}
        </div>
      </div>

      {/* Summary / Body content */}
      {safeSummary && (!safeOutput || !expanded || safeSummary.trim() !== safeOutput.trim()) && (
        <div className="px-3.5 pb-3 text-[12px] text-[#d4d4d8] leading-relaxed whitespace-pre-wrap font-sans break-words border-t border-white/[0.04] pt-2.5">
          {safeSummary}
        </div>
      )}

      {/* Expandable Live Output / Terminal Box */}
      {expanded && safeOutput && (
        <div className="px-3.5 pb-3">
          <div className="relative rounded-xl bg-black/70 border border-[#232328] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#121216] border-b border-[#1f1f24] text-[10px] font-mono text-[#71717a]">
              <span>OUTPUT STREAM</span>
              <button
                onClick={handleCopy}
                className="hover:text-white transition-colors text-[10px]"
              >
                {copied ? '✓ Copied' : 'Copy Output'}
              </button>
            </div>
            <pre className="p-3 text-[11px] font-mono text-[#a1a1aa] max-h-56 overflow-y-auto whitespace-pre-wrap break-all leading-normal select-text">
              {safeOutput}
            </pre>
          </div>
        </div>
      )}

      {/* Diff Preview / Action Bar */}
      {diff && (
        <div className="px-3.5 pb-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-2.5 flex items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-semibold">Diff Ready</span>
              {metadata?.additions !== undefined && (
                <span className="font-mono text-emerald-400">+{metadata.additions}</span>
              )}
              {metadata?.deletions !== undefined && (
                <span className="font-mono text-rose-400">-{metadata.deletions}</span>
              )}
            </div>
            {onAction && (
              <button
                onClick={() => onAction('view_diff', { path: metadata?.path, diff })}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 font-medium transition-colors"
              >
                View Diff →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action Footer for interactive cards (e.g. Checkpoints, Jobs) */}
      {type === 'checkpoint' && onAction && (
        <div className="px-3.5 py-2 bg-[#09090c] border-t border-[#1f1f23] flex items-center justify-between text-[11px]">
          <span className="text-[#71717a] font-mono">Snapshot Checkpoint</span>
          <button
            onClick={() => onAction('rollback_checkpoint', { id: metadata?.path || id })}
            className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 font-medium transition-colors"
          >
            Rollback to here
          </button>
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
