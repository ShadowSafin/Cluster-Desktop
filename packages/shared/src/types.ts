/**
 * Domain model for cluster.
 *
 * These types are the contract between the TUI, the agent core, the tool
 * runtime and the session store. They are intentionally plain serialisable
 * data structures so a session can be written to disk verbatim.
 */

export type IsoDateTime = string;

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** Distinguishes how a message should be rendered, independent of its role. */
export type MessageKind =
  | 'chat'
  | 'plan'
  | 'summary'
  | 'error'
  | 'warning'
  | 'info'
  | 'tool-result';

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: IsoDateTime;
  kind: MessageKind;
  /** Tool calls this message requested (assistant) or answered (tool role). */
  toolCallIds?: string[];
  /** Free-form metadata, e.g. token usage or provider finish reason. */
  meta?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* Tools                                                                       */
/* -------------------------------------------------------------------------- */

export type RiskLevel = 'safe' | 'caution' | 'destructive';

export type ToolStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled'
  | 'rejected';

export interface ErrorInfo {
  message: string;
  /** Stable machine-readable classifier, e.g. `ENOENT`, `invalid_patch`. */
  code?: string;
  stack?: string;
  /** Actionable hint shown to the user next to the error. */
  hint?: string;
}

export type ToolArtifact =
  | { type: 'diff'; path: string; diff: string }
  | { type: 'file'; path: string; action: 'read' | 'written' | 'created' | 'deleted' }
  | { type: 'log'; lines: string[] }
  | { type: 'json'; label: string; value: unknown };

export interface ToolResult {
  ok: boolean;
  /** Concise, model-readable summary of what happened. */
  output: string;
  /** Structured payload for the UI / for further reasoning. */
  data?: unknown;
  error?: ErrorInfo;
  artifacts?: ToolArtifact[];
}

export interface ToolCall {
  id: string;
  sessionId: string;
  /** Assistant message that requested this call. */
  messageId?: string;
  name: string;
  input: unknown;
  createdAt: IsoDateTime;
  startedAt?: IsoDateTime;
  finishedAt?: IsoDateTime;
  durationMs?: number;
  status: ToolStatus;
  risk: RiskLevel;
  confirmation: 'not-required' | 'approved' | 'rejected';
  result?: ToolResult;
}

/* -------------------------------------------------------------------------- */
/* Edits, commands, errors                                                     */
/* -------------------------------------------------------------------------- */

export type EditKind = 'create' | 'update' | 'delete';

export interface Edit {
  id: string;
  sessionId: string;
  toolCallId?: string;
  /** Path relative to the project root when possible. */
  path: string;
  kind: EditKind;
  /** Unified diff of the change. */
  diff: string;
  /** Location of the pre-change copy, when one was taken. */
  backupPath?: string;
  additions: number;
  deletions: number;
  createdAt: IsoDateTime;
}

export interface CommandRun {
  id: string;
  sessionId: string;
  toolCallId?: string;
  command: string;
  /** Directory the command was executed in. */
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  cancelled: boolean;
  startedAt: IsoDateTime;
  finishedAt: IsoDateTime;
}

export interface ErrorEvent {
  id: string;
  sessionId: string;
  source: 'agent' | 'tool' | 'provider' | 'storage' | 'workspace' | 'ui';
  message: string;
  code?: string;
  stack?: string;
  recoverable: boolean;
  createdAt: IsoDateTime;
}

/* -------------------------------------------------------------------------- */
/* Workspace                                                                   */
/* -------------------------------------------------------------------------- */

export type ProjectKind = 'node' | 'python' | 'go' | 'rust' | 'unknown';
export type PackageManager =
  | 'npm'
  | 'pnpm'
  | 'yarn'
  | 'bun'
  | 'pip'
  | 'uv'
  | 'poetry'
  | 'cargo'
  | 'go';

export interface GitState {
  type: 'git';
  branch: string;
  /** Short hash of HEAD. */
  head: string | null;
  dirty: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
  /** Most recent commit subject line. */
  lastCommit: string | null;
}

export interface WorkspaceInfo {
  root: string;
  name: string;
  detectedAt: IsoDateTime;
  languages: string[];
  manifestFiles: string[];
  project: {
    kind: ProjectKind;
    packageManager: PackageManager | null;
    name: string | null;
    /** Scripts extracted from the manifest (package.json scripts, etc.). */
    scripts: Record<string, string>;
  };
  /** Candidate commands inferred from manifests; each is a suggestion only. */
  commands: {
    build: string[];
    test: string[];
    lint: string[];
    format: string[];
  };
  git: GitState | null;
}

/* -------------------------------------------------------------------------- */
/* Agent                                                                       */
/* -------------------------------------------------------------------------- */

export type AgentPhase =
  | 'idle'
  | 'planning'
  | 'thinking'
  | 'reading'
  | 'editing'
  | 'running'
  | 'verifying'
  | 'summarizing'
  | 'waiting'
  | 'done'
  | 'error'
  | 'cancelled';

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface AgentState {
  phase: AgentPhase;
  /** Short human description of the current step. */
  label: string;
  iteration: number;
  maxIterations: number;
  startedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
  usage: TokenUsage;
  model: string;
}

export interface PlanStep {
  id: string;
  text: string;
  status: 'pending' | 'in-progress' | 'done' | 'skipped';
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
  createdAt: IsoDateTime;
}

/* -------------------------------------------------------------------------- */
/* Session                                                                     */
/* -------------------------------------------------------------------------- */

export const SESSION_SCHEMA_VERSION = 1;

export interface Session {
  id: string;
  schemaVersion: number;
  title: string;
  projectRoot: string;
  model: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  messages: Message[];
  toolCalls: ToolCall[];
  edits: Edit[];
  commandRuns: CommandRun[];
  errors: ErrorEvent[];
  plan: Plan | null;
  state: AgentState;
  workspace: WorkspaceInfo | null;
}

export function createEmptySession(init: {
  id: string;
  projectRoot: string;
  model: string;
  title?: string;
}): Session {
  const now = new Date().toISOString();
  return {
    id: init.id,
    schemaVersion: SESSION_SCHEMA_VERSION,
    title: init.title ?? 'New session',
    projectRoot: init.projectRoot,
    model: init.model,
    createdAt: now,
    updatedAt: now,
    messages: [],
    toolCalls: [],
    edits: [],
    commandRuns: [],
    errors: [],
    plan: null,
    state: {
      phase: 'idle',
      label: 'Ready',
      iteration: 0,
      maxIterations: 0,
      startedAt: null,
      finishedAt: null,
      usage: { prompt: 0, completion: 0, total: 0 },
      model: init.model,
    },
    workspace: null,
  };
}
