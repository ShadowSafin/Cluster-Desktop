import React, { useState } from 'react';

interface Props {
  edits: Array<{ path: string; diff: string; additions:number; deletions:number; createdAt?: string }>;
  onRollback?: (checkpointId: string)=>void;
}

export const DiffViewer: React.FC<Props> = ({ edits, onRollback }) => {
  const [idx, setIdx] = useState(0);
  const edit = edits[idx];
  if (!edit) {
    return (
      <div className="rounded-xl border border-dashed border-[#232326] bg-[#0f0f11] p-6 text-center">
        <div className="text-sm text-[#71717a]">No file changes yet — diffs appear here after real `write_file` / `patch_file` tool calls.</div>
        <div className="text-xs text-[#71717a] mt-1">Try: “create a demo file” or “refactor auth module” — files are written via ToolRegistry and diffs streamed via `tool:end`.</div>
      </div>
    );
  }
  const lines = edit.diff.split('\n');
  return (
    <div className="rounded-xl border border-[#232326] bg-[#0f0f11] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#111113] border-b border-[#232326]">
        <div className="text-xs font-mono text-[#a1a1aa]">diff — {edit.path}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-500 text-black px-1.5 py-0.5 rounded font-mono">+{edit.additions} -{edit.deletions}</span>
          {edits.length>1 && (
            <div className="flex gap-1">
              <button onClick={()=>setIdx(i=>Math.max(0,i-1))} className="w-6 h-6 rounded bg-[#1c1c1f] border border-[#232326] text-xs">‹</button>
              <button onClick={()=>setIdx(i=>Math.min(edits.length-1,i+1))} className="w-6 h-6 rounded bg-[#1c1c1f] border border-[#232326] text-xs">›</button>
            </div>
          )}
        </div>
      </div>
      <pre className="p-3 text-xs font-mono leading-5 overflow-auto max-h-[220px] bg-[#0a0a0d]">
        {lines.map((l,i)=>{
          if (l.startsWith('@@')) return <div key={i} className="text-[#71717a]">{l}</div>;
          if (l.startsWith('-')) return <div key={i} className="text-red-400 bg-red-500/5 -mx-3 px-3">{l}</div>;
          if (l.startsWith('+')) return <div key={i} className="text-emerald-400 bg-emerald-500/5 -mx-3 px-3">{l}</div>;
          return <div key={i} className="text-[#a1a1aa]">{l}</div>;
        })}
      </pre>
    </div>
  );
};
