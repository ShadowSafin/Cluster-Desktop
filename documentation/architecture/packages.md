# Package Map — Every Module Explained

## `@cluster/agent-core`

**Location:** `packages/agent-core/src/`

The brain of Cluster. Handles everything related to LLM interaction and agent coordination.

### Files

| File | Purpose |
|------|---------|
| `config.ts` | 4-layer config resolution (defaults → env → global → project). Exports `loadConfig()`, `AgentConfig`, `ProjectConfig`. |
| `provider.ts` | `ModelProvider` class — OpenAI-compatible `/chat/completions` client with SSE streaming, tool calling, and text-protocol fallback. |
| `prompts.ts` | System prompt builder, plan prompt, text protocol format, tool block parser. |
| `history.ts` | `trimHistory()` — keeps transcript within 120k character budget. |
| `agent.ts` | `AgentLoop` — single-agent main class. Iterative planning → model call → tool execution → summarization. |
| `coordinator.ts` | `Coordinator` — multi-agent orchestrator. Manages Planner/Coder/Reviewer/Tester/Context agents, file locks, checkpoint-before-edit. |
| `stateMachine.ts` | Agent phase transitions and state management. |
| `events.ts` | TypeScript event type definitions for agent events. |
| `agents/types.ts` | `BaseAgent` interface, `AgentContext`, `AgentRunOutput`. |
| `agents/plannerAgent.ts` | Planner agent — creates task graphs from goals. |
| `agents/contextAgent.ts` | Context agent — gathers repo intelligence. |
| `agents/coderAgent.ts` | Coder agent — reads/writes files with role-limited tools. |
| `agents/reviewerAgent.ts` | Reviewer agent — inspects changes for issues. |
| `agents/testerAgent.ts` | Tester agent — runs tests and verification. |

### Key Exports
- `AgentLoop`, `Coordinator`, `ModelProvider`
- `AgentConfig`, `loadConfig`, `DEFAULT_CONFIG`
- `buildSystemPrompt`, `toProviderMessages`
- All agent classes (`PlannerAgent`, `CoderAgent`, etc.)

---

## `@cluster/tool-runtime`

**Location:** `packages/tool-runtime/src/`

Every tool the agent can call. Registry + validation + execution + safety.

### Files

| File | Purpose |
|------|---------|
| `registry.ts` | `ToolRegistry` class — tool registration, zod validation, execution dispatch, risk classification. `createDefaultRegistry()` and `createPhase2Registry()`. |
| `types.ts` | `AnyTool`, `ToolContext`, `ToolResult`, `ToolExecutionOutcome`, `RiskLevel`, `ConfirmationRequest`. |
| `safety.ts` | `riskOf()` — classifies tool call risk. `classifyCommand()`, `classifyPath()` for command/path danger detection. |
| `permissions.ts` | `ExecutionPolicy`, permission evaluation (allow/deny/confirm), default policy. |
| `verification.ts` | `runVerification()` — discovers and runs build/test/lint commands. `discoverTestsTool`. |
| `diff.ts` | Diff utilities for comparing file states. |
| `util.ts` | `capMiddle()` — truncates long strings with middle ellipsis. |
| `tools/readFile.ts` | Read text files, auto-detect binary, support line ranges. |
| `tools/listFiles.ts` | Glob-based file listing. |
| `tools/searchText.ts` | Literal and regex search across project files. |
| `tools/writeFile.ts` | Create or overwrite files. Backs up before write. |
| `tools/patchFile.ts` | Surgical find-and-replace edits. Preferred over write_file. |
| `tools/runCommand.ts` | Spawn child process with live stdout/stderr streaming. Cancellable via AbortSignal. |
| `tools/gitStatus.ts` | Git branch, dirty state, staged/unstaged counts. |
| `tools/gitDiff.ts` | Unified diff of working tree changes. |
| `tools/workspaceInfo.ts` | Project kind, package manager, languages, scripts. |
| `tools/verificationTool.ts` | Verify and discover tests tools. |
| `tools/checkpoint.ts` | Create, list, and rollback checkpoints. |
| `tools/diffReview.ts` | Preview diffs, apply hunks selectively, view patch history. |
| `tools/index.ts` | Barrel export + `defaultTools` array + `phase2Tools` array. |

### Key Exports
- `ToolRegistry`, `createDefaultRegistry()`, `createPhase2Registry()`
- `verifyTool`, `discoverTestsTool`
- `runCommandTool` (with live streaming)
- All individual tools

