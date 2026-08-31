import type { AgentRole, Task, ToolCall, VerificationResult } from '@cluster/shared';
import type { ProviderMessage } from '../provider.js';
import type { ToolRegistry } from '@cluster/tool-runtime';

export interface AgentContext {
  projectRoot: string;
  sessionId: string;
  task: Task;
  signal: AbortSignal;
  registry: ToolRegistry;
  providerMessages: ProviderMessage[];
  emitActivity: (message: string) => void;
  emitToolStart: (call: ToolCall) => void;
  emitToolEnd: (call: ToolCall) => void;
}

export interface AgentRunOutput {
  success: boolean;
  summary: string;
  toolCalls: ToolCall[];
  artifacts?: unknown[];
  error?: string;
}

export interface BaseAgent {
  role: AgentRole;
  name: string;
  /** Execute a single task. */
  run(task: Task, ctx: AgentContext): Promise<AgentRunOutput>;
  /** System prompt for this agent's LLM calls. */
  systemPrompt(): string;
  /** Build messages for the model from task + context. */
  buildMessages(task: Task, context: string): ProviderMessage[];
}

export interface AgentToolFilter {
  allowedTools: string[];
  deniedTools?: string[];
}
