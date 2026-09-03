import React, { useEffect, useState, useRef } from 'react';
import { Activity, Gauge, X, Cpu, Layers, Zap } from 'lucide-react';

interface PerfDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entriesCount: number;
  isVirtualized: boolean;
  activityCount: number;
}

export const PerfDiagnosticsModal: React.FC<PerfDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  entriesCount,
  isVirtualized,
  activityCount,
}) => {
  const [fps, setFps] = useState<number>(60);
  const [domNodes, setDomNodes] = useState<number>(0);
  const [jsHeapMb, setJsHeapMb] = useState<number | null>(null);
  const [renderLatencyMs, setRenderLatencyMs] = useState<number>(1.2);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafHandleRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const measureLoop = (time: number) => {
      frameCountRef.current++;
      const elapsed = time - lastTimeRef.current;
      if (elapsed >= 500) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setFps(currentFps);
        frameCountRef.current = 0;
        lastTimeRef.current = time;

        // Sample DOM elements count
        setDomNodes(document.querySelectorAll('*').length);

        // Sample Chromium memory if enabled
        const perfMem = (performance as any).memory;
        if (perfMem && perfMem.usedJSHeapSize) {
          setJsHeapMb(Math.round(perfMem.usedJSHeapSize / (1024 * 1024)));
        }

        // Measure layout frame time
        const start = performance.now();
        void document.body.offsetHeight; // force layout query
        setRenderLatencyMs(Number((performance.now() - start).toFixed(2)));
      }
      rafHandleRef.current = requestAnimationFrame(measureLoop);
    };

    rafHandleRef.current = requestAnimationFrame(measureLoop);

    return () => {
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[#121217] border border-cyan-500/30 shadow-2xl overflow-hidden p-6 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#23232c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">UI Performance Diagnostics</h2>
              <p className="text-[11px] text-zinc-400 font-mono">Cluster Real-time Frame Profiler</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 font-mono">
          <div className="p-3.5 rounded-xl bg-[#181820] border border-[#262630] space-y-1">
            <div className="text-[10px] uppercase text-zinc-400 font-sans font-semibold flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              Display Refresh Rate
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-bold ${
                  fps >= 50 ? 'text-emerald-400' : fps >= 30 ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {fps}
              </span>
              <span className="text-xs text-zinc-500">FPS</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-sans">
              {fps >= 50 ? 'Smooth 60 FPS target met' : 'Frame drops detected'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#181820] border border-[#262630] space-y-1">
            <div className="text-[10px] uppercase text-zinc-400 font-sans font-semibold flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-cyan-400" />
              Active DOM Nodes
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-bold ${
                  domNodes < 1500 ? 'text-cyan-400' : domNodes < 3000 ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {domNodes}
              </span>
              <span className="text-xs text-zinc-500">elements</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-sans">
              {isVirtualized ? 'Capped by Virtual Window' : 'Direct render mode'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#181820] border border-[#262630] space-y-1">
            <div className="text-[10px] uppercase text-zinc-400 font-sans font-semibold flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-purple-400" />
              JS Heap Memory
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-purple-300">
                {jsHeapMb !== null ? `${jsHeapMb}` : 'N/A'}
              </span>
              {jsHeapMb !== null && <span className="text-xs text-zinc-500">MB</span>}
            </div>
            <p className="text-[10px] text-zinc-400 font-sans">Renderer heap allocation</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#181820] border border-[#262630] space-y-1">
            <div className="text-[10px] uppercase text-zinc-400 font-sans font-semibold flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-indigo-400" />
              Reflow Latency
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-indigo-300">{renderLatencyMs}</span>
              <span className="text-xs text-zinc-500">ms</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-sans">Layout calculation speed</p>
          </div>
        </div>

        {/* Optimizations Status Checklist */}
        <div className="rounded-xl border border-[#252530] bg-[#16161d] p-3.5 space-y-2.5 text-xs font-mono">
          <div className="text-[11px] font-bold text-white uppercase tracking-wider font-sans">
            Active Performance Engines
          </div>
          <div className="space-y-1.5 text-zinc-300">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 font-sans">Virtual List Windowing:</span>
              <span className={isVirtualized ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                {isVirtualized ? 'ACTIVE (Overscan 4)' : 'OFF (<20 items)'}
              </span>
            </div>
            <div className="flex items-between justify-between">
              <span className="text-zinc-400 font-sans">Streaming RAF Throttling:</span>
              <span className="text-emerald-400 font-bold">ACTIVE (~25 FPS microbatch)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 font-sans">Tool Output Buffer:</span>
              <span className="text-emerald-400 font-bold">ACTIVE (75ms debounce)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 font-sans">Activity Log Buffer:</span>
              <span className="text-emerald-400 font-bold">ACTIVE (max 250 rows)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 font-sans">Card Props Memoization:</span>
              <span className="text-emerald-400 font-bold">ENABLED (React.memo)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 font-sans">Total Session Items:</span>
              <span className="text-cyan-400 font-bold">{entriesCount} cards / {activityCount} events</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
