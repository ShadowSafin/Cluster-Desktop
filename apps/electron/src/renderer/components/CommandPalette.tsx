import React, { useEffect, useMemo, useState } from 'react';

interface Item {
  id: string;
  label: string;
  detail?: string;
  hotkey?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  items: Item[];
}

export const CommandPalette: React.FC<Props> = ({ open, onClose, onSelect, items }) => {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const filtered = useMemo(() => {
    if (!q) return items;
    const lower = q.toLowerCase();
    return items.filter(i=> i.label.toLowerCase().includes(lower) || i.detail?.toLowerCase().includes(lower) || i.id.toLowerCase().includes(lower));
  }, [q, items]);

  useEffect(()=>{
    if (open) { setQ(''); setSel(0); }
  }, [open]);

  useEffect(()=>{
    if (!open) return;
    const h = (e: KeyboardEvent)=>{
      if (e.key==='Escape') onClose();
      if (e.key==='ArrowDown') { e.preventDefault(); setSel(s=> Math.min(filtered.length-1, s+1)); }
      if (e.key==='ArrowUp') { e.preventDefault(); setSel(s=> Math.max(0, s-1)); }
      if (e.key==='Enter') { e.preventDefault(); const it = filtered[sel]; if (it) onSelect(it.id); }
    };
    window.addEventListener('keydown', h);
    return ()=> window.removeEventListener('keydown', h);
  }, [open, filtered, sel, onSelect, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[20vh] z-50" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="w-[560px] max-w-[90vw] bg-[#18181b] border border-[#2a2a2e] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#232326]">
          <span className="text-[#71717a]">⌘</span>
          <input autoFocus value={q} onChange={e=>{setQ(e.target.value); setSel(0);}} placeholder="Type a command or search..." className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-[#71717a]" />
          <span className="text-xs text-[#71717a] border border-[#232326] px-1.5 py-0.5 rounded">ESC</span>
        </div>
        <div className="max-h-[320px] overflow-y-auto py-2">
          {filtered.map((it,i)=> (
            <button key={it.id} onClick={()=>onSelect(it.id)} className={`w-full text-left px-4 py-2.5 flex items-center justify-between ${i===sel ? 'bg-[#232326] text-white' : 'text-[#a1a1aa] hover:bg-[#1c1c1f]'}`}>
              <div>
                <div className="text-sm">{it.label}</div>
                {it.detail && <div className="text-xs opacity-60">{it.detail}</div>}
              </div>
              {it.hotkey && <span className="text-xs border border-[#2a2a2e] px-1.5 py-0.5 rounded">{it.hotkey}</span>}
            </button>
          ))}
          {filtered.length===0 && <div className="px-4 py-6 text-center text-sm text-[#71717a]">No results</div>}
        </div>
        <div className="px-4 py-2 bg-[#111113] border-t border-[#232326] text-[11px] text-[#71717a]">↑↓ navigate · ⏎ select · ESC close</div>
      </div>
    </div>
  );
};
