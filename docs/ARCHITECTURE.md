# Cluster Architecture — Full Audit (Step 0)

> Analyzed before any migration changes. TUI is source of truth.

## Project Type
- Monorepo, workspaces: `apps/*`, `packages/*`
- Package manager: npm, Node >=20.10, TypeScript 5.7 project references
- Build: `tsc -b`, `tsx` dev, `vitest` tests

## Layout
```
.
├── apps/tui               Ink+React TUI (terminal)
│   ├── src/cli.ts         commander CLI entry (start, resume, sessions, config, doctor)
│   ├── src/bootstrap.ts   assembles config+stores+registries+coordinator
│   ├── src/App.tsx        top-level layout, keybindings, slash commands, palette
│   ├── src/hooks/useAgent.ts  central controller (agent loop, multi-agent, events→state)
│   └── src/components/    ChatView, Composer, TaskBoard, DiffPanel, AgentPanel, etc.
├── packages
│   ├── agent-core         provider, orchestrator, coordinator, stateMachine, history, prompts, config
│   │   ├── provider.ts    OpenAI-compatible /chat/completions with SSE streaming, tool fallback
│   │   ├── coordinator.ts multi-agent dispatch, file locks, checkpoints before edits
│   │   ├── orchestrator.ts plan→execute→verify→memory pipeline
│   │   └── agents/        planner, context, coder, reviewer, tester
│   ├── tool-runtime       ToolRegistry (zod-validated), tools + safety/permissions/verification/diff
│   │   └── tools/         read_file, write_file, patch_file, run_command (live stream), git_*, verify
│   ├── workspace          detectProjectRoot, loadWorkspaceInfo, git, watchWorkspace, manifest, context
│   ├── storage            SessionStore (lowdb JSON), checkpoints (snapshot+rollback), backups, patchHistory
│   ├── shared             types (Session, Message, ToolCall, Edit, WorkspaceInfo, TaskGraph etc), events, tasks, diff, logger
│   ├── task-engine        TaskGraphStore (DAG), TaskEngine (batch-parallel, concurrency, retry, pause/cancel)
│   ├── context-engine     repoIntelligence, chunking, ranking, symbols
│   ├── memory             MemoryStore (project vs session, recall, task history)
│   └── ui-kit             (shared UI tokens for future Electron)
└── scripts/phase2-smoke.mjs  smoke test
```

## Data Flow
```
TUI ── prompt ──▶ agent-core ── tool calls ──▶ tool-runtime
 ▲                     │                       │
 │                     ▼                       ▼
 └──────── events ◀── Emitter ◀────────── workspace/storage
```
1. TUI `useAgent.submit` → `AgentLoop` → builds system prompt from workspace context
2. `ModelProvider` calls model via `toolMode` (native vs fenced-JSON text fallback)
3. Tool calls validated by `ToolRegistry`, emit `tool:start`/`tool:end`/`tool:output` (live chunk)
4. TUI subscribes via `Emitter<AgentEvents>` → chat view, tool cards, status, command output
5. Every turn persisted to `SessionStore` (lowdb JSON under `~/.cluster/db.json`, debounced 150ms, flush at turn end)
6. `resume` / `Ctrl+R` rehydrate transcript

## Session & Persistence
- `SessionStore` (lowdb): sessions array, `SessionSummary` list, `createSession`, `appendMessage/ToolCall/Edit/CommandRun/Error`, `setPlan/Workspace/updateState/renameSession`
- Paths: `resolveStoragePaths()` → `~/.cluster/` (override `CLUSTER_HOME`), `backups/<session>/<call>/`, `checkpoints/<session>/<id>/`
- `Session` contains: messages, toolCalls, edits, commandRuns, errors, plan, state (phase, usage), workspace
- Checkpoints: `createCheckpoint({sessionId, projectRoot, files?})` snapshots tracked files via `git ls-files`, stores `meta.json` + index, `rollbackToCheckpoint` restores files
- Backups: before each file edit copy to backupsDir

