import React from 'react';
import {
  FileCode,
  FilePlus,
  FileEdit,
  FileCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ListOrdered,
  Sparkles,
} from 'lucide-react';
import type { FileProgressState } from '../hooks/useAgent';

interface FileProgressCardProps {
  progress: FileProgressState;
  dense?: boolean;
}

export const FileProgressCard: React.FC<FileProgressCardProps> = ({
  progress,
  dense = false,
}) => {
  const {
    action,
    status,
    file,
    fileIndex,
    totalFiles,
    lines,
    sizeBytes,
    reason,
    completedFiles = [],
    queuedFiles = [],
  } = progress;

  const safeTotalFiles = (totalFiles && totalFiles > 0) ? totalFiles : Math.max(1, completedFiles.length + queuedFiles.length + (file ? 1 : 0));
  const pct =
    safeTotalFiles > 0
      ? Math.round(
          (completedFiles.length / safeTotalFiles) * 100
        )
      : status === 'done'
      ? 100
      : 0;

  const isRunning = status === 'running';
  const isDone = status === 'done';
  const isFailed = status === 'failed';

  const actionLabel =
    action === 'writing'
      ? 'Writing file'
      : action === 'written'
      ? 'Wrote file'
      : action === 'patching'
      ? 'Patching file'
      : action === 'patched'
      ? 'Patched file'
      : action === 'reading'
      ? 'Reading file'
      : action === 'read'
      ? 'Read file'
      : 'File operation';

  const actionColor =
    action === 'writing' || action === 'written'
      ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
      : action === 'patching' || action === 'patched'
      ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
      : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';

  const ActionIcon =
    action === 'writing' || action === 'written'
      ? FilePlus
      : action === 'patching' || action === 'patched'
      ? FileEdit
      : FileCode;

  if (dense) {
    return (
      <div className="rounded-xl border border-blue-500/30 bg-[#0c121d] p-3 text-xs shadow-md space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isRunning ? (
              <Clock className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
            ) : isDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span className="font-bold text-white truncate">
              {actionLabel}: <code className="text-blue-300 font-mono">{file}</code>
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 shrink-0">
            {completedFiles.length}/{totalFiles} done ({pct}%)
          </span>
        </div>
        {reason && (
          <p className="text-[11px] text-neutral-400 italic truncate">
            Why: {reason}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-b from-[#0e1626] via-[#0b101c] to-[#080c14] p-4 shadow-xl space-y-4">
      {/* Header with Progress Bar */}
      <div className="space-y-2 pb-3 border-b border-blue-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-blue-500/20 text-blue-400">
              <ListOrdered className="w-4 h-4" />
            </span>
            <h3 className="text-xs font-bold text-white tracking-wide uppercase">
              Sequential File Generation
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {completedFiles.length} / {totalFiles} completed
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-blue-400">
            {pct}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Active Running File Section */}
      <div className="rounded-xl border border-blue-500/20 bg-[#121b2d]/80 p-3.5 space-y-2.5 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border flex items-center gap-1.5 ${actionColor}`}>
              <ActionIcon className="w-3.5 h-3.5" />
              <span>{actionLabel}</span>
            </span>
            <span className="text-xs text-neutral-400">
              File {fileIndex} of {totalFiles}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {lines !== undefined && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800/80 text-neutral-300 border border-neutral-700">
                {lines} lines
              </span>
            )}
            {sizeBytes !== undefined && sizeBytes > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800/80 text-neutral-300 border border-neutral-700">
                {(sizeBytes / 1024).toFixed(1)} KB
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                isRunning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : isDone
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              {isFailed && <AlertTriangle className="w-3 h-3 text-rose-400" />}
              <span>{status}</span>
            </span>
          </div>
        </div>

        {/* File Name */}
        <div className="flex items-center gap-2 text-sm font-mono text-white bg-black/40 px-3 py-2 rounded-lg border border-white/5">
          <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-semibold text-blue-200 select-all">{file}</span>
        </div>

        {/* Reason / Explanation */}
        {reason && (
          <div className="flex items-start gap-2 text-xs text-neutral-300 bg-blue-950/30 px-3 py-1.5 rounded-lg border border-blue-500/10">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-blue-300 font-medium">Why: </span>
              <span>{reason}</span>
            </div>
          </div>
        )}
      </div>

      {/* Queued Files Section */}
      {queuedFiles.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Queued Files ({queuedFiles.length})</span>
            </span>
            {queuedFiles.length > 0 && (
              <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                <span>Next up: {queuedFiles[0]}</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {queuedFiles.map((qFile, idx) => (
              <span
                key={qFile}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                  idx === 0
                    ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300 font-semibold shadow-sm'
                    : 'bg-[#121218] border-[#22222c] text-neutral-400'
                }`}
              >
                {idx === 0 && <span className="text-indigo-400 mr-1">▶</span>}
                {qFile}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Completed Files Section */}
      {completedFiles.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-white/5">
          <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Completed Files ({completedFiles.length})</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {completedFiles.map((cFile) => (
              <span
                key={cFile}
                className="px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>{cFile}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
