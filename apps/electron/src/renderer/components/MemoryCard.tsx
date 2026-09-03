import React from 'react';
import {
  Pin,
  Archive,
  Trash2,
  ExternalLink,
  Sparkles,
  Layers,
  Bug,
  Terminal,
  FileCode,
  Sliders,
  CheckCircle2,
  Clock,
  Globe,
  Star,
  Copy,
  Check,
} from 'lucide-react';

export interface MemoryEntryUI {
  id: string;
  title: string;
  summary: string;
  key: string;
  value: string;
  category: string;
  scope: string;
  projectRoot?: string;
  sessionId?: string;
  source: string;
  importance: number;
  confidence: number;
  pinned: boolean;
  archived: boolean;
  hits: number;
  relevance: number;
  similarity?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
}

interface MemoryCardProps {
  entry: MemoryEntryUI;
  onPin: (id: string, pinned: boolean) => void;
  onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
  onInspect: (entry: MemoryEntryUI) => void;
}

const MemoryCardComponent: React.FC<MemoryCardProps> = ({
  entry,
  onPin,
  onArchive,
  onDelete,
  onInspect,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'architecture':
        return {
          icon: <Layers className="w-3.5 h-3.5 text-sky-400" />,
          label: 'Architecture',
          badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
          border: 'border-sky-500/20 hover:border-sky-500/40',
        };
      case 'bug':
        return {
          icon: <Bug className="w-3.5 h-3.5 text-amber-400" />,
          label: 'Bug Fix',
          badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          border: 'border-amber-500/20 hover:border-amber-500/40',
        };
      case 'user_preference':
        return {
          icon: <Sliders className="w-3.5 h-3.5 text-rose-400" />,
          label: 'User Preference',
          badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          border: 'border-rose-500/20 hover:border-rose-500/40',
        };
      case 'command':
        return {
          icon: <Terminal className="w-3.5 h-3.5 text-emerald-400" />,
          label: 'Command',
          badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          border: 'border-emerald-500/20 hover:border-emerald-500/40',
        };
      case 'file':
        return {
          icon: <FileCode className="w-3.5 h-3.5 text-teal-400" />,
          label: 'Key File',
          badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
          border: 'border-teal-500/20 hover:border-teal-500/40',
        };
      case 'task':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />,
          label: 'Task Outcome',
          badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
          border: 'border-violet-500/20 hover:border-violet-500/40',
        };
      case 'checkpoint':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-blue-400" />,
          label: 'Checkpoint',
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          border: 'border-blue-500/20 hover:border-blue-500/40',
        };
      case 'global':
        return {
          icon: <Globe className="w-3.5 h-3.5 text-yellow-400" />,
          label: 'Global Fact',
          badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
          border: 'border-yellow-500/20 hover:border-yellow-500/40',
        };
      default:
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-neutral-400" />,
          label: category.replace(/[-_]/g, ' '),
          badge: 'bg-neutral-800 text-neutral-300 border-neutral-700',
          border: 'border-neutral-800 hover:border-neutral-700',
        };
    }
  };

  const config = getCategoryConfig(entry.category);

  return (
    <div
      onClick={() => onInspect(entry)}
      className={`group relative rounded-2xl bg-[#121216] border ${config.border} p-4 transition-all duration-200 hover:shadow-xl hover:shadow-black/40 cursor-pointer flex flex-col justify-between space-y-3 ${
        entry.pinned ? 'ring-1 ring-amber-500/30 bg-[#16161b]' : ''
      } ${entry.archived ? 'opacity-60 saturate-50' : ''}`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2">
          {/* Category Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.badge}`}
          >
            {config.icon}
            <span className="capitalize">{config.label}</span>
          </span>

          {/* Scope Badge */}
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#1e1e24] text-neutral-400 border border-[#2a2a32]">
            {entry.scope === 'global' ? 'Global' : entry.scope === 'session' ? 'Session' : 'Project'}
          </span>

          {/* Vector Similarity Match Meter */}
          {typeof entry.similarity === 'number' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-2.5 h-2.5" />
              {Math.round(entry.similarity * 100)}% match
            </span>
          )}

          {/* Pinned Indicator */}
          {entry.pinned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Pin className="w-2.5 h-2.5 fill-amber-400" />
              Pinned
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div
          className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopy}
            title="Copy memory content"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => onPin(entry.id, !entry.pinned)}
            title={entry.pinned ? 'Unpin' : 'Pin to top & prioritize'}
            className={`p-1.5 rounded-lg transition-colors ${
              entry.pinned
                ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                : 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-800'
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${entry.pinned ? 'fill-amber-400' : ''}`} />
          </button>

          <button
            onClick={() => onArchive(entry.id, !entry.archived)}
            title={entry.archived ? 'Restore' : 'Archive'}
            className={`p-1.5 rounded-lg transition-colors ${
              entry.archived
                ? 'text-neutral-200 bg-neutral-800 hover:bg-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDelete(entry.id)}
            title="Delete memory permanently"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body / Title & Summary */}
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-neutral-100 line-clamp-1 group-hover:text-white transition-colors">
          {entry.title || entry.key}
        </h3>
        <p className="text-xs text-neutral-400 line-clamp-3 leading-relaxed font-mono">
          {entry.summary || entry.value}
        </p>
      </div>

      {/* Footer Meta */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1e1e24] text-[11px] text-neutral-400">
        <div className="flex items-center gap-3">
          {/* Importance */}
          <span className="flex items-center gap-1 text-amber-400/90 font-medium">
            <Star className="w-3 h-3 fill-amber-400/50" />
            {(entry.importance * 10).toFixed(1)}
          </span>

          {/* Recalled Hits */}
          {entry.hits > 0 && (
            <span className="text-neutral-400">
              Recalled {entry.hits} {entry.hits === 1 ? 'time' : 'times'}
            </span>
          )}

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {entry.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.2 rounded text-[9px] bg-neutral-800/80 text-neutral-400"
                >
                  #{t}
                </span>
              ))}
              {entry.tags.length > 2 && (
                <span className="text-[9px] text-neutral-400">+{entry.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-neutral-400 hover:text-neutral-300">
          <span>Inspect</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
};

export const MemoryCard = React.memo(MemoryCardComponent, (prev, next) => {
  return (
    prev.entry.id === next.entry.id &&
    prev.entry.updatedAt === next.entry.updatedAt &&
    prev.entry.pinned === next.entry.pinned &&
    prev.entry.archived === next.entry.archived &&
    prev.entry.importance === next.entry.importance &&
    prev.entry.hits === next.entry.hits &&
    prev.entry.title === next.entry.title &&
    prev.entry.value === next.entry.value
  );
});
