import React, { useState, useRef, useEffect } from 'react';
import { Square, ArrowUp } from 'lucide-react';

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  running?: boolean;
  onCancel?: () => void;
  placeholder?: string;
}

export const Composer: React.FC<Props> = ({
  onSubmit,
  disabled,
  running,
  onCancel,
  placeholder,
}) => {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const t = value.trim();
      if (!t || disabled || running) return;
      onSubmit(t);
      setValue('');
    }
  };

  return (
    <div className="border border-[#232326] rounded-xl bg-[#111113] focus-within:border-[#2a2a2e] focus-within:bg-[#18181b] transition-colors">
      <div className="flex items-start gap-2 px-3 py-2.5">
        <span className="text-amber-400 mt-1 text-sm">›</span>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
          placeholder={
            placeholder ??
            (running
              ? 'Agent is actively executing tasks…'
              : 'Describe a task or command… (? help, / actions, ⌘K palette)')
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
        <div className="text-[11px] text-[#71717a]">Enter send · Shift+Enter newline</div>
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
