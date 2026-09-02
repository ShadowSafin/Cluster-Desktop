import React, { useState, useMemo } from 'react';

interface LogsPageProps {
  activity: string[];
  liveOutput: Record<string, string>;
  jobs: any[];
}

export const LogsPage: React.FC<LogsPageProps> = ({
  activity,
  liveOutput,
  jobs,
}) => {
  const [filter, setFilter] = useState<'all' | 'tools' | 'commands' | 'errors'>('all');
  const [search, setSearch] = useState('');
  const [showRawInspector, setShowRawInspector] = useState(false);
  const [selectedRawText, setSelectedRawText] = useState('');

  const filteredLines = useMemo(() => {
    return activity.filter(line => {
      const matchesSearch = !search || line.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      if (filter === 'all') return true;
      if (filter === 'tools') return line.includes('→') || line.includes('✓') || line.includes('tool');
      if (filter === 'commands') return line.includes('run_command') || line.includes('$') || line.includes('job');
      if (filter === 'errors') return line.toLowerCase().includes('error') || line.toLowerCase().includes('failed');
      return true;
    });
  }, [activity, filter, search]);

  const openRawOutput = (title: string, text: string) => {
    setSelectedRawText(`=== ${title} ===\n\n${text}`);
    setShowRawInspector(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#232326] bg-[#0f0f12] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">System & Tool Logs</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#18181b] border border-[#27272a] text-[#a1a1aa]">
              {activity.length} events
            </span>
          </div>
          <p className="text-xs text-[#71717a] mt-1">
            Real-time event feed from Emitter, tool output streaming, and background process logs.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#141418] border border-[#232326] p-1 rounded-xl">
            {(['all', 'tools', 'commands', 'errors'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filter === tab ? 'bg-[#27272a] text-white' : 'text-[#71717a] hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="px-6 py-3 border-b border-[#1c1c20] bg-[#0d0d10] flex items-center gap-3 shrink-0">
        <input
          type="text"
          placeholder="Search log messages, commands, or errors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-[#121215] border border-[#232326] rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-[#52525b] outline-none focus:border-[#3f3f46]"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-[#71717a] hover:text-white">
            Clear
          </button>
        )}
      </div>

      {/* Main Content Areas */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Live Command Outputs (if any currently streaming) */}
        {Object.keys(liveOutput).length > 0 && (
          <div className="rounded-2xl border border-cyan-500/30 bg-[#0d0d12] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                Live Tool Output Buffers ({Object.keys(liveOutput).length})
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(liveOutput).map(([callId, out]) => (
                <div key={callId} className="rounded-xl bg-black/60 border border-[#232326] p-3">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#71717a] mb-1">
                    <span>Stream ID: {callId}</span>
                    <button
                      onClick={() => openRawOutput(`Live Output ${callId}`, out)}
                      className="text-cyan-400 hover:text-cyan-300 underline"
                    >
                      Raw View
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-cyan-200 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {out.slice(-2000)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Commands Logs */}
        {jobs.length > 0 && (
          <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-4">
            <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase mb-3">
              Executed Commands History ({jobs.length})
            </h3>
            <div className="space-y-2">
              {jobs.slice(-8).reverse().map(j => (
                <div key={j.id} className="p-3 rounded-xl bg-[#141418] border border-[#1c1c20] text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5 font-mono">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          j.status === 'running'
                            ? 'bg-amber-400 animate-pulse'
                            : j.status === 'done'
                            ? 'bg-emerald-400'
                            : 'bg-red-400'
                        }`}
                      />
                      <span className="text-white font-semibold truncate">$ {j.command}</span>
                    </div>
                    <span className="text-[11px] text-[#71717a] uppercase shrink-0">{j.status}</span>
                  </div>
                  {j.output && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1f1f24] text-[11px]">
                      <span className="text-[#71717a] truncate max-w-md">{j.output.slice(0, 100)}...</span>
                      <button
                        onClick={() => openRawOutput(`Command: ${j.command}`, j.output)}
                        className="text-cyan-400 hover:text-cyan-300 font-mono ml-2"
                      >
                        inspect output →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Events Stream */}
        <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase">
              Event Log ({filteredLines.length})
            </h3>
            <span className="text-[11px] text-[#52525b] font-mono">Auto-scroll live</span>
          </div>

          {filteredLines.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#71717a]">
              No events matched the current filter.
            </div>
          ) : (
            <div className="font-mono text-xs space-y-1 max-h-[450px] overflow-y-auto">
              {filteredLines.slice(-100).reverse().map((line, i) => {
                const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('failed');
                const isTool = line.includes('→') || line.includes('✓');
                const isUser = line.toLowerCase().includes('user:');

                return (
                  <div
                    key={i}
                    className={`py-1.5 px-2.5 rounded border border-transparent hover:border-[#27272a] hover:bg-[#141418] transition-all flex items-start gap-2 ${
                      isError
                        ? 'text-red-300 bg-red-950/10'
                        : isTool
                        ? 'text-amber-200'
                        : isUser
                        ? 'text-cyan-300'
                        : 'text-[#a1a1aa]'
                    }`}
                  >
                    <span className="text-[#52525b] select-none text-[10px] w-6 shrink-0">{i + 1}</span>
                    <span className="break-all whitespace-pre-wrap flex-1">{line}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Raw Output Modal Inspector */}
      {showRawInspector && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6"
          onClick={() => setShowRawInspector(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-[800px] max-w-[95vw] h-[600px] max-h-[85vh] bg-[#121215] border border-[#2e2e33] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-3.5 border-b border-[#232326] flex items-center justify-between bg-[#18181b]">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                Raw Log Inspector
              </h3>
              <button
                onClick={() => setShowRawInspector(false)}
                className="text-[#71717a] hover:text-white p-1 rounded hover:bg-[#232326]"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 p-4 overflow-auto bg-[#070709]">
              <pre className="font-mono text-xs text-[#d4d4d8] whitespace-pre-wrap">
                {selectedRawText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
