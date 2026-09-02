# Tools Reference

## Overview

Cluster ships with **15+ tools** organized into categories. All tools are registered in a central `ToolRegistry` that handles Zod validation, risk classification, permission evaluation, and execution.

## Registry Architecture

```typescript
class ToolRegistry {
  // Registration
  register(tool: AnyTool, meta?: ToolMetadata): this
  registerAll(tools: AnyTool[]): this
  registerPlugin(plugin: ToolPlugin): this

  // Lookup
  get(name: string): AnyTool | undefined
  list(): AnyTool[]
  names(): string[]
  getMetadata(name: string): ToolMetadata | undefined

  // Filtering
  forRole(role: AgentRole): AnyTool[]      // Tools allowed for a specific agent role
  has(name: string): boolean

  // Schema conversion
  toFunctionSchemas(): ProviderToolSchema[]  // OpenAI-compatible JSON schemas
  describeForPrompt(): string                // Text format for text-protocol fallback

  // Execution
  async execute(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolExecutionOutcome>
}
```

Two registry presets are provided:
- `createDefaultRegistry()` — 14 tools (Phase 1)
- `createPhase2Registry()` — 15 tools (+ `apply_hunks`)

---

## Tool Catalog

### Reading Tools

#### `workspace_info`
Returns comprehensive project metadata.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `projectRoot` | string | No | Absolute path (defaults to ctx.projectRoot) |

**Output:**
```json
{
  "ok": true,
  "data": {
    "root": "/path/to/project",
    "name": "my-app",
    "languages": ["TypeScript", "JavaScript"],
    "project": {
      "kind": "node",
      "packageManager": "npm",
      "scripts": { "dev": "vite", "build": "tsc" }
    },
    "commands": {
      "build": ["npm run build"],
      "test": ["npm test"],
      "lint": ["npm run lint"]
    },
    "git": { "branch": "main", "dirty": false, "head": "abc1234" }
  }
}
```

**Risk:** `safe`

---

#### `list_files`
Lists files matching a glob pattern.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `pattern` | string | Yes | Glob pattern (e.g., `src/**/*.ts`) |
| `projectRoot` | string | No | Override root |
| `limit` | number | No | Max results (default: 100) |

**Output:** Array of relative file paths.

**Risk:** `safe`

---

#### `read_file`
Reads a text file with optional range.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `path` | string | Yes | File path (relative to project root) |
| `range` | `[number, number]` | No | `[startLine, endLine]` (1-indexed, inclusive) |
| `encoding` | string | No | Default: `utf8` |

**Behavior:**
- Auto-detects binary files → returns error with hint
- Line ranges are clamped to file length
- Paths are resolved via `resolveWithin()` to prevent directory escape

**Risk:** `safe`

---

#### `search_text`
Searches file contents using literal text or regex.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `pattern` | string | Yes | Search pattern |
| `path` | string | No | Directory to search (default: project root) |
| `type` | `'literal' \| 'regex'` | No | Default: `'literal'` |
| `ignoreCase` | boolean | No | Default: `false` |
| `maxResults` | number | No | Default: 50 |

**Output:**
```json
{
  "ok": true,
  "data": {
    "results": [
      { "path": "src/auth.ts", "line": 12, "match": "export function authenticate" }
    ],
    "total": 1
  }
}
```

**Risk:** `safe`

---

### Writing Tools

#### `write_file`
Creates or overwrites a file.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `path` | string | Yes | Target file path |
| `content` | string | Yes | Full file content |
| `createBackup` | boolean | No | Default: `true` — backs up before overwrite |

**Behavior:**
1. Creates parent directories if needed
2. Backs up existing file to `~/.cluster/backups/<sessionId>/<callId>/`
3. Writes new content
4. Computes unified diff against backup (or empty if new file)
5. Returns diff, addition/deletion counts, and `created` flag

**Risk:** `caution` (new files) / `destructive` (overwriting existing files)

---

#### `patch_file`
Surgical find-and-replace edit. Preferred over `write_file` for targeted changes.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `path` | string | Yes | Target file path |
| `oldText` | string | Yes | Exact text to find |
| `newText` | string | Yes | Replacement text |
| `description` | string | No | Human-readable description of the change |
| `createBackup` | boolean | No | Default: `true` |

**Behavior:**
1. Reads current file content
2. Finds first occurrence of `oldText`
3. Replaces with `newText`
4. Computes unified diff
5. Writes new content (with backup)

If `oldText` not found, returns error with hint showing nearby content.

**Risk:** `caution`

---

### Command Execution Tools

#### `run_command`
Spawns a child process with live output streaming.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `command` | string | Yes | Shell command to execute |
| `cwd` | string | No | Working directory (default: project root) |
| `timeoutMs` | number | No | Default: `config.commandTimeoutMs` (120s) |

**Behavior:**
- Uses `child_process.spawn()` with `shell: true`
- Streams stdout/stderr via `ctx.emitOutput(chunk)` in real-time
- Captures exit code and duration
- Respect `AbortSignal` for cancellation
- Auto-confirms destructive commands unless `alwaysConfirmCommands` is false

**Destructive patterns** (auto-confirm required):
- `rm -rf`, `rm -r`, `del /f /q`
- `git push --force`, `git push -f`
- `drop table`, `DELETE FROM` in SQL
- Any command with `--force`, `-f` flags on dangerous operations

