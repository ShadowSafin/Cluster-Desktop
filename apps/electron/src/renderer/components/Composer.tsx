import React, { useState, useRef, useEffect } from 'react';
import {
  Square,
  ArrowUp,
  Sparkles,
  Terminal,
  Paperclip,
  Code2,
  Mic,
  Maximize2,
  Sliders,
  Bot,
  ChevronDown,
} from 'lucide-react';

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  running?: boolean;
  onCancel?: () => void;
  placeholder?: string;
  model?: string;
}

interface CommandItem {
  command: string;
  name: string;
  description: string;
  category?: string;
  isSkill?: boolean;
}

const BUILTIN_COMMANDS: CommandItem[] = [
  { command: '/skills', name: 'Skills Hub', description: 'Open skills and marketplace hub' },
  { command: '/marketplace', name: 'Marketplace', description: 'Browse available skills catalog' },
  { command: '/multi', name: 'Multi-Agent', description: 'Run task with multi-agent coordination' },
  { command: '/clear', name: 'Clear Chat', description: 'Clear visible workspace timeline' },
  { command: '/help', name: 'Command Palette', description: 'Open global command palette' },
];

export const Composer: React.FC<Props> = ({
  onSubmit,
  disabled,
  running,
  onCancel,
  placeholder,
  model = 'Claude 3.5 Sonnet',
}) => {
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<'ask' | 'command'>('ask');
  const [skills, setSkills] = useState<CommandItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Fetch installed skills for autocomplete
  useEffect(() => {
    if (typeof window !== 'undefined' && window.cluster?.skills?.list) {
      window.cluster.skills
        .list()
        .then((list: any[]) => {
          const skillItems: CommandItem[] = list
            .filter((s: any) => s.enabled)
            .map((s: any) => ({
              command: `/${s.manifest.invocationName}`,
              name: s.manifest.displayName,
              description: s.manifest.description,
              category: s.manifest.category,
              isSkill: true,
            }));
          setSkills(skillItems);
        })
        .catch(() => {});
    }
  }, []);

  const allCommands = [...skills, ...BUILTIN_COMMANDS];

  // Match slash commands when input starts with "/"
  const isSlashActive = value.startsWith('/') && !value.includes(' ');
  const filterQuery = isSlashActive ? value.slice(1).toLowerCase() : '';
  const matchingCommands = isSlashActive
    ? allCommands.filter(
        (c) =>
          c.command.toLowerCase().includes(filterQuery) ||
          c.name.toLowerCase().includes(filterQuery)
      )
    : [];

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (isSlashActive && matchingCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % matchingCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + matchingCommands.length) % matchingCommands.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && matchingCommands[selectedIdx])) {
        e.preventDefault();
        const chosen = matchingCommands[selectedIdx];
        setValue(`${chosen.command} `);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const t = value.trim();
      if (!t || disabled || running) return;
      onSubmit(t);
      setValue('');
      if (ref.current) {
        ref.current.style.height = '48px';
      }
    }
  };

  const handleSelectCommand = (cmd: string) => {
    setValue(`${cmd} `);
    ref.current?.focus();
  };

  return (
    <div className="relative rounded-2xl border border-[#1E2536] bg-[#121722] p-3 shadow-xl transition-all select-none">
      {/* Slash command autocomplete popup */}
      {isSlashActive && matchingCommands.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-[#161D2B] border border-[#222C40] rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-3 py-1.5 border-b border-[#222C40] text-[10px] font-medium text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Available Commands & Skills</span>
            <span className="font-mono text-zinc-500">Tab to complete</span>
          </div>
          <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
            {matchingCommands.map((cmd, idx) => (
              <div
                key={cmd.command}
                onMouseDown={() => handleSelectCommand(cmd.command)}
                className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                  idx === selectedIdx ? 'bg-[#3B82F6]/20 text-white' : 'text-zinc-300 hover:bg-[#1C2538]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded bg-[#1B2232] border border-[#263147] flex items-center justify-center shrink-0">
                    {cmd.isSkill ? (
                      <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
                    ) : (
                      <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#3B82F6]">{cmd.command}</span>
                      <span className="text-xs text-zinc-200 truncate">{cmd.name}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">{cmd.description}</div>
                  </div>
                </div>
                {cmd.category && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1B2232] text-zinc-400 shrink-0 ml-2">
                    {cmd.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top row: Ask / Command segmented tabs */}
      <div className="flex items-center justify-between pb-2 mb-1 border-b border-white/[0.04]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('ask')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              mode === 'ask'
                ? 'bg-[#1C2436] text-white shadow-sm border border-[#27324B]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Ask
          </button>
          <button
            type="button"
            onClick={() => setMode('command')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              mode === 'command'
                ? 'bg-[#1C2436] text-white shadow-sm border border-[#27324B]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Command
          </button>
        </div>

        <button
          type="button"
          className="p-1 text-[#64748B] hover:text-white transition-colors rounded-md hover:bg-[#1A2234]"
          title="Fullscreen Composer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Middle Textarea */}
      <div className="px-1 py-1">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSelectedIdx(0);
          }}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={disabled}
          placeholder={placeholder ?? 'Describe a task or ask anything...'}
          className="w-full bg-transparent outline-none resize-none text-sm text-[#F1F5F9] placeholder:text-[#64748B] font-sans max-h-[160px] min-h-[48px] leading-relaxed"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
        />
      </div>

      {/* Keyboard hints row */}
      <div className="px-1 pb-2 text-[11px] font-mono text-[#64748B] flex items-center gap-3 select-none">
        <span>Enter to send</span>
        <span>Shift+Enter for new line</span>
        <span>/ to access skills</span>
      </div>

      {/* Bottom controls row */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
        {/* Model & Mode Pickers */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161D2B] hover:bg-[#1D2638] border border-[#222B3D] text-[11px] font-mono text-zinc-300 transition-colors"
          >
            <Bot className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span className="truncate max-w-[140px]">{model}</span>
            <ChevronDown className="w-3 h-3 text-[#64748B]" />
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161D2B] hover:bg-[#1D2638] border border-[#222B3D] text-[11px] font-mono text-zinc-300 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Balanced</span>
            <ChevronDown className="w-3 h-3 text-[#64748B]" />
          </button>
        </div>

        {/* Action icons & Send button */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-[#1A2234] transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-[#1A2234] transition-colors"
            title="Insert code snippet"
          >
            <Code2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-[#1A2234] transition-colors"
            title="Voice input"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>

          {running && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="ml-1 w-7 h-7 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 flex items-center justify-center transition-colors shadow-sm"
              title="Stop Agent"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const t = value.trim();
                if (!t || disabled || running) return;
                onSubmit(t);
                setValue('');
                if (ref.current) ref.current.style.height = '48px';
              }}
              disabled={disabled || running || !value.trim()}
              className="ml-1 w-7 h-7 rounded-xl bg-[#252D3F] hover:bg-[#323D54] disabled:opacity-40 disabled:cursor-not-allowed text-white border border-white/10 flex items-center justify-center transition-colors shadow-sm"
              title="Send message (Enter)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
