# Core Data Models

This document defines every persistent data type used across Cluster. All types live in `packages/shared/src/`.

## Session

The top-level container for all conversation state.

```typescript
interface Session {
  id: string;                   // e.g., "sess_a1b2c3"
  schemaVersion: number;        // Always 1 (SESSION_SCHEMA_VERSION)
  title: string;                // Auto-derived from first message, or user-set
  projectRoot: string;          // Absolute path to the active workspace
  model: string;                // Active model name (e.g., "gpt-4o-mini")
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;

  // Dynamic content (populated during execution)
  messages: Message[];
  toolCalls: ToolCall[];
  edits: Edit[];
  commandRuns: CommandRun[];
  errors: ErrorEvent[];
  plan: Plan | null;
  state: AgentState;
  workspace: WorkspaceInfo | null;
}
```

A session is created empty (all arrays empty, `plan: null`, `state.phase: 'idle'`) and grows over time. At most **50 sessions per project root** are returned by `listSessions()` (configurable via `limit` parameter).

---

## Message

A single chat bubble in the conversation. Distinguished from `ToolCall` by the `kind` field.

```typescript
interface Message {
  id: string;                   // e.g., "msg_x7y8z9"
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: IsoDateTime;
  kind: MessageKind;            // see below
  toolCallIds?: string[];       // References to ToolCall IDs (for assistant messages)
  meta?: Record<string, unknown>; // Free-form (token usage, finish reason, etc.)
}

type MessageKind =
  | 'chat'        // Normal user/assistant conversational text
  | 'plan'        // Plan-related messaging
  | 'summary'     // Final summary from the agent
  | 'error'       // Error notification
  | 'warning'     // Warning (e.g., "no verification was run")
  | 'info'        // Informational (e.g., "switching to text protocol")
  | 'tool-result' // Tool output fed back to the model
```

**Rendering rules by kind:**
- `chat`: shown as regular message bubble
- `summary`: shown as a distinct block (usually at the end)
- `error`: shown in red with ⚠️ prefix
- `warning`: shown in amber/yellow
- `info`: shown in muted gray
- `tool-result`: shown inline after the tool card

---

## ToolCall

Records a single tool invocation by the agent.

```typescript
interface ToolCall {
  id: string;                       // e.g., "call_m3n4o5"
  sessionId: string;
  messageId?: string;               // Parent assistant message that requested this
  name: string;                     // Tool name (e.g., "write_file", "run_command")
  input: unknown;                   // Validated tool input (Zod-parsed)
  createdAt: IsoDateTime;
  startedAt?: IsoDateTime;
  finishedAt?: IsoDateTime;
  durationMs?: number;
  status: ToolStatus;               // see below
  risk: RiskLevel;                  // safe | caution | destructive
  confirmation: 'not-required' | 'approved' | 'rejected';
  result?: ToolResult;
}

type ToolStatus =
  | 'pending'    // Queued but not yet started
  | 'running'    // Currently executing
  | 'success'    // Completed with ok=true
  | 'error'      // Completed with ok=false
  | 'cancelled'  // Aborted via signal
  | 'rejected'   // User declined confirmation
```

---

## ToolResult

The output of a tool execution. Always wrapped in `{ ok: boolean }`.

```typescript
interface ToolResult {
  ok: boolean;
  output: string;              // Concise summary for the model
  data?: unknown;              // Structured payload (diffs, file lists, etc.)
  error?: ErrorInfo;           // Present when ok=false
  artifacts?: ToolArtifact[];  // Rich UI elements (diffs, logs, JSON)
}

interface ErrorInfo {
  message: string;
  code?: string;               // e.g., "ENOENT", "invalid_patch", "policy_denied"
  stack?: string;
  hint?: string;               // Actionable tip for the user
}

type ToolArtifact =
  | { type: 'diff'; path: string; diff: string }
  | { type: 'file'; path: string; action: 'read' | 'written' | 'created' | 'deleted' }
  | { type: 'log'; lines: string[] }
  | { type: 'json'; label: string; value: unknown }
```

---

## Edit

A recorded file modification. Created when `write_file` or `patch_file` returns a diff.

```typescript
interface Edit {
  id: string;
  sessionId: string;
  toolCallId?: string;         // Which ToolCall produced this edit
  path: string;                // Relative to project root
  kind: EditKind;              // 'create' | 'update' | 'delete'
  diff: string;                // Unified diff
  backupPath?: string;         // Where the pre-change copy is stored
  additions: number;
  deletions: number;
  createdAt: IsoDateTime;
}
```

---

## CommandRun

A recorded shell command execution (from `run_command` tool).

```typescript
interface CommandRun {
  id: string;
  sessionId: string;
  toolCallId?: string;
  command: string;             // Full command string
  cwd: string;                 // Working directory
  exitCode: number | null;
  stdout: string;              // Capped at 64KB
  stderr: string;              // Capped at 64KB
  durationMs: number;
  timedOut: boolean;
  cancelled: boolean;
  startedAt: IsoDateTime;
  finishedAt: IsoDateTime;
}
```

---

## ErrorEvent

An error that occurred during execution.

```typescript
interface ErrorEvent {
  id: string;
  sessionId: string;
  source: 'agent' | 'tool' | 'provider' | 'storage' | 'workspace' | 'ui';
  message: string;
  code?: string;
  stack?: string;
  recoverable: boolean;
  createdAt: IsoDateTime;
}
```

