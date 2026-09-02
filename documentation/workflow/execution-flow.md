# Workflow & Execution Flow

This document traces what happens from the moment the app launches to the completion of a task.

## Phase 0: Application Launch

```
npm run electron:dev
    │
    ▼
┌─────────────────────────────────────────┐
│  1. TypeScript compiles 3 targets:       │
│     • main/index.ts  → dist/main/       │
│     • preload/index.ts → dist/preload/  │
│     • renderer/      → vite dev server  │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  2. Electron launches main process       │
│     • registerIpc() — 40+ handlers      │
│     • createWindow() — 1400×900 dark    │
│     • app.whenReady().then(...)          │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  3. Main loads renderer                  │
│     • Dev: tries http://localhost:5173   │
│       (15 retries × 500ms, then fallback)│
│     • Prod: loads dist/renderer/index.html│
│     • Dev tools open automatically        │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  4. Renderer mounts (main.tsx → App.tsx) │
│     • Bootstrap useEffect fires:          │
│       – workspace.detect() → projectRoot  │
│       – workspace.info(root) → ws info    │
│       – config.get(root) → merged config  │
│       – sessions.list() → refresh         │
└─────────────────────────────────────────┘
```

### Auto-Detection at Startup

| Step | Method | Fallback |
|------|--------|----------|
| Detect project root | `workspace:detect(process.cwd())` | Hardcoded `C:/Coding Agent` (non-Electron) |
| Load workspace info | `workspace:info(projectRoot)` | Null info |
| Load config | `config:get(projectRoot)` | Empty config with `_hasKey: false` |
| Refresh sessions | `sessions:list({projectRoot})` | Empty array |

---

## Phase 1: Session Creation

A new session is created when the user clicks **+ New Session** or sends their first message.

```
User clicks "+" or types first message
    │
    ▼
ipcMain.handle('sessions:create', { projectRoot, model?, title? })
    │
    ├─ loadConfig({}, { projectRoot })
    │   └─ Merges: defaults ← env ← ~/.cluster/config.json ← cluster.config.json
    │
    ├─ SessionStore.createSession({
    │     id: createId('sess'),
    │     projectRoot,
    │     model: cfg.model || session.model || 'agnes-2.5-flash',
    │     title: opts.title
    │   })
    │
    └─ store.flush() → writes to ~/.cluster/sessions.json
```

### Session Data Shape (created empty)

```typescript
{
  id: "sess_abc123",
  schemaVersion: 1,
  title: "New Session",
  projectRoot: "/path/to/project",
  model: "gpt-4o-mini",
  createdAt: "2026-09-03T00:00:00Z",
  updatedAt: "2026-09-03T00:00:00Z",
  messages: [],
  toolCalls: [],
  edits: [],
  commandRuns: [],
  errors: [],
  plan: null,
  state: {
    phase: "idle",
    label: "Ready",
    iteration: 0,
    maxIterations: 40,
    startedAt: null,
    finishedAt: null,
    usage: { prompt: 0, completion: 0, total: 0 },
    model: "gpt-4o-mini"
  },
  workspace: null
}
```

---

## Phase 2: Sending a Message (Single-Agent Mode)

