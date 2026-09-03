import React, { useState, useMemo, useRef } from 'react';
import { useVirtualList } from '../hooks/useVirtualList';

interface LogsPageProps {
  activity: string[];
  liveOutput: Record<string, string>;
  jobs: any[];
}

const LogLineRow: React.FC<{ line: string; idx: number }> = React.memo(({ line, idx }) => {
  const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('failed');
  const isTool = line.includes('→') || line.includes('✓');
  const isUser = line.toLowerCase().includes('user:');

  return (
    <div
      className={`py-1 px-2.5 rounded border border-transparent hover:border-[#27272a] hover:bg-[#141418] transition-all flex items-start gap-2 font-mono text-xs ${
        isError
          ? 'text-red-300 bg-red-950/10'
          : isTool
          ? 'text-amber-200'
          : isUser
          ? 'text-cyan-300'
          : 'text-[#a1a1aa]'
      }`}
    >
      <span className="text-[#52525b] select-none text-[10px] w-6 shrink-0 pt-0.5">{idx + 1}</span>
      <span className="break-all whitespace-pre-wrap flex-1">{line}</span>
    </div>
  );
});

const VirtualizedEventLogList: React.FC<{ lines: string[] }> = React.memo(({ lines }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVirtualized = lines.length > 40;

  const { virtualItems, totalHeight, measureElement } = useVirtualList({
    itemsCount: isVirtualized ? lines.length : 0,
    containerRef,
    estimateHeight: 28,
    overscan: 6,
  });

  if (lines.length === 0) {
    return <div className="text-center py-8 text-xs text-[#71717a]">No events matched the current filter.</div>;
  }

  if (!isVirtualized) {
    return (
      <div className="space-y-1 max-h-[450px] overflow-y-auto">
        {lines.map((line, idx) => (
          <LogLineRow key={idx} line={line} idx={idx} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="max-h-[450px] h-[450px] overflow-y-auto relative rounded-lg border border-[#1e1e24] bg-[#0c0c10] p-1"
      style={{ willChange: 'scroll-position' }}
    >
      <div style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}>
        {virtualItems.map(({ index, start }) => (
          <div
            key={index}
            ref={(el) => measureElement(index, el)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${start}px)`,
            }}
          >
            <LogLineRow line={lines[index]} idx={index} />
          </div>
        ))}
      </div>
    </div>
  );
});

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
    return activity.filter((line) => {
      const matchesSearch = !search || line.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      if (filter === 'all') return true;
      if (filter === 'tools') return line.includes('→') || line.includes('✓') || line.includes('tool');
      if (filter === 'commands') return line.includes('run_command') || line.includes('$') || line.includes('job');
      if (filter === 'errors') return line.toLowerCase().includes('error') || line.toLowerCase().includes('failed');
      return true;
    });
  }, [activity, filter, search]);

  const activeLiveCalls = Object.keys(liveOutput);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#232326] bg-[#0f0f12] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Execution Logs & Diagnostics</h1>
          <p className="text-xs text-[#71717a] mt-0.5">
            Real-time audit log of tool dispatches, streaming IPC chunks, and subshell processes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const fullLog = activity.join('\n');
              navigator.clipboard.writeText(fullLog);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#18181b] border border-[#27272a] text-[#d4d4d8] hover:text-white hover:bg-[#232326] transition-colors"
          >
            Copy Full Log
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 border-b border-[#1c1c20] bg-[#0d0d10] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1.5">
          {(['all', 'tools', 'commands', 'errors'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                filter === tab
                  ? 'bg-[#27272a] text-white shadow-sm font-semibold'
                  : 'text-[#71717a] hover:text-[#d4d4d8] hover:bg-[#18181b]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1 text-xs rounded-lg bg-[#141418] border border-[#232326] text-white placeholder-[#52525b] focus:outline-none focus:border-cyan-500/50 w-52"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[11px] text-[#71717a] hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Active Streaming Output / Live Tools */}
        {activeLiveCalls.length > 0 && (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <h3 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                  Active Tool Streams ({activeLiveCalls.length})
                </h3>
              </div>
            </div>
            <div className="space-y-3">
              {activeLiveCalls.map((callId) => (
                <div key={callId} className="rounded-xl bg-[#09090b] border border-cyan-500/20 p-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[11px] text-[#71717a] mb-2 border-b border-[#1c1c20] pb-1.5">
                    <span className="text-cyan-400">Call ID: {callId}</span>
                    <button
                      onClick={() => {
                        setSelectedRawText(liveOutput[callId] || '');
                        setShowRawInspector(true);
                      }}
                      className="text-cyan-300 hover:underline"
                    >
                      Expand Inspector ↗
                    </button>
                  </div>
                  <pre className="text-neutral-300 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono text-[11px]">
                    {liveOutput[callId] || '(waiting for output chunk...)'}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Process Command Jobs */}
        {jobs.length > 0 && (
          <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-4">
            <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase mb-3">
              Command Jobs & Shell Executions ({jobs.length})
            </h3>
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="p-3 rounded-xl bg-[#141418] border border-[#232326] text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          job.status === 'running'
                            ? 'bg-amber-400 animate-pulse'
                            : job.status === 'done'
                            ? 'bg-emerald-400'
                            : 'bg-red-400'
                        }`}
                      />
                      <span className="text-white font-semibold">{job.command}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                        job.status === 'running'
                          ? 'bg-amber-500/20 text-amber-300'
                          : job.status === 'done'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  {job.output && (
                    <div className="mt-2 pt-2 border-t border-[#1c1c20] flex items-center justify-between text-[#71717a] text-[11px]">
                      <span className="truncate max-w-md">{job.output.slice(0, 80)}...</span>
                      <button
                        onClick={() => {
                          setSelectedRawText(job.output);
                          setShowRawInspector(true);
                        }}
                        className="text-cyan-400 hover:underline"
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

        {/* Activity Events Stream - Virtualized */}
        <div className="rounded-2xl border border-[#232326] bg-[#0f0f12] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#71717a] tracking-wider uppercase">
              Event Log ({filteredLines.length})
            </h3>
            <span className="text-[11px] text-[#52525b] font-mono">Virtualized audit stream</span>
          </div>

          <VirtualizedEventLogList lines={filteredLines} />
        </div>
      </div>

      {/* Raw Output Modal Inspector */}
      {showRawInspector && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6"
          onClick={() => setShowRawInspector(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
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
            <div className="flex-1 p-4 overflow-y-auto bg-[#09090b] font-mono text-xs text-neutral-300 whitespace-pre-wrap">
              {selectedRawText || '(no output content)'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