## Agent Orchestration
- Single-agent: `AgentLoop.run(prompt, signal)` iterative planning→tool→verify→summarize, events `state`, `plan`, `delta`, `tool:*`, `progress`, `done`
- Multi-agent: `Coordinator.createPlan(goal)` uses `ContextEngine` intelligence + `PlannerAgent` → `TaskGraph`. `Coordinator.runGraph(graph, signal)` creates `TaskEngine(maxConcurrency:4)`, dispatches per `agentRole` (planner, coder, reviewer, tester, context, coordinator) via `TaskExecutor`, file locks to avoid conflicts, checkpoint before coder tasks, emits `progress: "[role] message"`.
- `TaskGraphStore`: DAG with dependencies, topological order, executionBatches (levels), parallelGroups, status `pending|ready|blocked|running|paused|done|failed|cancelled`, retry with backoff, dependents tracking
- `TaskEngine.runAll`: batch-parallel, workers limited by concurrency, handles pause/cancel/retry, events `task:started/completed/failed/cancelled/paused/resumed/retry`
- `Orchestrator.execute`: coordinator.createPlan → coordinator.runGraph → runVerification (if coder edits) → memory persistence

## Tool Runtime
- Registry: `createDefaultRegistry()` vs `createPhase2Registry()` (+ applyHunks), registers 14-15 tools
- Tools: `workspace_info` (safe), `list_files`, `read_file` (range, binary detect), `search_text` (literal/regex), `git_status`, `git_diff`, `write_file`/`patch_file` (varies risk, backup), `run_command` (live output streaming via `emitOutput`), `verify`/`discoverTests`, `createCheckpoint/listCheckpoints/rollbackCheckpoint`, `diffPreview/applyHunks/patchHistory`
- Safety: `safety.ts` classifyCommand (rm -rf, git push --force etc → destructive), classifyPath (.env, keys → destructive)
- Verification: `runVerification` auto-discovers build/test/lint commands, runs, returns `VerificationResult` with pass/fail, suggests auto-fix

## Provider/Model
- `ModelProvider` OpenAI-compatible, `CLUSTER_API_KEY`|`OPENAI_API_KEY`, `CLUSTER_BASE_URL`, `CLUSTER_MODEL`, `CLUSTER_TOOL_MODE`, `CLUSTER_MAX_ITERATIONS`, `CLUSTER_COMMAND_TIMEOUT_MS`, etc.
- Config layers: built-in defaults → env → `~/.cluster/config.json` → `cluster.config.json` (project)
- Handles streaming SSE (`delta.content` + `delta.tool_calls` incremental merge), fallback to text protocol if endpoint rejects tools, `ProviderError.isToolUnsupported`

## Checkpoint & Resume
- `listCheckpoints`, `getCheckpoint`, `rollbackToCheckpoint`, `deleteCheckpoint`, `assessPatchRisk`
- Session resume: `store.latestSession(projectRoot)`, `store.getSession(id)`, `SessionStore.open()` reads+migrates DB, quarantine corrupt file
- Bootstrap `createBootstrap({cwd, model, baseUrl, sessionId, continueSession, title})` resolves root, loads env+config, opens store, creates or resumes session, sets workspace, starts `watchWorkspace`

## Background Jobs & Watching
- `watchWorkspace(projectRoot)` via `WorkspaceWatcher` (chokidar) → events `change` (create/change/unlink) → `useAgent` pushes to activity feed
- `run_command` tool runs as background job with live `tool:output` streaming, cancellable via `AbortController`
- `TaskEngine` background parallel workers

## UI / TUI Features (see FEATURE_AUDIT.md for full map)
- Header: version, workspace name, phase, agent indicators, focus hint
- Main split: left conversation (ChatView→MessageItem/ToolCallCard + streaming + PlanView + ActivityFeed + LiveOutput), right workspace tabs (tasks, diff, verify, agents, logs, checkpoints, memory)
- Composer: value/cursor, history Up/Down, Shift+Enter newline, placeholder busy/idle
- Interactions: Enter send, Ctrl+C cancel→quit, Tab focus cycle, 1-7 tabs, Ctrl+K palette, Ctrl+W workspace toggle, Ctrl+R reload, Ctrl+T expand tools, Ctrl+G checkpoint, Ctrl+P/Y pause/resume, PageUp/PageDown scroll, `/` quick actions, `?` help
- Overlays: ConfirmDialog (risky tools), HelpOverlay, CommandPalette, SelectList, Splash (when empty)
