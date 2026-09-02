import React, { useState, useEffect } from 'react';

interface CheckpointsPageProps {
  sessionId: string | null;
  projectRoot: string;
}

export const CheckpointsPage: React.FC<CheckpointsPageProps> = ({
  sessionId,
  projectRoot,
}) => {
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [newCheckpointMsg, setNewCheckpointMsg] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadCheckpoints = async () => {
    if (!sessionId) return;
    if (typeof window.cluster !== 'undefined' && window.cluster.checkpoints) {
      try {
        const list = await window.cluster.checkpoints.list(sessionId);
        setCheckpoints(list || []);
      } catch (err) {
        console.error('Failed to load checkpoints', err);
      }
    }
  };

  useEffect(() => {
    loadCheckpoints();
  }, [sessionId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !projectRoot || isCreating) return;

    setIsCreating(true);
    setStatusMessage(null);
    try {
      const msg = newCheckpointMsg.trim() || `Manual Snapshot @ ${new Date().toLocaleTimeString()}`;
      await window.cluster.checkpoints.create({
        sessionId,
        projectRoot,
        message: msg,
      });
      setNewCheckpointMsg('');
      setStatusMessage('Checkpoint created successfully.');
      await loadCheckpoints();
    } catch (err: any) {
      setStatusMessage(`Error creating checkpoint: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRollback = async (checkpointId: string) => {
    if (!sessionId || !projectRoot || rollingBackId) return;

    const ok = window.confirm(
      'Are you sure you want to rollback to this checkpoint? Files in the workspace will be restored to this snapshot.'
    );
    if (!ok) return;

    setRollingBackId(checkpointId);
    setStatusMessage(null);
    try {
      const res = await window.cluster.checkpoints.rollback({
        sessionId,
        checkpointId,
        projectRoot,
      });
      setStatusMessage(`Rollback complete: ${res.restored?.length || 0} files restored.`);
      await loadCheckpoints();
    } catch (err: any) {
      setStatusMessage(`Rollback failed: ${err.message}`);
    } finally {
      setRollingBackId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#232326]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">Checkpoints & Rollbacks</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#18181b] border border-[#27272a] text-[#a1a1aa]">
              {checkpoints.length} saved
            </span>
          </div>
          <p className="text-xs text-[#71717a] mt-1">
            Safe file snapshots automatically captured before code generation and manual restore points.
          </p>
        </div>

        <button
          onClick={loadCheckpoints}
          className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl text-xs font-mono bg-[#141418] border border-[#27272a] text-cyan-300 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-[#71717a] hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* State Preserved Explainer */}
      <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center shrink-0 text-cyan-400 font-bold">
          ℹ
        </div>
        <div className="text-xs">
          <div className="font-semibold text-white mb-1">What State is Preserved?</div>
          <p className="text-[#71717a] leading-relaxed">
            Each checkpoint snapshots tracked workspace files into{' '}
            <code className="text-cyan-400 font-mono">~/.cluster/checkpoints/&lt;session&gt;/&lt;id&gt;/</code> along with git HEAD metadata and an integrity index. Rollback restores working files verbatim without corrupting unrelated files.
          </p>
        </div>
      </div>

      {/* Create Manual Checkpoint Form */}
      <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-5">
        <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase mb-3">
          Create Snapshot Checkpoint
        </h3>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            placeholder="Checkpoint message (e.g. Before refactoring database adapter)..."
            value={newCheckpointMsg}
            onChange={e => setNewCheckpointMsg(e.target.value)}
            className="flex-1 text-xs bg-[#141418] border border-[#232326] rounded-xl px-3.5 py-2.5 text-white placeholder-[#52525b] outline-none focus:border-[#3f3f46]"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 disabled:opacity-50 transition-all shrink-0"
          >
            {isCreating ? 'Saving...' : 'Take Checkpoint (Ctrl+G)'}
          </button>
        </form>
      </div>

      {/* Checkpoints Timeline */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase">
          Snapshot Timeline ({checkpoints.length})
        </h3>

        {checkpoints.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#232326] bg-[#0f0f12]/50 p-12 text-center">
            <div className="w-10 h-10 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center mx-auto mb-3 text-sm text-[#71717a]">
              ⎌
            </div>
            <div className="text-sm font-semibold text-white">No Checkpoints Saved</div>
            <p className="text-xs text-[#71717a] mt-1 max-w-sm mx-auto">
              Checkpoints are created automatically before code edits or manually with the button above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {checkpoints.slice().reverse().map(cp => {
              const isRollingBack = rollingBackId === cp.id;

              return (
                <div
                  key={cp.id}
                  className="rounded-xl border border-[#232326] bg-[#0f0f12] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#333338] transition-all"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#141418] border border-[#232326] flex items-center justify-center shrink-0 font-mono text-xs font-bold text-[#a1a1aa]">
                      #
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {cp.message || 'Manual Snapshot'}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-[#71717a] mt-1">
                        <span>ID: {cp.id.slice(0, 8)}</span>
                        {cp.gitHead && <span>Git: {cp.gitHead.slice(0, 7)}</span>}
                        {cp.files && <span>{cp.files.length} files</span>}
                        <span>{new Date(cp.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRollback(cp.id)}
                      disabled={isRollingBack}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                    >
                      {isRollingBack ? 'Restoring...' : 'Rollback to Snapshot'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
