import React from 'react';
import { ShieldCheck, RefreshCw, Sparkles, Wrench } from 'lucide-react';
import type { AgentPhase } from '@cluster/shared';

export interface VerificationActiveBannerProps {
  phase: AgentPhase;
  label?: string;
  dense?: boolean;
}

export const VerificationActiveBanner: React.FC<VerificationActiveBannerProps> = ({ phase, label, dense }) => {
  const isVerifying = phase === 'verifying';
  const isCritiquing = phase === 'critiquing';
  const isRepairing = phase === 'repairing';
  const isReverifying = phase === 're-verifying';

  if (!isVerifying && !isCritiquing && !isRepairing && !isReverifying) {
    return null;
  }

  const icon = isRepairing ? (
    <Wrench className="w-4 h-4 text-amber-400 animate-pulse" />
  ) : isCritiquing ? (
    <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
  ) : isReverifying ? (
    <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
  ) : (
    <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
  );

  const title = isRepairing
    ? 'Automatic Self-Repair in Progress'
    : isCritiquing
    ? 'Self-Critique Review'
    : isReverifying
    ? 'Re-Verifying Repaired Code'
    : 'Automated Quality Verification';

  const subtitle =
    label ||
    (isRepairing
      ? 'Correcting detected issues before final completion...'
      : isCritiquing
      ? 'Evaluating usability, clutter, and control wiring...'
      : isReverifying
      ? 'Running second-pass verification on repaired components...'
      : 'Checking file integrity, syntax, imports, and UI overlap...');

  const borderColor = isRepairing
    ? 'border-amber-800/50 bg-amber-950/20'
    : isCritiquing
    ? 'border-purple-800/50 bg-purple-950/20'
    : 'border-emerald-800/50 bg-emerald-950/20';

  return (
    <div
      className={`rounded-xl border ${borderColor} p-3 mb-3 shadow-md flex items-center justify-between gap-3 text-xs backdrop-blur-sm transition-all animate-fadeIn`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="font-semibold text-white flex items-center gap-2">
            <span>{title}</span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/10 text-zinc-300">
              {phase}
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">{subtitle}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Active Gate</span>
      </div>
    </div>
  );
};
