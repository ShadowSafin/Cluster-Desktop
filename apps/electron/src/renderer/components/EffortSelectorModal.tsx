import React, { useEffect } from 'react';
import { Sliders, Check, Zap, Scale, Sparkles, X } from 'lucide-react';

export type EffortLevel = 'low' | 'balanced' | 'high';

export interface EffortOption {
  id: EffortLevel;
  label: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  badgeColor: string;
}

export const EFFORT_OPTIONS: EffortOption[] = [
  {
    id: 'low',
    label: 'Low',
    tagline: 'Fast & Concise',
    description: 'Swift responses with minimal thinking overhead. Best for quick edits, lookups, and simple syntax tweaks.',
    icon: Zap,
    badge: 'Fast',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    tagline: 'Standard Thoroughness',
    description: 'Optimal balance of speed and reasoning quality. Standard planning, execution, and verification passes.',
    icon: Scale,
    badge: 'Recommended',
    badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    id: 'high',
    label: 'High',
    tagline: 'Deep Reasoning & Verification',
    description: 'Maximum thinking budget with extensive planning, multi-pass critique, and comprehensive verification.',
    icon: Sparkles,
    badge: 'Deep Reasoning',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
];

export function formatEffortDisplayName(effort?: string): string {
  if (!effort) return 'Balanced';
  const lower = effort.toLowerCase();
  if (lower === 'low') return 'Low';
  if (lower === 'high') return 'High';
  return 'Balanced';
}

interface EffortSelectorModalProps {
  open: boolean;
  onClose: () => void;
  currentEffort: EffortLevel;
  onSelectEffort: (effort: EffortLevel) => void;
}

export const EffortSelectorModal: React.FC<EffortSelectorModalProps> = ({
  open,
  onClose,
  currentEffort,
  onSelectEffort,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '1') {
        onSelectEffort('low');
        onClose();
      } else if (e.key === '2') {
        onSelectEffort('balanced');
        onClose();
      } else if (e.key === '3') {
        onSelectEffort('high');
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, onSelectEffort]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[#23232a] bg-[#0c0c0e] shadow-2xl flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#1f1f24] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#16161c] border border-[#24242d] text-zinc-200 flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">Reasoning Effort</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Configure reasoning depth and verification thoroughness
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-[#18181e] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="p-3.5 space-y-2">
          {EFFORT_OPTIONS.map((opt, idx) => {
            const isSelected = currentEffort === opt.id;
            const Icon = opt.icon;

            return (
              <div
                key={opt.id}
                onClick={() => {
                  onSelectEffort(opt.id);
                  onClose();
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  isSelected
                    ? 'bg-[#18181f] border-[#383846] text-white shadow-md'
                    : 'bg-[#121215] border-[#1d1d22] text-zinc-300 hover:border-[#2b2b34] hover:bg-[#16161b]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                    isSelected
                      ? 'bg-[#22222c] border-[#383846] text-white'
                      : 'bg-[#17171d] border-[#22222a] text-zinc-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{opt.label}</span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${opt.badgeColor}`}>
                      {opt.badge}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 ml-auto">[{idx + 1}]</span>
                  </div>
                  <div className="text-[11px] font-medium text-zinc-300 mt-0.5">{opt.tagline}</div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{opt.description}</p>
                </div>

                <div className="shrink-0 pt-1">
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1f1f24] bg-[#09090b] flex items-center justify-between text-[11px] text-zinc-400">
          <span>Press 1, 2, or 3 to quickly select</span>
          <div className="flex items-center gap-1.5">
            <span>Active:</span>
            <span className="font-mono text-zinc-200 font-semibold">{formatEffortDisplayName(currentEffort)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
