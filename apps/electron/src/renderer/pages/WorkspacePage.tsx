import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Brain,
  Sparkles,
  LayoutGrid,
  AlignJustify,
  Columns,
  FileDiff,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Compass,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Target,
  Layers,
  ArrowRight,
  Archive,
  ArrowDown,
  Gauge,
} from 'lucide-react';
import { Composer } from '../components/Composer';
import { WorkflowCard, type CardType, type CardStatus } from '../components/WorkflowCard';
import { FileProgressCard } from '../components/FileProgressCard';
import { PerfDiagnosticsModal } from '../components/PerfDiagnosticsModal';
import { useVirtualList } from '../hooks/useVirtualList';
import type { TimelineEntry, AgentState, FileProgressState } from '../hooks/useAgent';

interface WorkspacePageProps {
  sessionTitle: string;
  entries: TimelineEntry[];
  agentState: AgentState;
  running: boolean;
  streamingText: string;
  liveOutput: Record<string, string>;
  activity: string[];
  pendingConfirm: any;
  taskGraph: any;
  plan: any;
  recalledMemories?: any[];
  fileProgress?: FileProgressState | null;
  activeSkill?: { skill: any; params: any; rawCommand: string } | null;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onConfirm: (approved: boolean) => void;
  onOpenTasks: () => void;
  onOpenDiffs: () => void;
}

type WorkspaceViewMode = 'cards' | 'compact' | 'tasks' | 'review';

const TimelineEntryCard: React.FC<{
  entry: TimelineEntry;
  isCompact: boolean;
  liveOutput: Record<string, string>;
  onOpenDiffs: () => void;
}> = React.memo(({ entry, isCompact, liveOutput, onOpenDiffs }) => {
  if (entry.kind === 'message' && entry.message) {
    const msg = entry.message;
    const isUser = msg.role === 'user';
    const isError = msg.kind === 'error';
    const isWarning = msg.kind === 'warning';
    const safeMsgContent = typeof msg.content === 'string' ? msg.content : '';

    if (isUser) {
      return (
        <WorkflowCard
          id={entry.id}
          type="user"
          status="info"
          title="User Request"
          summary={safeMsgContent}
          dense={isCompact}
        />
      );
    }

    if (isError) {
      return (
        <WorkflowCard
          id={entry.id}
          type="error"
          status="failed"
          title="Error Encountered"
          summary={safeMsgContent}
          dense={isCompact}
        />
      );
    }

    if (isWarning) {
      return (
        <WorkflowCard
          id={entry.id}
          type="warning"
          status="info"
          title="Warning / Note"
          summary={safeMsgContent}
          dense={isCompact}
        />
      );
    }

    return (
      <WorkflowCard
        id={entry.id}
        type="assistant"
        status="success"
        title="Cluster Assistant"
        summary={safeMsgContent}
        dense={isCompact}
      />
    );
  }

  if (entry.kind === 'tool' && entry.call) {
    const call = entry.call;
    const status: CardStatus =
      call.status === 'success'
        ? 'success'
        : call.status === 'failed'
        ? 'failed'
        : 'running';

    let type: CardType = 'step';
    let title = `Tool: ${call.name}`;
    let detail = call.name;
    let reason: string | undefined = (call.input as any)?.reason;
    let lines: number | undefined;
    let additions: number | undefined;
    let deletions: number | undefined;
    let sizeBytes: number | undefined;

    if (call.name === 'read_file') {
      type = 'file_read';
      const filePath = (call.input as any)?.path || '';
      detail = filePath;
      const lineCount = call.result?.data?.lines ?? call.result?.data?.lineCount;
      lines = lineCount;
      sizeBytes = call.result?.data?.sizeBytes;
      title =
        status === 'running'
          ? `Reading file: ${filePath}`
          : status === 'success'
          ? `Read file: ${filePath}`
          : `Failed reading: ${filePath}`;
    } else if (call.name === 'write_file') {
      type = 'file_write';
      const filePath = (call.input as any)?.path || '';
      detail = filePath;
      const data = call.result?.data as any;
      lines =
        data?.lines ??
        data?.lineCount ??
        (typeof (call.input as any)?.content === 'string'
          ? (call.input as any).content.split('\n').length
          : undefined);
      additions = data?.additions;
      deletions = data?.deletions;
      sizeBytes = data?.sizeBytes;
      title =
        status === 'running'
          ? `Writing file: ${filePath}`
          : status === 'success'
          ? `Wrote file: ${filePath}`
          : `Failed to write: ${filePath}`;
    } else if (call.name === 'patch_file') {
      type = 'file_patch';
      const filePath = (call.input as any)?.path || '';
      detail = filePath;
      const data = call.result?.data as any;
      additions = data?.additions;
      deletions = data?.deletions;
      title =
        status === 'running'
          ? `Patching file: ${filePath}`
          : status === 'success'
          ? `Patched file: ${filePath}`
          : `Failed to patch: ${filePath}`;
    } else if (call.name === 'run_command') {
      type = 'command';
      const cmd = (call.input as any)?.command || '';
      detail = cmd;
      title =
        status === 'running'
          ? `Running: ${cmd.slice(0, 45)}${cmd.length > 45 ? '…' : ''}`
          : status === 'success'
          ? `Executed: ${cmd.slice(0, 45)}${cmd.length > 45 ? '…' : ''}`
          : `Command failed: ${cmd.slice(0, 45)}${cmd.length > 45 ? '…' : ''}`;
    }

    const out =
      typeof liveOutput[call.id] === 'string'
        ? liveOutput[call.id]
        : typeof call.result?.output === 'string'
        ? call.result.output
        : undefined;

    const summaryText =
      call.result?.error?.message ||
      (status === 'success' && type === 'file_write'
        ? (call.result?.data as any)?.created
          ? `Created file with ${lines ?? additions ?? 0} lines.`
          : `Updated file (+${additions ?? 0} -${deletions ?? 0} lines, ${lines ?? 0} total).`
        : status === 'success' && type === 'file_patch'
        ? `Applied patch (+${additions ?? 0} -${deletions ?? 0} lines).`
        : status === 'success' && type === 'file_read'
        ? `Inspected file content (${lines ?? 0} lines).`
        : undefined);

    return (
      <WorkflowCard
        id={entry.id}
        type={type}
        status={status}
        title={title}
        detail={detail}
        summary={summaryText}
        output={out}
        metadata={{
          durationMs: call.durationMs,
          exitCode: call.result?.data?.exitCode,
          reason,
          lines,
          additions,
          deletions,
          sizeBytes,
        }}
        dense={isCompact}
        onAction={(action) => {
          if (action === 'view_diff') {
            onOpenDiffs();
          }
        }}
      />
    );
  }

  return null;
});