This is the core execution path. When the user types a message and presses Enter:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     SINGLE-AGENT EXECUTION FLOW                        │
└────────────────────────────────────────────────────────────────────────┘

  User types: "Add rate limiting to the auth middleware"
       │
       ▼
  useAgent.submit(text)
       │
       ├─ Optimistically adds user message to entries
       ├─ Sets running=true, phase='planning'
       └─ window.cluster.agent.send({ sessionId, text, mode: 'single' })
            │
            ▼
  ┌─ MAIN PROCESS: agent:send handler ──────────────────────────────┐
  │                                                                 │
  │  1. Load session from store                                     │
  │  2. Load workspace info                                         │
  │  3. Load config (4 layers merged)                               │
  │  4. Create ModelProvider(cfg)                                   │
  │  5. Create ToolRegistry (default or phase2)                     │
  │  6. Create Emitter[AgentEvents]                                 │
  │  7. Create MemoryStore ({ projectRoot, sessionId })             │
  │  8. Convert existing messages → provider format                 │
  │                                                                 │
  │  ┌─── HAS API KEY? ──────────────────────────────────────────┐  │
  │  │ YES → Real LLM path                                       │  │
  │  │ NO  → Demo mode (real tools, heuristic plan)              │  │
  │  └───────────────────────────────────────────────────────────┘  │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
       │
       ▼ (REAL LLM PATH)
  ┌─── AgentLoop.run(text, signal) ────────────────────────────────┐
  │                                                                 │
  │  STEP 1: Extract memory from prompt                            │
  │    memory.extractFromPrompt(text) → saves durable knowledge     │
  │                                                                 │
  │  STEP 2: Pre-task memory recall                                │
  │    memory.retrieveContextual({ queryText:text, limit:6 })       │
  │    → emit('memory:recalled', memories) → UI shows recalled mems │
  │    → Append formatted memories to system prompt                 │
  │                                                                 │
  │  STEP 3: Planning phase                                        │
  │    emit('state', { phase:'planning', iteration:0 })            │
  │    provider.chat(PLAN_SYSTEM_PROMPT, jsonMode=true)            │
  │    → Parse JSON response → Plan object                          │
  │    → emit('plan', plan) → UI renders plan steps                 │
  │                                                                 │
  │  STEP 4: Execution loop (1..maxIterations)                     │
  │    for iteration 1 to 40:                                      │
  │      │                                                         │
  │      ├─ if signal.aborted → break (cancelled)                  │
  │      │                                                         │
  │      ├─ emit('state', { phase:'thinking', iteration })         │
  │      │                                                         │
  │      ├─ provider.chat({                                     │
  │      │     messages: [system, ...trimmedHistory],            │
  │      │     tools: registry.toFunctionSchemas(),              │
  │      │     onDelta: (text) => emit('delta', text)            │
  │      │   })                                                   │
  │      │                                                         │
  │      │  ┌─ LLM RESPONSE ──────────────────────────────────┐   │
  │      │  │ • content: assistant text                        │   │
  │      │  │ • toolCalls: [{id, function:{name,args}}]        │   │
  │      │  │ • usage: {prompt, completion, total} tokens      │   │
  │      │  └──────────────────────────────────────────────────┘   │
  │      │                                                         │
  │      ├─ Emit assistant message (content + toolCallIds)         │
  │      ├─ Append to conversation history                          │
  │      │                                                         │
  │      ├─ If NO tool calls:                                     │
  │      │   • Set summary = content                              │
  │      │   • If empty → try fallback complete() call            │
  │      │   • Break loop (task done)                              │
  │      │                                                         │
  │      └─ runToolCalls(toolCalls, messageId, signal)             │
  │           │                                                    │
  │           ├─ For each tool call:                               │
  │           │   • Validate input via Zod                          │
  │           │   • Classify risk (safe/caution/destructive)        │
  │           │   • Check if confirmation needed                    │
  │           │   • emit('tool:start', record) → UI shows tool card│
  │           │   • registry.execute(name, input, ctx)             │
  │           │   │   │                                          │
  │           │   │   ├─ write_file → fs.readFile (backup)        │
  │           │   │   │                → fs.writeFile             │
  │           │   │   │                → compute diff             │
  │           │   │   │                                          │
  │           │   │   ├─ patch_file → find/replace → compute diff │
  │           │   │   │                                          │
  │           │   │   ├─ run_command → child_process.spawn()      │
  │           │   │   │                → stream stdout chunks     │
  │           │   │   │                → collect stderr            │
  │           │   │   │                → return exitCode+dur.ms   │
  │           │   │   │                                          │
  │           │   │   └─ ... (all other tools)                    │
  │           │   │                                               │
  │           │   • Record duration, status, result               │
  │           │   • emit('tool:end', record) → UI updates tool card│
  │           │   • If write/patch: emit('edit', diff)            │
  │           │   • Feed tool output back as 'tool' message       │
  │           │   • Check for repetition stall (>3 same calls)     │
  │           │   • Advance plan step status                        │
  │           │                                                   │
  │           └─ Return 'ok' | 'cancelled' | 'stalled'            │
  │                                                               │
  │  STEP 5: Finalization                                        │
  │    • Ensure final assistant summary message exists           │
  │    • If made edits but no verification run → warn            │
  │    • Update plan steps to done/failed/skipped                │
  │    • emit('state', { phase:'done'|'error'|'cancelled' })     │
  │    • emit('done', { summary, usage, cancelled, iterations }) │
  │    • memory.extractFromWorkflow(...) → save learnings        │
  │    • store.flush() → persist to disk                          │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