---

## `@cluster/storage`

**Location:** `packages/storage/src/`

Session persistence and checkpoint management.

### Files

| File | Purpose |
|------|---------|
| `store.ts` | `SessionStore` — wraps lowdb JSON database. Debounced writes (150ms). CRUD for sessions, messages, tool calls, edits, command runs, errors, plans. Corrupt DB quarantine on read failure. |
| `schema.ts` | Database schema: `{ version, sessions: Session[] }`. Migration function. |
| `paths.ts` | `resolveStoragePaths()` — returns `{ home, databaseFile, backupsDir, checkpointsDir, patchHistoryDir, memoryDir }`. Default: `~/.cluster/`. |
| `checkpoints.ts` | `createCheckpoint()`, `listCheckpoints()`, `getCheckpoint()`, `rollbackToCheckpoint()`, `deleteCheckpoint()`, `assessPatchRisk()`. |
| `backups.ts` | Backup creation before file writes. |
| `patchHistory.ts` | Tracking patch operations for undo history. |

### Key Exports
- `SessionStore` (class with `open()`, `getSession()`, `appendMessage()`, etc.)
- `createCheckpoint`, `rollbackToCheckpoint`, `listCheckpoints`
- `resolveStoragePaths`

---

## `@cluster/shared`

**Location:** `packages/shared/src/`

Type definitions and utilities shared across all packages. No business logic.

### Files

| File | Purpose |
|------|---------|
| `types.ts` | Core domain types: `Session`, `Message`, `ToolCall`, `Edit`, `CommandRun`, `ErrorEvent`, `Plan`, `PlanStep`, `AgentState`, `WorkspaceInfo`, `GitState`, `AgentPhase`, `MessageKind`, `RiskLevel`, `ToolStatus`. |
| `tasks.ts` | Task graph types: `Task`, `TaskGraph`, `TaskStatus`, `AgentRole`, `createTask()`, `createTaskGraph()`. |
| `agents.ts` | `AGENT_DEFINITIONS` map (6 roles: planner, coder, reviewer, tester, context, coordinator). Tool permission matrix via `canUseTool()`. |
| `events.ts` | `Emitter<T>` class — typed event bus used throughout the system. |
| `events2.ts` | Second event type definition set (legacy compatibility). |
| `ids.ts` | `createId(prefix?)` — deterministic ID generation. |
| `result.ts` | `okResult()`, `failResult()` helpers for ToolResult construction. |
| `diff.ts` | Diff parsing and comparison utilities. |
| `text.ts` | Text manipulation helpers. |
| `logger.ts` | Simple logger with levels (debug/info/warn/error). |
| `paths.ts` | `clusterHome()`, `resolveWithin()`, `displayPath()`, `isWithin()`, `relativeTo()`, `PathEscapeError`. |
| `memory.ts` | Memory types: `MemoryEntry`, `MemoryCategory`, `MemoryScope`, `MemoryStats`, `createMemoryEntry()`. |
| `checkpoints.ts` | Checkpoint type definitions. |
| `verification.ts` | Verification result types. |
| `stateMachine.ts` | State machine types. |
| `permissions.ts` | Permission-related types. |

---

## `@cluster/workspace`

**Location:** `packages/workspace/src/`

Project detection and workspace information gathering.

### Files

| File | Purpose |
|------|---------|
| `detect.ts` | `detectProjectRoot(cwd)` — upward directory traversal looking for project markers (package.json, Cargo.toml, requirements.txt, go.mod). |
| `manifest.ts` | `loadWorkspaceInfo(root)` — parses package.json/Cargo.toml/etc., extracts scripts, detects language and package manager. |
| `git.ts` | Git integration: branch detection, HEAD hash, dirty state, staged/unstaged/untracked counts, recent commit subject. |
| `files.ts` | File utility functions (listing, filtering). |
| `commands.ts` | Command discovery from manifests (build, test, lint, format suggestions). |
| `watch.ts` | `WorkspaceWatcher` — chokidar-based filesystem watcher that emits change events. |
| `context.ts` | Context extraction from workspace files. |

### Key Exports
- `detectProjectRoot`, `loadWorkspaceInfo`
- `WorkspaceInfo`, `GitState`, `ProjectKind`, `PackageManager`
- `languageForPath()` — extension-to-language mapping

---

## `@cluster/task-engine`

