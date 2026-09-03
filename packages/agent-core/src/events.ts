import type {
  AgentPhase,
  Message,
  Plan,
  ToolCall,
  WorkspaceInfo,
} from '@cluster/shared';
import type { ChatUsage } from './provider.js';

export interface FileProgressEvent {
  sessionId: string;
  action: 'reading' | 'writing' | 'patching' | 'written' | 'read' | 'patched' | 'failed';
  status: 'queued' | 'running' | 'done' | 'failed';
  file: string;
  fileIndex: number;
  totalFiles: number;
  lines?: number;
  sizeBytes?: number;
  reason?: string;
  completedFiles: string[];
  queuedFiles: string[];
  timestamp: string;
}

/**
 * Everything the UI needs to render a run, and everything the session store
 * needs to persist one. The agent emits these; it never touches storage or the
 * terminal directly.
 */
export interface AgentEvents {
  state: {
    phase: AgentPhase;
    label: string;
    iteration: number;
    maxIterations: number;
  };
  /** A complete message (user, assistant, or tool result). */
  message: Message;
  /** Incremental assistant text, for streaming display. */
  delta: { messageId: string; text: string };
  'tool:start': ToolCall;
  'tool:end': ToolCall;
  /** Streamed stdout/stderr from a running command. */
  'tool:output': { callId: string; chunk: string };
  /** Transient note, e.g. "Searching 412 files". */
  progress: { message: string };
  plan: Plan;
  error: {
    source: 'agent' | 'tool' | 'provider' | 'workspace';
    message: string;
    code?: string;
    recoverable: boolean;
  };
  done: {
    summary: string;
    usage: ChatUsage;
    cancelled: boolean;
    iterations: number;
  };
  workspace: WorkspaceInfo;
  'memory:recalled': { sessionId: string; memories: any[] };
  'file:progress': FileProgressEvent;
  'subagent:spawn': { sessionId: string; subAgent: import('@cluster/shared').SubAgentState };
  'subagent:update': { sessionId: string; subAgent: import('@cluster/shared').SubAgentState };
  'subagent:handoff': { sessionId: string; handoff: import('@cluster/shared').SubAgentHandoff };
  'subagent:done': { sessionId: string; swarmSummary: import('@cluster/shared').SubAgentSwarmSummary };
  'verification:start': { sessionId: string; turnId: string };
  'verification:update': { sessionId: string; report: import('@cluster/shared').VerificationReport };
  'verification:done': { sessionId: string; report: import('@cluster/shared').VerificationReport };
}
