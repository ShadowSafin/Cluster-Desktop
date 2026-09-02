import React, { useState, useRef, useEffect } from 'react';
import { Square, ArrowUp, Sparkles, Terminal } from 'lucide-react';

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  running?: boolean;
  onCancel?: () => void;
  placeholder?: string;
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
}) => {
  const [value, setValue] = useState('');
  const [skills, setSkills] = useState<CommandItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Fetch installed skills for autocomplete
  useEffect(() => {
    if (typeof window !== 'undefined' && window.cluster?.skills?.list) {
      window.cluster.skills.list().then((list: any[]) => {
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
      }).catch(() => {});
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
    }
  };

  const handleSelectCommand = (cmd: string) => {
    setValue(`${cmd} `);
    ref.current?.focus();
  };

  return (
    <div className="relative border border-[#232326] rounded-xl bg-[#111113] focus-within:border-[#2a2a2e] focus-within:bg-[#18181b] transition-colors">
      {/* Slash command autocomplete popup */}
      {isSlashActive && matchingCommands.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-[#16161c] border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-3 py-1.5 border-b border-zinc-800 text-[10px] font-medium text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Available Commands & Skills</span>
            <span className="font-mono text-zinc-500">Tab to complete</span>
          </div>
          <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
            {matchingCommands.map((cmd, idx) => (
              <div
                key={cmd.command}
                onMouseDown={() => handleSelectCommand(cmd.command)}
                className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                  idx === selectedIdx ? 'bg-cyan-600/20 text-white' : 'text-zinc-300 hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    {cmd.isSkill ? (
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-300">{cmd.command}</span>
                      <span className="text-xs text-zinc-300 truncate">{cmd.name}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">{cmd.description}</div>
                  </div>
                </div>
                {cmd.category && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0 ml-2">
                    {cmd.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 px-3 py-2.5">
        <span className="text-amber-400 mt-1 text-sm">›</span>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSelectedIdx(0);
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
          placeholder={
            placeholder ??
            (running
              ? 'Agent is actively executing tasks…'
              : 'Describe a task or command… (/skills, /refactor, /testgen, ⌘K)')
          }
          className="flex-1 bg-transparent outline-none resize-none text-sm text-white placeholder:text-[#71717a] max-h-[120px] min-h-[20px]"
          style={{ height: '20px' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
          }}
        />
      </div>
      <div className="flex items-center justify-between px-3 pb-2">
        <div className="text-[11px] text-[#71717a]">Enter send · Shift+Enter newline · / skills</div>
        <div className="flex items-center gap-2">
          {running && onCancel ? (
            <button
              onClick={onCancel}
              className="text-xs bg-rose-500/20 border border-rose-500/30 text-rose-300 px-3 py-1 rounded-md font-semibold hover:bg-rose-500/30 flex items-center gap-1.5 transition-colors"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop Agent</span>
            </button>
          ) : (
            <button
              onClick={() => {
                const t = value.trim();
                if (!t || disabled || running) return;
                onSubmit(t);
                setValue('');
              }}
              disabled={disabled || running || !value.trim()}
              className="text-xs bg-white text-black px-3 py-1 rounded-md font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 flex items-center gap-1 transition-colors"
            >
              <span>Send</span>
              <ArrowUp className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
