import type {
  AgentPhase,
  Message,
  Plan,
  ToolCall,
  WorkspaceInfo,
} from '@cluster/shared';
import type { ChatUsage } from './provider.js';

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
}
