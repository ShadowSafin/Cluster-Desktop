import React, { useRef, useEffect, useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Composer } from '../components/Composer';
import { WorkflowCard, type CardType, type CardStatus } from '../components/WorkflowCard';
import { VerificationCard } from '../components/VerificationCard';
import { VerificationActiveBanner } from '../components/VerificationActiveBanner';
import { WorkspaceRightPanels } from '../components/WorkspaceRightPanels';
import { ClusterLogo } from '../components/ClusterLogo';
import type { TimelineEntry, AgentState, FileProgressState } from '../hooks/useAgent';
import type { SubAgentState, SubAgentHandoff, SubAgentSwarmSummary, VerificationReport } from '@cluster/shared';

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
  edits?: any[];
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onConfirm: (approved: boolean) => void;
  onOpenTasks: () => void;
  onOpenDiffs: () => void;
  onOpenWorkspaceSwitcher?: () => void;
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
        onAction={(action, payload) => {
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
  workspaceName = 'Project Atlas',
  projectRoot = '~/projects/cluster',
  gitBranch = 'main',
  model = 'Claude 3.5 Sonnet',
  provider = 'Anthropic',
  edits = [],
  onSubmit,
  onCancel,
  onConfirm,
  onOpenTasks,
  onOpenDiffs,
  onOpenWorkspaceSwitcher,
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

  // Mock initial demo turn matching reference image if no messages yet
  const showInitialDemoTurn = entries.length === 0 && !streamingText && !running;

  return (
    <div className="flex-1 flex h-full min-h-0 bg-[#0B0E14] text-[#F1F5F9] overflow-hidden select-none font-sans">
      {/* Center Column: Main Chat Header, Message Feed & Bottom Composer */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#0B0E14] overflow-hidden">
        {/* Workspace Chat Header */}
        <div className="h-12 px-6 border-b border-[#1E2536] bg-[#0B0E14] flex items-center justify-between shrink-0">
          {/* Left: ● Project Atlas ∨ */}
          <button
            onClick={onOpenWorkspaceSwitcher}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer group"
          >
            <span className="w-2 h-2 rounded-full bg-[#10B981] shrink-0" />
            <span className="font-semibold text-white text-sm tracking-wide group-hover:text-[#3B82F6] transition-colors">
              {workspaceName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B] group-hover:text-white transition-colors" />
          </button>

          {/* Right: Segmented tabs [Chat] [Plan] [Files] ••• */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-[#111722] p-0.5 rounded-lg border border-[#1E2536]">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'chat'
                    ? 'bg-[#1C2538] text-white border border-[#27344D] shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => {
                  setActiveTab('plan');
                  onOpenTasks();
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'plan'
                    ? 'bg-[#1C2538] text-white border border-[#27344D] shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Plan
              </button>
              <button
                onClick={() => {
                  setActiveTab('files');
                  onOpenDiffs();
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'files'
                    ? 'bg-[#1C2538] text-white border border-[#27344D] shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Files
              </button>
            </div>

            <button
              className="p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-[#161D2B] transition-colors ml-1"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Conversation Timeline */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0 relative"
        >
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Live Verification Active Banner */}
            <VerificationActiveBanner phase={agentState.phase} label={agentState.label} dense={false} />

            {/* Reference Image Initial Turn (displayed when fresh session) */}
            {showInitialDemoTurn && (
              <>
                {/* User Message */}
                <div className="w-full rounded-2xl bg-[#121722] border border-[#1E2536] p-4 text-xs transition-all shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-2 select-none">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#1E2638] border border-white/10 flex items-center justify-center text-zinc-300 shrink-0">
                        <span className="text-[10px] font-semibold">U</span>
                      </div>
                      <span className="font-semibold text-white text-xs">You</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#64748B]">10:24 AM</span>
                  </div>
                  <div className="text-[#E2E8F0] text-sm leading-relaxed whitespace-pre-wrap pl-8 font-sans">
                    Add a dark mode toggle to the settings page and persist the preference.
                  </div>
                </div>

                {/* Assistant Turn */}
                <div className="w-full rounded-2xl bg-[#121722] border border-[#1E2536] p-4 text-xs transition-all shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-2 select-none">
                    <div className="flex items-center gap-2">
                      <ClusterLogo size={22} rounded={true} withShadow={false} />
                      <span className="font-semibold text-white text-xs">Cluster Assistant</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#64748B]">10:24 AM</span>
                  </div>

                  <div className="text-[#E2E8F0] text-sm leading-relaxed whitespace-pre-wrap pl-8 font-sans">
                    I'll add a dark mode toggle to the settings page, persist the preference in storage, and apply it across the app.
                  </div>

                  {/* Nested Execution Plan Card */}
                  <div className="pl-8 pt-1 space-y-3">
                    <div className="rounded-2xl bg-[#161D2B] border border-[#222B3D] p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-white tracking-wide">
                        <Compass className="w-4 h-4 text-[#3B82F6]" />
                        <span>Execution Plan</span>
                      </div>

                      <div className="divide-y divide-[#1F273B] rounded-xl bg-[#131825] border border-[#1E2536] p-1">
                        {/* Step 1 */}
                        <div className="p-3 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <div className="w-4 h-4 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-white text-xs">Add dark mode toggle UI in settings</div>
                              <div className="text-[#94A3B8] text-[11px] mt-0.5">Create a toggle component and place it in the appearance section.</div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 shrink-0">
                            Completed
                          </span>
                        </div>

                        {/* Step 2 */}
                        <div className="p-3 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <div className="w-4 h-4 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-white text-xs">Persist preference</div>
                              <div className="text-[#94A3B8] text-[11px] mt-0.5">Store the theme preference in local storage.</div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 shrink-0">
                            Completed
                          </span>
                        </div>

                        {/* Step 3 */}
                        <div className="p-3 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <div className="w-4 h-4 rounded-full bg-[#3B82F6] flex items-center justify-center shrink-0 mt-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-white text-xs">Apply theme globally</div>
                              <div className="text-[#94A3B8] text-[11px] mt-0.5">Update the theme context and apply class to &lt;html&gt;.</div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30 shrink-0 animate-pulse">
                            In Progress
                          </span>
                        </div>

                        {/* Step 4 */}
                        <div className="p-3 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <Circle className="w-4 h-4 text-[#475569] shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-[#94A3B8] text-xs">Verify and test</div>
                              <div className="text-[#64748B] text-[11px] mt-0.5">Ensure the theme persists on reload and across pages.</div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#1E2536] text-[#64748B] shrink-0">
                            Pending
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Edited file card */}
                    <div className="rounded-2xl bg-[#121722] border border-[#1E2536] p-3 text-xs shadow-sm flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <FileEdit className="w-4 h-4 text-[#10B981] shrink-0" />
                        <span className="text-white font-medium truncate">
                          Edited: <span className="font-mono text-zinc-300">settings/appearance.tsx</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#182030] border border-[#222C40] font-mono text-[11px] shrink-0">
                        <span className="text-[#10B981]">+42</span>
                        <span className="text-[#EF4444]">-18</span>
                      </div>
                    </div>

                    {/* Running task card with progress bar */}
                    <div className="rounded-2xl bg-[#121722] border border-[#1E2536] p-3.5 text-xs shadow-sm space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-[#3B82F6] animate-spin" />
                          <span className="font-mono text-xs">Running: apply-theme.ts</span>
                        </div>
                        <span className="font-mono text-xs text-[#94A3B8]">60%</span>
                      </div>

                      <div className="w-full h-1 rounded-full bg-[#1A2234] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#3B82F6] to-[#6366F1] transition-all duration-300 rounded-full"
                          style={{ width: '60%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
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
              <div className="w-full rounded-2xl bg-[#121722] border border-[#1E2536] p-4 text-xs transition-all shadow-sm space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <ClusterLogo size={20} rounded={true} withShadow={false} />
                  <span>Cluster Assistant</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-ping ml-1" />
                </div>
                <div className="text-[#E2E8F0] text-sm leading-relaxed whitespace-pre-wrap pl-7 font-sans">
                  {streamingText}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Floating Scroll to Bottom Button */}
        {isUserScrolledUp && (
          <div className="absolute bottom-24 right-80 z-30 animate-in fade-in slide-in-from-bottom-2 pointer-events-auto">
            <button
              onClick={() => {
                setIsUserScrolledUp(false);
                isUserScrolledUpRef.current = false;
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
              }}
              className="px-3.5 py-1.5 rounded-full bg-[#1E2538] hover:bg-[#27324B] text-white text-xs font-medium shadow-xl border border-[#2E3C57] flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>New events below</span>
            </button>
          </div>
        )}

        {/* Action Confirmation Banner */}
        {pendingConfirm && (
          <div className="p-3 bg-amber-950/40 border-t border-amber-500/30 flex items-center justify-between gap-4 px-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-white">Action Confirmation: </span>
                <span className="text-neutral-300">{pendingConfirm.tool} — {pendingConfirm.reason}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onConfirm(false)}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-[#1A2234] text-neutral-300 hover:text-white transition-colors cursor-pointer"
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
        <div className="p-5 border-t border-[#1E2536] bg-[#0B0E14] shrink-0">
          <div className="max-w-3xl mx-auto">
            <Composer
              running={running}
              onSubmit={onSubmit}
              onCancel={onCancel}
              model={model}
            />
          </div>
        </div>
      </div>

      {/* Right Column: Workspace Right Panels (Current Plan, Files, Context, Activity) */}
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
        onOpenDiffs={onOpenDiffs}
        onOpenTasks={onOpenTasks}
      />
    </div>
  );
};