**Location:** `packages/task-engine/src/`

DAG-based task scheduling with parallel execution.

### Files

| File | Purpose |
|------|---------|
| `graph.ts` | `TaskGraphStore` — stores tasks as a DAG. Topological sort, execution batch computation, dependency tracking, status updates, cycle detection. |
| `planner.ts` | `TaskPlanner` — heuristic and LLM-based task graph creation. Infers roles from task descriptions. |
| `engine.ts` | `TaskEngine` — executes tasks in dependency-order batches. Parallel workers (default maxConcurrency: 4). Pause/resume/cancel/retry. Event emission. |

### Key Exports
- `TaskEngine`, `TaskGraphStore`
- `TaskExecutor` type
- `TaskEngineEvents` type

---

## `@cluster/context-engine`

**Location:** `packages/context-engine/src/`

Intelligent context selection for LLM prompts.

### Files

| File | Purpose |
|------|---------|
| `engine.ts` | `ContextEngine` — main orchestrator. `gatherIntelligence()` gets repo metadata. `selectContext(query)` ranks files, chunks large ones, extracts symbols. |
| `ranking.ts` | `rankFiles()` — relevance scoring combining query match, file size, git changes, framework importance. |
| `chunking.ts` | `chunkFile()` splits large files into semantic chunks. `selectRelevantChunks()` picks the most relevant ones. |
| `symbols.ts` | `extractSymbols()` — parses TS/JS/Python files for class/function declarations. |
| `repoIntelligence.ts` | `gatherRepoIntelligence()` — collects project kind, languages, frameworks, file groups, recent git changes. |

### Key Exports
- `ContextEngine`
- `RepoIntelligence`, `ContextSelection`, `CodeChunk`, `SymbolInfo`, `FileScore`

---

## `@cluster/memory`

**Location:** `packages/memory/src/`

Persistent, searchable memory system for projects and sessions.

### Files

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports. |
| `store.ts` | `MemoryStore` — high-level API: `add()`, `recall()`, `search()`, `pin()`, `archive()`, `delete()`, `extractFromPrompt()`, `extractFromWorkflow()`, `retrieveContextual()`, `formatForPrompt()`, `getStats()`. |
| `database.ts` | `MemoryDatabase` — dual-backend: native `node:sqlite` with `sqlite-vec` extension (primary), falling back to in-memory Map + JSON dump. Schema: `memories` table + `vec_memories` virtual table. |
| `extraction.ts` | `MemoryExtractor` — pattern-based knowledge extraction from user prompts and task outcomes. Detects goals, UI preferences, coding conventions, architecture decisions, bug fixes, corrections. Deduplication via exact key match and semantic threshold (0.88). |
| `retrieval.ts` | `MemoryRetriever` — hybrid scoring: 50% vector similarity + 20% importance + pinned bonus + context bonus (category match, active file match). Audit logging. |
| `vector.ts` | Synthetic embedding generation (deterministic hash-based vectors) and cosine similarity. `getSqliteVecExtensionPath()` for native vector search. |

### Key Exports
- `MemoryStore` (class)
- `MemoryDatabase` (class)
- `MemoryExtractor`, `MemoryRetriever`
- `generateSemanticEmbedding`, `cosineSimilarity`

---

## `@cluster/ui-kit`

**Location:** `packages/ui-kit/src/`

Reusable React components used across the renderer.

### Files

| File | Purpose |
|------|---------|
| `DiffView.tsx` | Unified diff renderer with add/remove colors, hunk headers, line numbers. |
| `Collapsible.tsx` | Collapsible panel component with toggle. |
| `SplitPane.tsx` | Draggable split pane (horizontal/vertical). |
| `TaskItem.tsx` | Individual task card with status badge and role indicator. |
| `index.ts` | Barrel exports. |

---

## Dependency Graph

```
@cluster/shared          ← no internal dependencies
@cluster/workspace       ← @cluster/shared
@cluster/storage         ← @cluster/shared, @cluster/workspace
@cluster/tool-runtime    ← @cluster/shared
@cluster/memory          ← @cluster/shared
@cluster/context-engine  ← @cluster/workspace, @cluster/shared
@cluster/task-engine     ← @cluster/shared
@cluster/agent-core      ← @cluster/shared, @cluster/tool-runtime, @cluster/workspace, @cluster/memory
@cluster/ui-kit          ← React only (no internal deps)
cluster-electron         ← ALL packages
```
