import React, { useState, useEffect } from 'react';

interface BackgroundPageProps {
  jobs: any[];
  onRefresh?: () => void;
}

export const BackgroundPage: React.FC<BackgroundPageProps> = ({
  jobs: propJobs,
}) => {
  const [jobs, setJobs] = useState<any[]>(propJobs || []);
  const [newCommand, setNewCommand] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const [inspectJob, setInspectJob] = useState<any | null>(null);

  const fetchJobs = async () => {
    if (typeof window.cluster !== 'undefined' && window.cluster.jobs) {
      try {
        const list = await window.cluster.jobs.list();
        setJobs(list);
      } catch (err) {
        console.error('Failed to list jobs', err);
      }
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommand.trim() || isLaunching) return;

    setIsLaunching(true);
    try {
      if (typeof window.cluster !== 'undefined' && window.cluster.jobs?.start) {
        await window.cluster.jobs.start({ command: newCommand.trim() });
        setNewCommand('');
        await fetchJobs();
      }
    } catch (err) {
      console.error('Failed to start background job', err);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleStop = async (id: string) => {
    if (typeof window.cluster !== 'undefined' && window.cluster.jobs?.stop) {
      await window.cluster.jobs.stop(id);
      await fetchJobs();
    }
  };

  const handleRestart = async (id: string) => {
    if (typeof window.cluster !== 'undefined' && window.cluster.jobs?.restart) {
      await window.cluster.jobs.restart(id);
      await fetchJobs();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#232326]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">Background Processes</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#18181b] border border-[#27272a] text-[#a1a1aa]">
              {jobs.length} total
            </span>
          </div>
          <p className="text-xs text-[#71717a] mt-1">
            Track, launch, and manage continuous server processes, watchers, and CLI jobs.
          </p>
        </div>

        <button
          onClick={fetchJobs}
          className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white transition-colors"
        >
          Refresh List
        </button>
      </div>

      {/* Launch Process Form */}
      <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-5">
        <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase mb-3">
          Launch New Background Task
        </h3>
        <form onSubmit={handleLaunch} className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. npm run dev, python -m http.server 8000, cargo check --watch"
            value={newCommand}
            onChange={e => setNewCommand(e.target.value)}
            className="flex-1 font-mono text-xs bg-[#141418] border border-[#232326] rounded-xl px-3.5 py-2.5 text-white placeholder-[#52525b] outline-none focus:border-[#3f3f46]"
          />
          <button
            type="submit"
            disabled={isLaunching || !newCommand.trim()}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 disabled:opacity-50 transition-all shrink-0"
          >
            {isLaunching ? 'Starting...' : 'Launch Task'}
          </button>
        </form>
      </div>

      {/* Process List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase">
          Active & Recent Jobs
        </h3>

        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#232326] bg-[#0f0f12]/50 p-12 text-center">
            <div className="w-10 h-10 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center mx-auto mb-3 text-sm text-[#71717a]">
              ⚙
            </div>
            <div className="text-sm font-semibold text-white">No Background Processes</div>
            <p className="text-xs text-[#71717a] mt-1 max-w-sm mx-auto">
              Start a development server or command above, or let the coding agents run background tasks.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {jobs.slice().reverse().map(job => {
              const isRunning = job.status === 'running';
              const isDone = job.status === 'done';
              const isStopped = job.status === 'stopped';

              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-[#232326] bg-[#0f0f12] p-4 flex flex-col gap-3 hover:border-[#333338] transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isRunning
                            ? 'bg-amber-400 animate-pulse'
                            : isDone
                            ? 'bg-emerald-400'
                            : isStopped
                            ? 'bg-neutral-500'
                            : 'bg-red-400'
                        }`}
                      />
                      <span className="font-mono text-xs font-semibold text-white truncate max-w-lg">
                        $ {job.command}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                          isRunning
                            ? 'bg-amber-950/30 text-amber-300 border border-amber-800/30'
                            : isDone
                            ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-800/30'
                            : 'bg-[#18181b] text-[#71717a] border border-[#27272a]'
                        }`}
                      >
                        {job.status}
                      </span>

                      {isRunning ? (
                        <button
                          onClick={() => handleStop(job.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-950/30 text-red-300 border border-red-900/30 hover:bg-red-900/40 transition-colors"
                        >
                          Stop
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestart(job.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1c1c20] text-[#a1a1aa] border border-[#27272a] hover:text-white transition-colors"
                        >
                          Restart
                        </button>
                      )}

                      <button
                        onClick={() => setInspectJob(job)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#18181b] text-cyan-400 border border-[#27272a] hover:bg-[#222227] transition-colors"
                      >
                        Logs
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-[#71717a] border-t border-[#1c1c20] pt-2">
                    {job.pid && <span>PID: <strong className="text-[#a1a1aa]">{job.pid}</strong></span>}
                    {job.port && (
                      <span className="text-cyan-400 font-semibold bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-800/30">
                        Port: {job.port} (http://localhost:{job.port})
                      </span>
                    )}
                    {job.cwd && <span className="truncate max-w-xs">cwd: {job.cwd}</span>}
                    {job.startedAt && (
                      <span>Started: {new Date(job.startedAt).toLocaleTimeString()}</span>
                    )}
                    {job.durationMs && <span>Duration: {job.durationMs}ms</span>}
                  </div>

                  {job.output && (
                    <pre className="text-[11px] font-mono bg-[#070709] border border-[#1c1c20] rounded-lg p-2.5 text-[#a1a1aa] max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {job.output.slice(-1000)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inspect Output Modal */}
      {inspectJob && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6"
          onClick={() => setInspectJob(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-[800px] max-w-[95vw] h-[600px] max-h-[85vh] bg-[#121215] border border-[#2e2e33] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-3.5 border-b border-[#232326] flex items-center justify-between bg-[#18181b]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white font-mono">$ {inspectJob.command}</span>
                <span className="text-[10px] text-[#71717a] font-mono">PID: {inspectJob.pid}</span>
              </div>
              <button
                onClick={() => setInspectJob(null)}
                className="text-[#71717a] hover:text-white p-1 rounded hover:bg-[#232326]"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 p-4 overflow-auto bg-[#070709]">
              <pre className="font-mono text-xs text-cyan-200 whitespace-pre-wrap">
                {inspectJob.output || 'No output recorded.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