```

### Text Protocol Fallback

If the LLM endpoint rejects function calling (HTTP 400/422/404 with "tool" in body), `AgentLoop` automatically switches to text protocol:

1. `provider.markToolsUnsupported()` — remembers this for future calls
2. `systemPrompt` is rebuilt with text-format tool descriptions instead of JSON schemas
3. Tool calls are expressed as fenced code blocks: ````\ntool_name\n{\n  "arg": "value"\n}\n````
4. `parseToolBlock()` extracts tool name and arguments from the model's text response

This fallback is transparent to the user — they just see slightly slower responses.

### Repetition Detection

If the same tool call signature appears 3+ times consecutively, the loop returns `'stalled'` and injects a corrective message telling the model to try a different approach.

---

## Phase 2b: Sending a Message (Multi-Agent Mode)

Triggered by prefixing the message with `/multi `:

```
User types: "/multi Add auth middleware with rate limiting"
       │
       ▼
  mode === 'multi'
       │
       ▼
  Coordinator.createPlan(goal)
       │
       ├─ ContextEngine.gatherIntelligence() → fileGroups, languages
       ├─ PlannerAgent.createGraph(goal, fileGroups) → TaskGraph
       └─ emit('plan', graphAsPlan) → UI renders task DAG
       │
       ▼
  Coordinator.runGraph(graph, signal)
       │
       ├─ TaskEngine(graph, { maxConcurrency: 4 })
       ├─ Register executor: dispatches each task to its agent role
       │   │
       │   ├─ Before coder tasks: checkpoint_create (best-effort)
       │   ├─ File lock acquisition: prevents concurrent writes
       │   ├─ agent.run(task, ctx) for assigned role
       │   └─ Lock release on completion/failure
       │
       ├─ Engine runs batches in topological order
       │   (independent tasks run in parallel)
       │
       └─ Results collected per task
            │
            ▼
     Summary emitted: "- **coder**: ✓ Implemented auth middleware..."
```

### Agent Role Assignment

| Role | Tool Access | Run Via |
|------|-------------|---------|
| `planner` | read-only (workspace_info, list_files, read_file, search_text, git_status) | PlannerAgent |
| `context` | read-only (same + denied: write_file, patch_file, run_command) | ContextAgent |
| `coder` | read + write (read_file, list_files, search_text, write_file, patch_file, git_status, workspace_info) | CoderAgent |
| `reviewer` | read-only (read_file, list_files, search_text, git_status) | ReviewerAgent |
| `tester` | read + exec (run_command, read_file, list_files, workspace_info) | TesterAgent |
| `coordinator` | full access (all tools) | Coordinator (orchestration only) |

---

## Phase 3: Background Jobs

Separate from agent execution, users can start arbitrary commands:

```
User opens Background page → starts a command
    │
    ▼
ipcMain.handle('jobs:start', { command, cwd, sessionId? })
    │
    ├─ Create job record in jobRegistry Map
    ├─ Spawn run_command tool with streaming
    ├─ Forward each output chunk → wc.send('agent:tool:output', ...)
    ├─ On completion: update job.status ('done'/'failed'/'stopped')
    └─ Notify UI: wc.send('agent:job', job)
```

Background jobs survive agent cancellation but not app restart (in-memory only).

---

## Phase 4: Checkpoint Operations

```
Ctrl+G pressed (or manual checkpoint)
    │
    ▼
ipcMain.handle('checkpoints:create', { sessionId, projectRoot, message? })
    │
    ├─ Create snapshot directory: ~/.cluster/checkpoints/<sessionId>/<checkpointId>/
    ├─ Enumerate tracked files via git ls-files
    ├─ Read each file content + compute SHA-256 hash
    ├─ Write file snapshots to checkpoint dir (preserving relative paths)
    ├─ Write meta.json (id, sessionId, projectRoot, message, createdAt, gitHead, files[])
    └─ Write index.json (listing without full content)
    │
    ▼
Rollback requested
    │
    ▼
ipcMain.handle('checkpoints:rollback', { sessionId, checkpointId, projectRoot })
    │
    ├─ Read meta.json from checkpoint dir
    ├─ For each file in checkpoint:
    │   └─ fs.writeFile(projectRoot/file.path, file.content)
    └─ Return { restored: [...], errors: [...] }
```

---

## State Transition Map

### Agent Phase State Machine

```
                    ┌──────────┐
                    │   idle   │ ◄──── (session start / cancel)
                    └────┬─────┘
                         │ submit()
                         ▼
              ┌─────────────────┐
              │    planning     │ (creating task plan)
              └────────┬────────┘
                       │ plan received
                       ▼
              ┌─────────────────┐
              │   thinking      │ (waiting for LLM)
              └────────┬────────┘
                       │ model responds
           ┌───────────┼───────────┬───────────┬──────────┐
           ▼           ▼           ▼           ▼          ▼
      ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
      │ reading│ │editing │ │running │ │verifying│ │summarizing│
      └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └────┬─────┘
          │          │          │          │           │
          └──────────┴──────────┴──────────┴───────────┘
                           │
                           ▼
                    ┌──────────┐
                    │   done   │ (task complete)
                    └────┬─────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        ┌─────────┐           ┌──────────┐
        │  error  │           │cancelled │
        └─────────┘           └──────────┘
```

### Task Status State Machine (Multi-Agent)

```
pending ──► blocked ──► ready ──► running ──► done
                                    │         ▲
                                    │         │
                                    ├─ failed ─┤ (retry)
                                    ├ cancelled
                                    └ paused ──► ready (resume)
```
