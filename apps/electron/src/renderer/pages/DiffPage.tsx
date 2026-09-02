import React, { useState } from 'react';

interface DiffPageProps {
  edits: any[];
  onRollback: (checkpointId: string) => void;
  checkpoints: any[];
}

export const DiffPage: React.FC<DiffPageProps> = ({
  edits,
  onRollback,
  checkpoints,
}) => {
  const [selectedPath, setSelectedPath] = useState<string | null>(
    edits.length > 0 ? edits[0].path : null
  );

  const totalAdditions = edits.reduce((sum, e) => sum + (e.additions || 0), 0);
  const totalDeletions = edits.reduce((sum, e) => sum + (e.deletions || 0), 0);

  const currentEdit = edits.find(e => e.path === selectedPath) || edits[0];

  const renderDiffLines = (diffText: string) => {
    if (!diffText) return <div className="text-xs text-[#71717a]">No diff content available.</div>;

    const lines = diffText.split('\n');
    return lines.map((line, idx) => {
      let bg = '';
      let textCol = 'text-[#d4d4d8]';
      let sign = ' ';

      if (line.startsWith('+') && !line.startsWith('+++')) {
        bg = 'bg-emerald-950/25';
        textCol = 'text-emerald-300';
        sign = '+';
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        bg = 'bg-red-950/25';
        textCol = 'text-red-300';
        sign = '-';
      } else if (line.startsWith('@@')) {
        bg = 'bg-[#18181b]';
        textCol = 'text-cyan-400 font-bold';
      }

      return (
        <div key={idx} className={`flex font-mono text-[12px] leading-5 px-3 py-0.5 ${bg} hover:bg-white/5`}>
          <span className="w-8 text-[#52525b] select-none text-right pr-3">{idx + 1}</span>
          <span className={`w-4 select-none ${textCol}`}>{sign}</span>
          <span className={`flex-1 whitespace-pre-wrap break-all ${textCol}`}>{line.slice(1) || line}</span>
        </div>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#232326] bg-[#0f0f12] flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">Diff & Code Review</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#18181b] border border-[#27272a] text-[#a1a1aa]">
              {edits.length} {edits.length === 1 ? 'file' : 'files'} modified
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono mt-1">
            <span className="text-emerald-400">+{totalAdditions} additions</span>
            <span className="text-[#52525b]">·</span>
            <span className="text-red-400">-{totalDeletions} deletions</span>
          </div>
        </div>

        {checkpoints.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#71717a] hidden sm:inline">Latest checkpoint:</span>
            <button
              onClick={() => onRollback(checkpoints[checkpoints.length - 1].id)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#232326] text-amber-300 border border-amber-500/20 hover:bg-[#2d2d33] transition-colors"
            >
              Rollback All to Checkpoint
            </button>
          </div>
        )}
      </div>

      {edits.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md rounded-2xl border border-dashed border-[#232326] bg-[#0f0f12]/50 p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#18181b] border border-[#27272a] flex items-center justify-center mx-auto mb-3 text-sm text-[#71717a]">
              ±
            </div>
            <h3 className="text-sm font-semibold text-white">No File Edits in Session</h3>
            <p className="text-xs text-[#71717a] mt-1.5 leading-relaxed">
              When agents perform code changes with <code className="text-cyan-400 font-mono">write_file</code> or{' '}
              <code className="text-cyan-400 font-mono">patch_file</code>, unified diffs and file backups are automatically tracked here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Changed Files Sidebar */}
          <div className="w-72 border-r border-[#232326] bg-[#0d0d10] flex flex-col shrink-0">
            <div className="p-3 text-[11px] font-semibold text-[#71717a] uppercase tracking-wider border-b border-[#1c1c20]">
              Changed Files
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {edits.map(edit => {
                const isSelected = (selectedPath || edits[0].path) === edit.path;
                return (
                  <button
                    key={edit.path}
                    onClick={() => setSelectedPath(edit.path)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex flex-col gap-1 transition-all ${
                      isSelected
                        ? 'bg-[#18181b] text-white border border-[#2e2e33] shadow-sm'
                        : 'text-[#a1a1aa] hover:bg-[#121215] hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="font-mono text-xs truncate w-full font-medium" title={edit.path}>
                      {edit.path}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-emerald-400">+{edit.additions || 0}</span>
                      <span className="text-red-400">-{edit.deletions || 0}</span>
                      <span className="text-[#52525b] ml-auto uppercase">{edit.kind || 'edit'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Diff Viewer Area */}
          <div className="flex-1 flex flex-col bg-[#070709] min-w-0 overflow-hidden">
            {currentEdit && (
              <div className="px-5 py-3 border-b border-[#1c1c20] bg-[#0a0a0d] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0 font-mono text-xs">
                  <span className="text-[#71717a]">File:</span>
                  <span className="text-white font-semibold truncate">{currentEdit.path}</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-emerald-400">+{currentEdit.additions || 0}</span>
                  <span className="text-red-400">-{currentEdit.deletions || 0}</span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              <div className="rounded-xl border border-[#232326] bg-[#0b0b0e] overflow-hidden">
                {currentEdit ? (
                  renderDiffLines(currentEdit.diff)
                ) : (
                  <div className="p-8 text-center text-xs text-[#71717a]">Select a file from the left to view diff.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