---

## Plan & PlanStep

The LLM-generated execution plan.

```typescript
interface Plan {
  goal: string;
  classification?: RequestCategory[];
  strategy?: string;
  alternativesConsidered?: string[];
  constraints?: string[];
  risks?: string[];
  visibleOutcome?: string;
  hiddenWorkflow?: string;
  acceptanceCriteria?: string[];
  steps: PlanStep[];
  createdAt: IsoDateTime;
}

interface PlanStep {
  id: string;
  text: string;
  status: 'pending' | 'in-progress' | 'done' | 'failed' | 'skipped';
  role?: 'architect' | 'coder' | 'tester' | 'reviewer' | 'planner';
  toolTarget?: string;         // Expected tool to use for this step
  verificationCmd?: string;    // Suggested verification command
}

type RequestCategory =
  | 'ui_ux' | 'frontend' | 'backend' | 'electron_desktop'
  | 'workflow' | 'provider_model' | 'memory_persistence'
  | 'command_execution' | 'background_jobs' | 'diffs_review'
  | 'performance_reliability' | 'packaging_build' | 'bug_fix'
  | 'refactor' | 'migration' | 'feature_addition' | 'architecture_change'
```

---

## AgentState

The current execution state of a session.

```typescript
interface AgentState {
  phase: AgentPhase;
  label: string;               // Human-readable, e.g., "Using write_file"
  iteration: number;           // Current loop iteration (1-based)
  maxIterations: number;       // Config limit (default 40)
  startedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
  usage: TokenUsage;           // Token counts from LLM
  model: string;               // Active model name
}

type AgentPhase =
  | 'idle'         // Session created, no activity
  | 'planning'     // Creating task plan
  | 'thinking'     // Waiting for LLM response
  | 'reading'      // Using read/list/search tools
  | 'editing'      // Using write/patch tools
  | 'running'      // Running commands
  | 'verifying'    // Running tests/lint/build
  | 'summarizing'  // Generating final summary
  | 'waiting'      // Waiting for user confirmation
  | 'done'         // Task completed successfully
  | 'error'        // Task ended with error
  | 'cancelled'    // Task cancelled by user
```

---

## WorkspaceInfo

Project metadata detected at session creation.

```typescript
interface WorkspaceInfo {
  root: string;
  name: string;                // Folder name
  detectedAt: IsoDateTime;
  languages: string[];         // e.g., ['TypeScript', 'JavaScript']
  manifestFiles: string[];     // e.g., ['package.json', 'tsconfig.json']
  project: {
    kind: ProjectKind;         // 'node' | 'python' | 'go' | 'rust' | 'unknown'
    packageManager: PackageManager | null;  // 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | ...
    name: string | null;
    scripts: Record<string, string>;  // From package.json scripts
  };
  commands: {
    build: string[];           // e.g., ['npm run build', 'tsc --noEmit']
    test: string[];            // e.g., ['npm test', 'vitest run']
    lint: string[];            // e.g., ['npm run lint', 'eslint .']
    format: string[];          // e.g., ['npm run format', 'prettier --write .']
  };
  git: GitState | null;
}

interface GitState {
  type: 'git';
  branch: string;
  head: string | null;         // Short hash
  dirty: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
  lastCommit: string | null;   // Most recent commit subject
}

type ProjectKind = 'node' | 'python' | 'go' | 'rust' | 'unknown'
type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'uv' | 'poetry' | 'cargo' | 'go'
```

---

## Token Usage

```typescript
interface TokenUsage {
  prompt: number;     // Input tokens
  completion: number; // Output tokens
  total: number;      // Sum of above
}
```

---

## In-Memory vs Persisted Shape

Some fields exist only in memory and are not stored to disk:

| Field | In Memory | Persisted | Notes |
|-------|-----------|-----------|-------|
| `AgentState.startedAt` | Yes | Yes | Set on first iteration |
| `AgentState.finishedAt` | Yes | Yes | Set on done/error/cancel |
| `ToolCall.durationMs` | Yes | Yes | Calculated at tool:end |
| `ToolCall.confirmation` | Yes | Yes | Set after user approves |
| `Edit.backupPath` | Yes | Yes | Points to backup dir |
| `Plan.classification` | Yes | Yes | Optional LLM output |
| `Plan.hiddenWorkflow` | Yes | Yes | Optional LLM output |
| `WorkspaceInfo` | Yes | Yes | Captured at session start |
| `Session.workspace` | Yes | Yes | Null if detection fails |

---

## Storage Path

All persisted data lives under `~/.cluster/` (overridable via `CLUSTER_HOME`):

```
~/.cluster/
├── sessions.json          ← All sessions (lowdb JSON)
├── cluster_memory.db      ← SQLite memory database (native) OR
├── cluster_memory.db.json ← JSON fallback for memory
├── backups/
│   └── <sessionId>/
│       └── <callId>/
│           └── <filepath>   ← Pre-edit file snapshots
├── checkpoints/
│   └── <sessionId>/
│       └── <checkpointId>/
│           ├── meta.json    ← Checkpoint metadata
│           └── <relative-path>  ← File snapshots
└── patch-history/
    └── <sessionId>/
        └── <timestamp>.json ← Patch operation log
```