**Output:**
```json
{
  "ok": true,
  "data": {
    "command": "npm test",
    "cwd": "/path/to/project",
    "exitCode": 0,
    "output": "...",
    "durationMs": 4523,
    "timedOut": false,
    "cancelled": false
  }
}
```

**Risk:** `destructive` for dangerous patterns; `caution` for others; `safe` for read-only commands

---

### Git Tools

#### `git_status`
Returns current git state.

**Output:**
```json
{
  "ok": true,
  "data": {
    "branch": "main",
    "head": "abc1234",
    "dirty": true,
    "staged": 2,
    "unstaged": 1,
    "untracked": 3,
    "lastCommit": "Fix auth middleware bug"
  }
}
```

**Risk:** `safe`

---

#### `git_diff`
Returns unified diff of working tree.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `path` | string | No | Specific file (defaults to all changes) |

**Output:**
```json
{
  "ok": true,
  "data": {
    "diff": "--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -10,7 +10,7 @@\n-export function old() {}\n+export function new() {}",
    "stats": { "additions": 3, "deletions": 1 }
  }
}
```

**Risk:** `safe`

---

### Verification Tools

#### `verify`
Auto-discovers and runs build/test/lint commands.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `projectRoot` | string | No | Override root |
| `commands` | string[] | No | Specific commands to run (discovers from workspace if omitted) |
| `autoFix` | boolean | No | Default: `false` — attempt auto-fix on lint failures |

**Discovery order:**
1. `cluster.config.json` → `commands.build/test/lint/format`
2. `package.json` scripts
3. Language-specific defaults (`pytest`, `cargo test`, `go test`, etc.)

**Output:**
```json
{
  "ok": true,
  "data": {
    "results": [
      { "kind": "test", "command": "npm test", "passed": true, "durationMs": 3200, "summary": "12 passed" }
    ],
    "overall": "passed",
    "attemptedFixes": 0
  }
}
```

**Risk:** `caution` (runs arbitrary commands)

---

#### `discover_tests`
Finds test files and suggested test commands without running them.

**Output:** List of test files and recommended commands.

**Risk:** `safe`

---

### Checkpoint Tools

#### `checkpoint_create`
Creates a file snapshot checkpoint.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `message` | string | No | Human-readable description |
| `files` | string[] | No | Specific files (defaults to all tracked git files) |

**Storage:** `~/.cluster/checkpoints/<sessionId>/<checkpointId>/meta.json` + file snapshots

**Risk:** `safe`

---

#### `checkpoint_list`
Lists all checkpoints for a session.

**Output:** Array of `{ id, message, createdAt, gitHead, fileCount }`

**Risk:** `safe`

---

#### `checkpoint_rollback`
Restores files to a checkpoint state.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `checkpointId` | string | Yes | ID of checkpoint to restore |

**Returns:** `{ restored: string[], errors: Array<{ path, error }> }`

**Risk:** `destructive` (overwrites working files)

---

### Diff Review Tools

#### `diff_preview`
Shows the diff that would result from a proposed change.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `path` | string | Yes | File path |
| `newContent` | string | Yes | Proposed new content |

**Output:** Unified diff preview.

**Risk:** `safe`

---

#### `apply_hunks`
Applies selected hunks from a diff to a file.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `path` | string | Yes | Target file |
| `hunkIndices` | number[] | Yes | Indices of hunks to apply |
| `diff` | string | Yes | Full unified diff |

Used for selective editing — apply only some changes from a larger diff.

**Risk:** `caution`

---

#### `patch_history`
Shows the history of patch operations on a file.

| Input Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `path` | string | Yes | File path |

**Output:** Array of patch operations with timestamps and descriptions.

**Risk:** `safe`

---

## Risk Classification

| Risk Level | Color | Confirmation Required? | Examples |
|------------|-------|----------------------|----------|
| `safe` | Green | No | read_file, list_files, git_status |
| `caution` | Amber | No (informational) | write_file (new), patch_file, run_command (benign) |
| `destructive` | Red | **Yes** (user must approve) | write_file (overwrite), checkpoint_rollback, rm -rf, git push --force |

Classification logic in `safety.ts`:
- `classifyCommand(command)`: Regex check for dangerous patterns
- `classifyPath(path)`: Check for sensitive file extensions (.env, .pem, .key)
- `assessPatchRisk(diff, path)`: Check diff size (>500 lines), sensitive paths, destructive SQL

---

## Safety Controls

| Control | Mechanism | Location |
|---------|-----------|----------|
| Path escape prevention | `resolveWithin()` rejects paths outside project root | `shared/src/paths.ts` |
| Binary file detection | `read_file` checks magic bytes, returns error | `tool-runtime/tools/readFile.ts` |
| Backup before write | Files backed up to `~/.cluster/backups/` | `tool-runtime/tools/writeFile.ts` |
| Destructive command confirmation | Prompts user via `ctx.confirm()` | `tool-runtime/tools/runCommand.ts` |
| Output truncation | Tool output capped at `maxToolOutputChars` (24k) | `agent-core/src/agent.ts` |
| History budget | Transcript trimmed to 120k chars | `agent-core/src/history.ts` |
| Stuck detection | 3 identical consecutive tool calls → abort | `agent-core/src/agent.ts` |
| Execution policy | `ToolRegistry.setPolicy()` for custom allow/deny rules | `tool-runtime/src/permissions.ts` |
