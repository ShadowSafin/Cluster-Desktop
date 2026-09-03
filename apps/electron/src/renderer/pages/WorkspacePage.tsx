import React, { useRef, useEffect, useState } from 'react';
import {
  ChevronDown,
  MoreHorizontal,
  FileCode,
  FileEdit,
  Terminal,
  Compass,
  Check,
  Circle,
  Activity,
  ArrowDown,
  AlertTriangle,
  Sparkles,
  TerminalSquare,
  GitBranch,
} from 'lucide-react';
import { Composer } from '../components/Composer';
import { WorkflowCard, type CardType, type CardStatus } from '../components/WorkflowCard';
import { VerificationCard } from '../components/VerificationCard';
import { VerificationActiveBanner } from '../components/VerificationActiveBanner';
import { WorkspaceRightPanels } from '../components/WorkspaceRightPanels';
import { ClusterLogo } from '../components/ClusterLogo';
import type { TimelineEntry, AgentState, FileProgressState } from '../hooks/useAgent';
import type { SubAgentState, SubAgentHandoff, SubAgentSwarmSummary, VerificationReport } from '@cluster/shared';
import { EffortLevel } from '../components/EffortSelectorModal';

interface WorkspacePageProps {
  sessionTitle: string;
  entries: TimelineEntry[];
  agentState: AgentState;
  running: boolean;
  streamingText: string;
  liveOutput: Record<string, string>;
  activity: string[];
  pendingConfirm: { tool: string; reason: string } | null;
  taskGraph: any;
  subAgents?: Record<string, SubAgentState>;
  handoffs?: SubAgentHandoff[];
  swarmSummary?: SubAgentSwarmSummary | null;
  plan: any;
  recalledMemories?: any[];
  fileProgress?: FileProgressState | null;
  activeSkill?: { skill: any; params: any; rawCommand: string } | null;
  verificationReport?: VerificationReport | null;
  workspaceName?: string;
  projectRoot?: string;
  gitBranch?: string | null;
  model?: string;
  provider?: string;
  baseUrl?: string;
  edits?: any[];
  effort?: EffortLevel;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onConfirm: (approved: boolean) => void;
  onOpenTasks: () => void;
  onOpenDiffs: () => void;
  onOpenWorkspaceSwitcher?: () => void;
  onOpenModelSelector?: () => void;
  onOpenEffortSelector?: () => void;
  onSelectEffort?: (effort: EffortLevel) => void;
}

type TabMode = 'chat' | 'plan' | 'files';

