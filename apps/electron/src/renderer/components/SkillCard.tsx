import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  FileText,
  Bug,
  Palette,
  AppWindow,
  Brain,
  ShieldCheck,
  GitBranch,
  Code,
  Zap,
  RefreshCw,
  FolderPlus,
  Cloud,
  Compass,
  Cpu,
  Sparkles,
  Download,
  Trash2,
  Pin,
  Check,
  Copy,
  Info,
  Power,
  Star,
} from 'lucide-react';
import type { SkillManifest, InstalledSkill } from '@cluster/shared';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Layers,
  CheckCircle2,
  FileText,
  Bug,
  Palette,
  AppWindow,
  Brain,
  ShieldCheck,
  GitBranch,
  Code,
  Zap,
  RefreshCw,
  FolderPlus,
  Cloud,
  Compass,
  Cpu,
  Sparkles,
};

const CATEGORY_COLORS: Record<string, string> = {
  coding: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  refactor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  review: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  debugging: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  docs: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ui: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  electron: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  memory: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  provider: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  workflow: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  automation: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  planning: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  testing: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
  deployment: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  project_setup: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  migration: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
};

interface Props {
  manifest: SkillManifest;
  installed?: InstalledSkill;
  onInstall?: (id: string) => Promise<void>;
  onUninstall?: (id: string) => Promise<void>;
  onToggle?: (id: string, enabled: boolean) => Promise<void>;
  onPin?: (id: string, pinned: boolean) => Promise<void>;
  onInspect?: (manifest: SkillManifest, installed?: InstalledSkill) => void;
  onInvokeDirect?: (command: string) => void;
}

export const SkillCard: React.FC<Props> = ({
  manifest,
  installed,
  onInstall,
  onUninstall,
  onToggle,
  onPin,
  onInspect,
  onInvokeDirect,
}) => {
  const [installing, setInstalling] = useState(false);
  const [copied, setCopied] = useState(false);

  const IconComp = (manifest.icon && ICON_MAP[manifest.icon]) || Sparkles;
  const isInstalled = Boolean(installed);
  const isEnabled = installed ? installed.enabled : false;
  const isPinned = installed ? installed.pinned : false;
  const categoryColor = CATEGORY_COLORS[manifest.category] || 'bg-zinc-800 text-zinc-300 border-zinc-700';

  const handleCopyCmd = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`/${manifest.invocationName}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onInstall || installing) return;
    try {
      setInstalling(true);
      await onInstall(manifest.id);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      onClick={() => onInspect?.(manifest, installed)}
      className={`group relative flex flex-col justify-between rounded-xl border bg-[#111115] p-4 transition-all hover:bg-[#15151a] hover:border-zinc-700 cursor-pointer ${
        isInstalled && !isEnabled ? 'opacity-60 border-dashed border-[#27272a]' : 'border-[#222226]'
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0 text-zinc-200 group-hover:scale-105 transition-transform">
              <IconComp className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  {manifest.displayName}
                </h3>
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/50">
                  v{manifest.version}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                <span>{manifest.author}</span>
                <span>·</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded uppercase font-medium border ${categoryColor}`}>
                  {manifest.category}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions (Pin / Status) */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isInstalled && onPin && (
              <button
                onClick={() => onPin(manifest.id, !isPinned)}
                title={isPinned ? 'Unpin skill' : 'Pin skill to top'}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isPinned
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'text-zinc-500 border-transparent hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                <Pin className="w-3.5 h-3.5 fill-current" />
              </button>
            )}
            {manifest.securityFlags?.isVerified && (
              <span title="Verified Skill Manifest" className="text-emerald-400 p-1">
                <ShieldCheck className="w-4 h-4" />
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-zinc-300 line-clamp-2 mb-3 leading-relaxed">
          {manifest.description}
        </p>

        {/* Slash Command Badge */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={handleCopyCmd}
            title="Click to copy invocation command"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#18181f] border border-cyan-500/30 text-cyan-300 font-mono text-xs hover:bg-cyan-950/40 hover:border-cyan-400 transition-colors"
          >
            <span>/{manifest.invocationName}</span>
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400/60" />}
          </button>

          {/* Ratings or Invocations */}
          <div className="flex items-center gap-1 text-[11px] text-zinc-400 ml-auto">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="font-semibold text-zinc-200">{manifest.stats?.rating?.toFixed(1) || '5.0'}</span>
            <span className="text-zinc-500">
              ({isInstalled ? `${installed?.invocationCount || 0} runs` : `${manifest.stats?.downloads || 0}`})
            </span>
          </div>
        </div>

        {/* Permissions / Capabilities */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {manifest.requiredPermissions.map((perm) => (
            <span
              key={perm}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400"
            >
              {perm}
            </span>
          ))}
          {manifest.requiredTools.slice(0, 2).map((tool) => (
            <span
              key={tool}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900/60 border border-zinc-800/80 text-zinc-500"
            >
              tool:{tool}
            </span>
          ))}
          {manifest.requiredTools.length > 2 && (
            <span className="text-[10px] text-zinc-500">+{manifest.requiredTools.length - 2}</span>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div
        className="pt-3 border-t border-[#1c1c22] flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {isInstalled ? (
            <>
              {onToggle && (
                <button
                  onClick={() => onToggle(manifest.id, !isEnabled)}
                  className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1 transition-colors ${
                    isEnabled
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  <span>{isEnabled ? 'Enabled' : 'Disabled'}</span>
                </button>
              )}
              {onUninstall && (
                <button
                  onClick={() => onUninstall(manifest.id)}
                  title="Uninstall skill"
                  className="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <button
              onClick={handleInstallClick}
              disabled={installing}
              className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${installing ? 'animate-bounce' : ''}`} />
              <span>{installing ? 'Installing…' : 'Install Skill'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isInstalled && onInvokeDirect && isEnabled && (
            <button
              onClick={() => onInvokeDirect(`/${manifest.invocationName}`)}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-md border border-zinc-700 transition-colors"
            >
              Run
            </button>
          )}
          <button
            onClick={() => onInspect?.(manifest, installed)}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800/80 flex items-center gap-1 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Details</span>
          </button>
        </div>
      </div>
    </div>
  );
};