export const WorkspacePage: React.FC<WorkspacePageProps> = ({
  sessionTitle,
  entries,
  agentState,
  running,
  streamingText,
  liveOutput,
  activity,
  pendingConfirm,
  taskGraph,
  plan,
  recalledMemories,
  fileProgress,
  activeSkill,
  onSubmit,
  onCancel,
  onConfirm,
  onOpenTasks,
  onOpenDiffs,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showAllArchived, setShowAllArchived] = useState(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const isUserScrolledUpRef = useRef(false);

  const [viewMode, setViewMode] = useState<WorkspaceViewMode>(() => {
    try {
      return (localStorage.getItem('cluster:workspace_view_mode') as WorkspaceViewMode) || 'cards';
    } catch {
      return 'cards';
    }
  });
  const [showSpecDetails, setShowSpecDetails] = useState(false);
  const [showPerfModal, setShowPerfModal] = useState(false);

  const handleViewModeChange = (mode: WorkspaceViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('cluster:workspace_view_mode', mode);
    } catch {}
  };

  const isCompact = viewMode === 'compact';

  // Active / Archived items split
  const visibleEntries = useMemo(() => {
    if (entries.length > 45 && !showAllArchived) {
      return entries.slice(-35);
    }
    return entries;
  }, [entries, showAllArchived]);

  const isVirtualized = visibleEntries.length > 20;

  const {
    virtualItems,
    totalHeight,
    measureElement,
  } = useVirtualList({
    itemsCount: isVirtualized ? visibleEntries.length : 0,
    containerRef: scrollContainerRef,
    estimateHeight: isCompact ? 65 : 110,
    overscan: 4,
  });

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const scrolledUp = distanceFromBottom > 100;
    setIsUserScrolledUp(scrolledUp);
    isUserScrolledUpRef.current = scrolledUp;
  };

  // Smart auto-scroll: preserves user position if user scrolled up to read past cards
  useEffect(() => {
    if (!isUserScrolledUpRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries.length, running, streamingText ? Math.floor(streamingText.length / 50) : 0]);

  // Parse streaming reasoning if any
  const streamingThinkMatch = streamingText.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
  const streamingReasoning = streamingThinkMatch ? streamingThinkMatch[1] : null;
  const safeStreamingText = typeof streamingText === 'string' ? streamingText : '';
  const isCurrentlyThinking = Boolean(
    safeStreamingText.includes('<think>') && !safeStreamingText.includes('</think>')
  );
  const streamingCleanResponse = safeStreamingText
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();

  // Calculate plan progression
  const planStats = useMemo(() => {
    if (!plan || !plan.steps || plan.steps.length === 0) return null;
    const total = plan.steps.length;
    const done = plan.steps.filter((s: any) => s.status === 'done').length;
    const inProgress = plan.steps.filter((s: any) => s.status === 'in-progress').length;
    const failed = plan.steps.filter((s: any) => s.status === 'failed').length;
    const pct = Math.round((done / total) * 100);
    return { total, done, inProgress, failed, pct };
  }, [plan]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0d] min-w-0 overflow-hidden">
      {/* Top Session & Task Status Bar */}
      <div className="px-5 py-2.5 border-b border-[#232326] bg-[#0f0f12] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              running ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
            }`}
          />
          <span className="font-semibold text-xs text-white truncate max-w-sm">
            {sessionTitle || 'Workspace'}
          </span>
          {agentState.phase !== 'idle' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#1c1c20] text-amber-300 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {agentState.label || agentState.phase}
            </span>
          )}
        </div>

        {/* View Mode Switcher and Quick Navigation */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-0.5 bg-[#141418] border border-[#232328] p-0.5 rounded-xl">
            <button
              onClick={() => handleViewModeChange('cards')}
              title="Card Flow Mode"
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'cards'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cards</span>
            </button>
            <button
              onClick={() => handleViewModeChange('compact')}
              title="Compact Dense Mode"
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'compact'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Compact</span>
            </button>
            <button
              onClick={() => handleViewModeChange('tasks')}
              title="Task-Focused Split View"
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'tasks'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tasks</span>
            </button>
            <button
              onClick={() => handleViewModeChange('review')}
              title="Review / Diff-Focused View"
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'review'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileDiff className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Review</span>
            </button>
          </div>

          {plan && (
            <button
              onClick={onOpenTasks}
              className="px-2.5 py-1 rounded-lg text-xs bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white transition-colors"
            >
              Plan: {plan.steps?.length || 0} steps
            </button>
          )}

          <button
            onClick={() => setShowPerfModal(true)}
            title="UI Performance Profiler & Virtualization Diagnostics"
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 bg-[#141418] hover:bg-[#1f1f26] border border-[#232328] text-zinc-400 hover:text-cyan-300 transition-colors"
          >
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">60 FPS</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body: Supports Split View in 'tasks' Mode */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Side Panel in 'tasks' Mode */}
        {viewMode === 'tasks' && (
          <aside className="w-80 sm:w-96 border-r border-[#1e1e24] bg-[#0c0c10] overflow-y-auto p-4 space-y-4 shrink-0">
            <div className="flex items-center justify-between pb-2 border-b border-[#1e1e24]">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Task Execution Plan
                </h3>
              </div>
              {planStats && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
                  {planStats.pct}% Complete
                </span>
              )}
            </div>

            {/* Plan Steps List */}
            {plan?.steps && plan.steps.length > 0 ? (
              <div className="space-y-2">
                {plan.steps.map((step: any, idx: number) => {
                  const isDone = step.status === 'done';
                  const isRunning = step.status === 'in-progress';
                  const isFailed = step.status === 'failed';

                  return (
                    <div
                      key={step.id || idx}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        isRunning
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200 shadow-sm'
                          : isDone
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-neutral-300'
                          : isFailed
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          : 'bg-[#141418] border-[#22222a] text-neutral-400'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="shrink-0 mt-0.5">
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : isRunning ? (
                            <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          ) : isFailed ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border border-neutral-600 flex items-center justify-center text-[9px]">
                              {idx + 1}
                            </span>
                          )}
                        </span>
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className={`font-medium ${isDone ? 'line-through text-neutral-400' : ''}`}>
                            {step.text}
                          </p>
                          {step.role && (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[9px] uppercase font-semibold bg-neutral-800 text-neutral-400">
                              {step.role}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center rounded-xl bg-[#141418] border border-dashed border-[#232328] text-neutral-400 text-xs">
                No active plan for this session yet. Submit a prompt to generate an architectural plan.
              </div>
            )}

            {/* Acceptance Criteria in Split View */}
            {plan?.acceptanceCriteria && plan.acceptanceCriteria.length > 0 && (
              <div className="pt-2 border-t border-[#1e1e24] space-y-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Acceptance Criteria
                </span>
                <div className="space-y-1 text-xs">
                  {plan.acceptanceCriteria.map((crit: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-neutral-300">
                      <span className="text-emerald-400 mt-0.5">✓</span>
                      <span>{crit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Main Stream Area */}
        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0">
          <div className="max-w-4xl mx-auto space-y-3.5">
            {/* Cognitive Architecture & Strategy Spec Card */}
            {plan && (
              <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-[#12121c] via-[#101016] to-[#0c0c12] shadow-xl overflow-hidden transition-all">
                {/* Header */}
                <div className="p-4 flex items-start justify-between gap-3 border-b border-[#20202c]">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <Compass className="w-3.5 h-3.5" />
                        Cognitive Plan & Architecture Spec
                      </span>

                      {/* Classification Badges */}
                      {plan.classification &&
                        plan.classification.map((cat: string) => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#1c1c28] text-neutral-300 border border-[#2b2b3c] capitalize"
                          >
                            {cat.replace(/_/g, ' ')}
                          </span>
                        ))}
                    </div>

                    <h2 className="text-sm font-bold text-white tracking-tight">{plan.goal}</h2>

                    {plan.strategy && (
                      <p className="text-xs text-neutral-300 font-mono flex items-center gap-1.5">
                        <span className="text-indigo-400 font-bold">Strategy:</span>
                        {plan.strategy}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setShowSpecDetails((v) => !v)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#181822] text-neutral-300 border border-[#282838] hover:text-white transition-colors shrink-0"
                  >
                    <span>{showSpecDetails ? 'Hide Spec' : 'Inspect Spec'}</span>
                    {showSpecDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Real-Time Step Progress Tracker */}
                <div className="px-4 py-3 bg-[#0d0d12]/60 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400 font-medium">Execution Progress</span>
                    {planStats && (
                      <span className="font-mono font-bold text-emerald-400">
                        {planStats.done} / {planStats.total} Steps ({planStats.pct}%)
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-[#181820] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-500 rounded-full"
                      style={{ width: `${planStats?.pct || 0}%` }}
                    />
                  </div>

                  {/* Horizontal Steps Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {plan.steps.map((step: any, idx: number) => {
                      const isDone = step.status === 'done';
                      const isRunning = step.status === 'in-progress';
                      const isFailed = step.status === 'failed';

                      return (
                        <div
                          key={step.id || idx}
                          title={step.text}
                          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                            isRunning
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold shadow-sm'
                              : isDone
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-neutral-300'
                              : isFailed
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              : 'bg-[#14141c] border-[#222230] text-neutral-400'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : isRunning ? (
                            <Clock className="w-3 h-3 text-amber-400 animate-spin" />
                          ) : isFailed ? (
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                          ) : (
                            <span className="text-[10px] text-neutral-400">{idx + 1}.</span>
                          )}
                          <span className="truncate max-w-[160px]">{step.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Collapsible Deep Spec Details */}
                {showSpecDetails && (
                  <div className="p-4 border-t border-[#20202c] bg-[#0b0b10] space-y-3 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Alternatives Considered */}
                      {plan.alternativesConsidered && plan.alternativesConsidered.length > 0 && (
                        <div className="p-3 rounded-xl bg-[#121218] border border-[#202028] space-y-1.5">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                            Alternatives Considered
                          </span>
                          <ul className="space-y-1 text-neutral-300">
                            {plan.alternativesConsidered.map((alt: string, i: number) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-neutral-400 mt-0.5">•</span>
                                <span>{alt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Constraints & Risks */}
                      {(plan.constraints || plan.risks) && (
                        <div className="p-3 rounded-xl bg-[#121218] border border-[#202028] space-y-1.5">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                            Constraints & Risks
                          </span>
                          <ul className="space-y-1 text-neutral-300">
                            {(plan.constraints || []).map((con: string, i: number) => (
                              <li key={`con-${i}`} className="flex items-start gap-1.5 text-amber-300/90">
                                <span className="text-amber-400 mt-0.5">!</span>
                                <span>Constraint: {con}</span>
                              </li>
                            ))}
                            {(plan.risks || []).map((risk: string, i: number) => (
                              <li key={`risk-${i}`} className="flex items-start gap-1.5 text-rose-300/90">
                                <span className="text-rose-400 mt-0.5">⚠</span>
                                <span>Risk: {risk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Acceptance Criteria */}
                    {plan.acceptanceCriteria && plan.acceptanceCriteria.length > 0 && (
                      <div className="p-3 rounded-xl bg-[#121218] border border-[#202028] space-y-1.5">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Acceptance Criteria Checklist
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {plan.acceptanceCriteria.map((crit: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-neutral-300 font-mono">
                              <span className="text-emerald-400">✓</span>
                              <span>{crit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recalled Memory Banner */}
            {recalledMemories && recalledMemories.length > 0 && (
              <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/30 via-[#121218] to-purple-950/20 p-3.5 shadow-md space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-indigo-500/20 text-indigo-400">
                      <Brain className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-bold text-white">
                      Recalled {recalledMemories.length} Project {recalledMemories.length === 1 ? 'Memory' : 'Memories'} for this Task
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      sqlite-vec
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono">Injected into Agent Prompt</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {recalledMemories.map((m: any) => (
                    <div
                      key={m.id}
                      title={m.value}
                      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#181822] border border-[#2c2c3e] text-xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span className="font-medium text-neutral-200">{m.title || m.key}</span>
                      {typeof m.similarity === 'number' && (
                        <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                          {Math.round(m.similarity * 100)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review Mode Banner */}
            {viewMode === 'review' && (
              <div className="p-3.5 rounded-2xl bg-sky-950/30 border border-sky-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileDiff className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-semibold text-white">
                    Review Mode: Emphasizing code modifications and validation tests
                  </span>
                </div>
                <button
                  onClick={onOpenDiffs}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition-colors flex items-center gap-1"
                >
                  <span>Open Full Diff Review</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Live Active Skill Execution Banner */}
            {activeSkill && (
              <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-3.5 mb-3 flex items-center justify-between shadow-lg shadow-cyan-950/30 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-cyan-300 font-mono">
                        {activeSkill.rawCommand}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-200 border border-cyan-700/50">
                        {activeSkill.skill.manifest.displayName}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Executing prescribed skill instructions & workflow · Category:{' '}
                      <span className="text-zinc-200 uppercase">{activeSkill.skill.manifest.category}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-cyan-400 font-mono bg-cyan-900/40 px-2 py-1 rounded border border-cyan-800">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>active skill</span>
                </div>
              </div>
            )}

            {/* Live Sequential File Generation Progress */}
            {fileProgress && (
              <FileProgressCard progress={fileProgress} dense={isCompact} />
            )}

            {/* Welcome Card if empty */}
            {entries.length === 0 && !streamingText && (
              <div className="my-12 rounded-2xl border border-dashed border-[#232326] bg-[#0f0f12]/50 p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#27272a] to-[#18181b] border border-[#3f3f46] flex items-center justify-center mx-auto mb-4 shadow-md">
                  <span className="text-white font-bold text-lg">◈</span>
                </div>
                <h2 className="text-sm font-semibold text-white">Cluster Senior Coding Assistant</h2>
                <p className="text-xs text-[#71717a] mt-1.5 leading-relaxed max-w-lg mx-auto">
                  Submit a task, ask questions, or run commands. The system plans with architectural precision,
                  tests dynamically, and executes each step as a clear, real-time card.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 justify-center">
                  {[
                    'Run unit test suite',
                    'Inspect git status and uncommitted diffs',
                    'Add TypeScript type annotations',
                    'Explain repository structure',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => onSubmit(prompt)}
                      className="px-3 py-1.5 rounded-lg text-[11px] bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Archived History Collapsible Bar */}
            {entries.length > 45 && !showAllArchived && (
              <div className="rounded-xl border border-[#232328] bg-[#121217] p-3 mb-3 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2.5 text-xs text-[#a1a1aa]">
                  <Archive className="w-4 h-4 text-cyan-400" />
                  <span>
                    <strong className="text-white">{entries.length - 35} earlier events</strong> archived to maintain peak UI speed
                  </span>
                </div>
                <button
                  onClick={() => setShowAllArchived(true)}
                  className="text-xs px-3 py-1 rounded-lg bg-[#1a1a20] hover:bg-[#25252e] text-cyan-300 font-medium transition-colors border border-cyan-500/20"
                >
                  Show All in Virtual View
                </button>
              </div>
            )}

            {/* Virtualized or Direct Timeline Stream */}
            {isVirtualized ? (
              <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                {virtualItems.map(({ index, start }) => {
                  const entry = visibleEntries[index];
                  if (!entry) return null;
                  return (
                    <div
                      key={entry.id}
                      ref={(node) => measureElement(index, node)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${start}px)`,
                        paddingBottom: '12px',
                      }}
                    >
                      <TimelineEntryCard
                        entry={entry}
                        isCompact={isCompact}
                        liveOutput={liveOutput}
                        onOpenDiffs={onOpenDiffs}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleEntries.map((entry) => (
                  <TimelineEntryCard
                    key={entry.id}
                    entry={entry}
                    isCompact={isCompact}
                    liveOutput={liveOutput}
                    onOpenDiffs={onOpenDiffs}
                  />
                ))}
              </div>
            )}

            {/* Active streaming / thinking preview cards */}
            {running && isCurrentlyThinking && streamingReasoning && (
              <WorkflowCard
                id="streaming-thinking-card"
                type="thinking"
                status="running"
                title="Reasoning / Planning"
                output={streamingReasoning}
                defaultExpanded={true}
                dense={isCompact}
              />
            )}

            {running && streamingCleanResponse && (
              <WorkflowCard
                id="streaming-response-card"
                type="assistant"
                status="running"
                title="Cluster Assistant (Streaming)"
                summary={streamingCleanResponse.replace(/\n{3,}/g, '\n\n')}
                dense={isCompact}
              />
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Confirmation Banner if required */}
      {pendingConfirm && (
        <div className="p-4 bg-amber-950/40 border-t border-amber-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-white">Action Confirmation Required: </span>
              <span className="text-neutral-300">{pendingConfirm.tool} — {pendingConfirm.reason}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onConfirm(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
            >
              Decline
            </button>
            <button
              onClick={() => onConfirm(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-colors"
            >
              Approve
            </button>
          </div>
        </div>
      )}

      {/* Floating Scroll to Bottom Button when detached from bottom */}
      {isUserScrolledUp && (
        <div className="absolute bottom-24 right-8 z-30 animate-in fade-in slide-in-from-bottom-2">
          <button
            onClick={() => {
              setIsUserScrolledUp(false);
              isUserScrolledUpRef.current = false;
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
              }
            }}
            className="px-3.5 py-2 rounded-full bg-cyan-600/95 hover:bg-cyan-500 text-white text-xs font-semibold shadow-2xl border border-cyan-400/40 flex items-center gap-2 backdrop-blur-md transition-all"
          >
            <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
            <span>New events below</span>
          </button>
        </div>
      )}

      {/* Bottom Composer */}
      <div className="p-4 border-t border-[#1e1e24] bg-[#0c0c10]">
        <div className="max-w-4xl mx-auto">
          <Composer
            running={running}
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        </div>
      </div>

      {/* Real-time Profiling & Diagnostics Modal */}
      <PerfDiagnosticsModal
        isOpen={showPerfModal}
        onClose={() => setShowPerfModal(false)}
        entriesCount={entries.length}
        isVirtualized={isVirtualized}
        activityCount={activity.length}
      />
    </div>
  );
};