const TimelineEntryCard: React.FC<{
  entry: TimelineEntry;
  liveOutput: Record<string, string>;
  onOpenDiffs: () => void;
}> = React.memo(({ entry, liveOutput, onOpenDiffs }) => {
  if (entry.kind === 'message' && entry.message) {
    const msg = entry.message;
    const isUser = msg.role === 'user';
    const isError = msg.kind === 'error';
    const isWarning = msg.kind === 'warning';
    const isVerification = msg.kind === 'verification' || Boolean(msg.meta?.verificationReport);

    if (isVerification) {
      const report = msg.meta?.verificationReport || (typeof msg.content === 'object' ? msg.content : null);
      if (report && report.checks) {
        return <VerificationCard report={report} dense={false} />;
      }
    }

    const safeMsgContent = typeof msg.content === 'string' ? msg.content : '';

    if (isUser) {
      return (
        <WorkflowCard
          id={entry.id}
          type="user"
          status="info"
          title="User Request"
          summary={safeMsgContent}
          metadata={{ timestamp: entry.at }}
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
          metadata={{ timestamp: entry.at }}
        />
      );
    }

    if (isWarning) {
      return (
        <WorkflowCard
          id={entry.id}
          type="warning"
          status="info"
          title="Warning"
          summary={safeMsgContent}
          metadata={{ timestamp: entry.at }}
        />
      );
    }

    // Default assistant response
    return (
      <WorkflowCard
        id={entry.id}
        type="assistant"
        status="info"
        title="Cluster Assistant"
        summary={safeMsgContent}
        metadata={{ timestamp: entry.at }}
      />
    );
  }

  if (entry.kind === 'tool' && entry.call) {
    const call = entry.call;
    const name = call.name || 'tool';
    const args = call.args || {};
    const result = call.result || {};
    const isRunning = call.status === 'running';
    const isFailed = call.status === 'failed';

    let cardType: CardType = 'command';
    let cardTitle = name;
    let cardDetail = '';
    const metadata: any = {
      timestamp: entry.at,
      durationMs: call.durationMs,
      exitCode: result.data?.exitCode,
      path: args.path || args.file || args.target,
    };

    if (name === 'read_file' || name === 'read_many_files' || name === 'file_search') {
      cardType = 'file_read';
      cardTitle = `Read: ${args.path || args.file || 'file'}`;
      cardDetail = args.path || '';
    } else if (name === 'write_file' || name === 'patch_file') {
      cardType = 'file_write';
      cardTitle = `Edited: ${args.path || 'file'}`;
      cardDetail = args.path || '';
      metadata.additions = result.data?.additions;
      metadata.deletions = result.data?.deletions;
    } else if (name === 'run_command' || name === 'execute') {
      cardType = 'command';
      cardTitle = isRunning ? `Running: ${args.command || 'command'}` : `Command: ${args.command || 'command'}`;
      cardDetail = args.command || '';
    }

    const liveOut = liveOutput[call.id] || result.data?.output || result.data?.stdout || result.error || '';

    return (
      <WorkflowCard
        id={entry.id}
        type={cardType}
        status={isRunning ? 'running' : isFailed ? 'failed' : 'success'}
        title={cardTitle}
        detail={cardDetail}
        summary={result.data?.diff ? 'Code modified successfully.' : undefined}
        output={liveOut}
        diff={result.data?.diff}
        metadata={metadata}
        onAction={(action) => {
          if (action === 'view_diff') onOpenDiffs();
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
  subAgents,
  handoffs,
  swarmSummary,
  plan,
  recalledMemories,
  fileProgress,
  activeSkill,
  verificationReport,
  workspaceName = 'Workspace',
  projectRoot,
  gitBranch,
  model = 'agnes-2.5-flash',
  provider,
  baseUrl,
  edits = [],
  onSubmit,
  onCancel,
  onConfirm,
  onOpenTasks,
  onOpenDiffs,
  onOpenWorkspaceSwitcher,
  onOpenModelSelector,
  effort = 'balanced',
  onOpenEffortSelector,
  onSelectEffort,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('chat');
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll handler
  useEffect(() => {
    if (!isUserScrolledUpRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, streamingText, running]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceFromBottom > 150;
    setIsUserScrolledUp(isUp);
    isUserScrolledUpRef.current = isUp;
  };

  const cleanPath = projectRoot ? projectRoot.replace(/\\/g, '/') : '~/projects/cluster';

  return (
    <div className="flex-1 flex h-full min-h-0 bg-[#09090b] text-[#f4f4f5] overflow-hidden select-none font-sans">
      {/* Center Column: Main Chat Header, Real Message Feed & Bottom Composer */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#09090b] overflow-hidden">
        {/* Workspace Chat Header */}
        <div className="h-11 px-5 border-b border-[#1f1f24] bg-[#0c0c0e] flex items-center justify-between shrink-0">
          {/* Left: ● Workspace Name ∨ */}
          <button
            onClick={onOpenWorkspaceSwitcher}
            title={`Active Workspace: ${cleanPath}\nClick to switch (Ctrl+O)`}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer group"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="font-semibold text-zinc-200 text-xs tracking-wide group-hover:text-white transition-colors">
              {workspaceName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          </button>

          {/* Right: Segmented tabs [Chat] [Plan] [Files] ••• */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-[#131317] p-0.5 rounded-lg border border-[#1f1f25]">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'chat'
                    ? 'bg-[#1e1e25] text-white border border-[#2b2b34] shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => {
                  setActiveTab('plan');
                  onOpenTasks();
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'plan'
                    ? 'bg-[#1e1e25] text-white border border-[#2b2b34] shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Plan
              </button>
              <button
                onClick={() => {
                  setActiveTab('files');
                  onOpenDiffs();
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'files'
                    ? 'bg-[#1e1e25] text-white border border-[#2b2b34] shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Files
              </button>
            </div>

            <button
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-[#16161b] transition-colors ml-1 cursor-pointer"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Real Conversation Feed */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-3.5 min-h-0 relative"
        >
          <div className="max-w-3xl mx-auto space-y-3.5">
            {/* Live Verification Active Banner */}
            <VerificationActiveBanner phase={agentState.phase} label={agentState.label} dense={false} />

            {/* Real Intentional Developer Welcome State (when session is empty) */}
            {entries.length === 0 && !streamingText && !running && (
              <div className="my-8 rounded-2xl border border-[#1f1f25] bg-[#121215] p-6 text-center space-y-4 shadow-sm">
                <div className="flex items-center justify-center">
                  <ClusterLogo size={36} rounded={true} withShadow={false} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100 tracking-wide">
                    Cluster Coding Assistant
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
                    Ready to plan, write, inspect, and verify code in{' '}
                    <span className="font-mono text-zinc-300 font-semibold">{workspaceName}</span>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 max-w-lg mx-auto">
                  {[
                    'Explain repository structure and key modules',
                    'Inspect git status and uncommitted changes',
                    'Run test suite and review results',
                    'Review open tasks and plan next sprint',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => onSubmit(prompt)}
                      className="px-3 py-1.5 rounded-xl text-[11px] bg-[#17171d] hover:bg-[#1f1f26] border border-[#22222a] hover:border-[#32323e] text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Real Timeline Stream */}
            {entries.map((entry) => (
              <TimelineEntryCard
                key={entry.id}
                entry={entry}
                liveOutput={liveOutput}
                onOpenDiffs={onOpenDiffs}
              />
            ))}

            {/* Active Streaming Response Card */}
            {running && streamingText && (
              <div className="w-full rounded-2xl bg-[#121215] border border-[#202026] p-4 text-xs transition-all shadow-sm space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                  <ClusterLogo size={18} rounded={true} withShadow={false} />
                  <span>Cluster Assistant</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-1" />
                </div>
                <div className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap pl-6 font-sans">
                  {streamingText}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Floating Scroll to Bottom Button */}
        {isUserScrolledUp && (
          <div className="absolute bottom-20 right-80 z-30 animate-in fade-in slide-in-from-bottom-2 pointer-events-auto">
            <button
              onClick={() => {
                setIsUserScrolledUp(false);
                isUserScrolledUpRef.current = false;
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
              }}
              className="px-3 py-1.5 rounded-full bg-[#1c1c22] hover:bg-[#25252e] text-white text-xs font-medium shadow-xl border border-[#2e2e38] flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>New events below</span>
            </button>
          </div>
        )}

        {/* Action Confirmation Banner */}
        {pendingConfirm && (
          <div className="p-3 bg-[#181512] border-t border-amber-500/30 flex items-center justify-between gap-4 px-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-white">Action Confirmation: </span>
                <span className="text-zinc-300">{pendingConfirm.tool} — {pendingConfirm.reason}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onConfirm(false)}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-[#1e1e24] text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                Decline
              </button>
              <button
                onClick={() => onConfirm(true)}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-500 text-black hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Approve
              </button>
            </div>
          </div>
        )}

        {/* Bottom Composer Container */}
        <div className="p-4 border-t border-[#1f1f24] bg-[#09090b] shrink-0">
          <div className="max-w-3xl mx-auto">
            <Composer
              running={running}
              onSubmit={onSubmit}
              onCancel={onCancel}
              model={model}
              onOpenModelSelector={onOpenModelSelector}
              effort={effort}
              onOpenEffortSelector={onOpenEffortSelector}
              onSelectEffort={onSelectEffort}
            />
          </div>
        </div>
      </div>

      {/* Right Column: Workspace Right Panels (Real Plan, Files, Context, Activity) */}
      <WorkspaceRightPanels
        plan={plan}
        taskGraph={taskGraph}
        edits={edits}
        activity={activity}
        workspaceName={workspaceName}
        projectRoot={projectRoot}
        gitBranch={gitBranch}
        model={model}
        provider={provider}
        baseUrl={baseUrl}
        effort={effort}
        onOpenDiffs={onOpenDiffs}
        onOpenTasks={onOpenTasks}
        onOpenModelSelector={onOpenModelSelector}
        onOpenEffortSelector={onOpenEffortSelector}
      />
    </div>
  );
};
