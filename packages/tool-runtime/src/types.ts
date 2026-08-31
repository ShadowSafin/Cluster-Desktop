import type { Logger } from 'pino';
import type { z } from 'zod';
import type { RiskLevel, ToolResult, WorkspaceInfo } from '@cluster/shared';

// Re-exported so tools and consumers can import the shared model through this
// package without reaching across the dependency graph.
export type { RiskLevel, ToolResult, WorkspaceInfo } from '@cluster/shared';

/**
 * The tool contract.
 *
 * Every capability the agent has is a `ToolDefinition`. Tools are plain data:
 * a name, a zod schema, a risk classification and an async executor. The agent
 * core knows nothing else about them, which is what keeps the tool set
 * replaceable.
 */

export interface ConfirmationRequest {
  /** Short header, e.g. "Run command". */
  title: string;
  /** What will happen, in the user's terms. */
  summary: string;
  /** Optional rich detail shown in the dialog (diff, command text). */
  detail?: string;
  risk: Exclude<RiskLevel, 'safe'>;
}

export interface ToolContext {
  projectRoot: string;
  workspace: WorkspaceInfo | null;
  signal: AbortSignal;
  logger: Logger;
  /** Directory for pre-edit backups. */
  backupsDir: string;
  sessionId: string;
  /** Paranoid mode: request confirmation for commands that would otherwise run unprompted. */
  alwaysConfirmCommands: boolean;
  /** Resolve to true to proceed. Must never throw. */
  confirm(request: ConfirmationRequest): Promise<boolean>;
  /** Incremental output from long-running tools. */
  emitOutput(chunk: string): void;
  /** Incremental progress note, e.g. "searching 412 files". */
  emitProgress(message: string): void;
  /** Execution policy for safer execution (allow/deny, read-only). */
  policy?: import('./permissions.js').ExecutionPolicy;
  /** Agent role for per-tool permissions. */
  agentRole?: import('@cluster/shared').AgentRole;
}

export interface ToolDefinition<TInput = unknown> {
  name: string;
  /** Shown to the model; keep it imperative and specific. */
  description: string;
  /** Zod schema for the input payload. Doubles as the JSON schema sent upstream. */
  schema: z.ZodType<TInput>;
  /** Static risk, or a function of the concrete input. */
  risk: RiskLevel | ((input: TInput) => RiskLevel);
  /**
   * Build the detail shown in the confirmation dialog. Only consulted for
   * non-safe tools.
   */
  preview?(input: TInput, ctx: ToolContext): string | Promise<string>;
  execute(input: TInput, ctx: ToolContext): Promise<ToolResult>;
}

/** Type-erased tool, used by the registry. */
export type AnyTool = ToolDefinition<any>;

export function defineTool<TInput>(definition: ToolDefinition<TInput>): ToolDefinition<TInput> {
  return definition;
}

export function riskOf(tool: AnyTool, input: unknown): RiskLevel {
  return typeof tool.risk === 'function' ? tool.risk(input) : tool.risk;
}

/* -------------------------------------------------------------------------- */
/* Result helpers                                                              */
/* -------------------------------------------------------------------------- */

export function okResult(output: string, data?: unknown, artifacts?: ToolResult['artifacts']): ToolResult {
  return { ok: true, output, data, artifacts };
}

export function failResult(
  message: string,
  options: { code?: string; hint?: string; data?: unknown } = {},
): ToolResult {
  return {
    ok: false,
    output: message,
    data: options.data,
    error: { message, code: options.code, hint: options.hint },
  };
}
