import React from 'react';

interface CardProps {
  agent: string;
  phase: 'writing'|'reviewing'|'planning';
  file: string;
  progress: number;
}

const colorMap: Record<string, { bg: string; border: string; text: string; bar: string; glow: string }> = {
  writing: { bg: 'bg-[#0e1a16]', border: 'border-emerald-500/20', text: 'text-emerald-300', bar: 'bg-emerald-500', glow: 'glow-teal' },
  reviewing: { bg: 'bg-[#1a160e]', border: 'border-amber-500/20', text: 'text-amber-300', bar: 'bg-amber-500', glow: 'glow-amber' },
  planning: { bg: 'bg-[#16131e]', border: 'border-violet-500/20', text: 'text-violet-300', bar: 'bg-violet-500', glow: 'glow-violet' },
};

const Card: React.FC<CardProps> = ({ agent, phase, file, progress }) => {
  const c = colorMap[phase];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} ${c.glow} p-3 flex flex-col gap-2 min-w-[180px] flex-1`}>
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-semibold tracking-widest ${c.text}`}>{agent.toUpperCase()}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${phase==='writing'?'bg-emerald-400':phase==='reviewing'?'bg-amber-400':'bg-violet-400'} animate-pulse`} />
        <span className={`text-[11px] ${c.text} opacity-80`}>{phase}</span>
      </div>
      <div className="text-sm text-white font-mono truncate">{file}</div>
      <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
        <div className={`h-full ${c.bar} rounded-full transition-all duration-700`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export const TaskCards: React.FC = () => {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card agent="cora" phase="writing" file="auth/middleware.ts" progress={76} />
      <Card agent="milo" phase="reviewing" file="tests/auth.spec.ts" progress={52} />
      <Card agent="zephyr" phase="planning" file="docs/migration.md" progress={88} />
    </div>
  );
};
