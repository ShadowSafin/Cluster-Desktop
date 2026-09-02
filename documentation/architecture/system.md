# System Architecture

## Monorepo Structure

```
cluster-cli/
├── apps/
│   ├── electron/          Electron desktop app (production UI)
│   │   ├── src/main/      BrowserWindow + IPC handlers
│   │   ├── src/preload/   contextBridge → window.cluster API
│   │   └── src/renderer/  React 18 + Vite + Tailwind CSS
│   └── tui/               Ink terminal TUI (reference implementation)
├── packages/
│   ├── agent-core/        LLM interaction, agent loop, coordinator
│   ├── tool-runtime/      Tool registry, execution, safety, verification
│   ├── storage/           Session persistence (lowdb JSON), checkpoints
│   ├── workspace/         Project detection, manifest parsing, git, watching
│   ├── shared/            TypeScript types, events, IDs, path utils
│   ├── task-engine/       DAG-based task scheduling & execution
│   ├── context-engine/    Repo intelligence, file ranking, chunking
│   ├── memory/            Persistent memory with vector search
│   └── ui-kit/            Reusable React components
├── docs/                  Legacy architecture & audit docs
├── scripts/               Build & test scripts
├── package.json           Root workspace config
└── tsconfig.json          Project references for cross-package builds
```

## Process Model

Cluster runs as a **single Electron process** with three TypeScript compilation targets:

| Target | Entry Point | Responsibility |
|--------|-------------|----------------|
| **Main** | `apps/electron/src/main/index.ts` | Window lifecycle, all IPC handlers, agent execution, storage access |
| **Preload** | `apps/electron/src/preload/index.ts` | Secure bridge exposing `window.cluster` API to renderer |
| **Renderer** | `apps/electron/src/renderer/main.tsx` | React UI (Vite dev server or built bundle) |

The main process is the **only place** that has direct filesystem access, can spawn child processes, and calls the LLM API. The renderer is a pure React app with no Node.js access — all operations go through IPC.

## Electron Main vs Renderer Responsibilities

### Main Process (`src/main/index.ts`)

| Concern | Implementation |
|---------|---------------|
| **Window management** | Creates `BrowserWindow` (1400×900, dark theme, titleBarOverlay) |
| **IPC registration** | ~40+ handler registrations via `ipcMain.handle()` |
| **Session store** | Opens `SessionStore` lazily; persists to `~/.cluster/sessions.json` |
| **Agent execution** | Instantiates `AgentLoop` / `Coordinator` / `ModelProvider` / `ToolRegistry` |
| **Background jobs** | Tracks running commands in `jobRegistry` Map |
| **Workspace detection** | Calls `detectProjectRoot()` and `loadWorkspaceInfo()` |
| **Config loading** | Resolves 4-layer config via `loadConfig()` |
| **Memory** | Creates `MemoryStore` per-session for recall/extraction |
| **Checkpoints** | Calls `createCheckpoint()`, `listCheckpoints()`, `rollbackToCheckpoint()` |

### Renderer Process (`src/renderer/`)

| Concern | Implementation |
|---------|---------------|
| **App shell** | `App.tsx` — sidebar + topbar + dynamic page content + status bar |
| **Pages** | 10 React pages (SessionsPage, WorkspacePage, TasksPage, etc.) |
| **State hooks** | `useAgent` (events→state), `useSessions` (session list) |
| **Components** | Sidebar, TopBar, Composer, DiffViewer, CommandPalette, etc. |
| **IPC consumption** | `window.cluster.*` API from preload bridge |
| **No Node access** | Zero `fs`, `child_process`, or direct API key usage |

## Core Backend Responsibilities (packages/*)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PACKAGE RESPONSIBILITIES                      │
├──────────────────────┬──────────────────────────────────────────────┤
│ @cluster/agent-core  │ ModelProvider (LLM client)                   │
│                      │ AgentLoop (single-agent iterative execution)  │
│                      │ Coordinator (multi-agent orchestration)       │
│                      │ Config resolution (4 layers)                 │
│                      │ Prompt building (system prompt templates)    │
│                      │ History trimming (120k char budget)          │
├──────────────────────┼──────────────────────────────────────────────┤
│ @cluster/tool-runtime│ ToolRegistry (zod-validated dispatch)        │
│                      │ 15+ registered tools (read/write/exec/git)    │
│                      │ Safety classification (safe/caution/destruct)│
│                      │ Verification engine (build/test/lint)         │
│                      │ Diff & patch utilities                        │
├──────────────────────┼──────────────────────────────────────────────┤
│ @cluster/storage     │ SessionStore (lowdb JSON persistence)         │
│                      │ Checkpoint create/list/rollback/delete        │
│                      │ Backup before edit                           │
│                      │ Patch history tracking                     │
│                      │ Storage path resolution                      │
├──────────────────────┼──────────────────────────────────────────────┤
│ @cluster/workspace   │ detectProjectRoot (upward search for markers)│
│                      │ loadWorkspaceInfo (manifest, git, commands)   │
│                      │ Git integration (status, diff, branches)     │
│                      │ File watching (chokidar)                    │
│                      │ Language detection by extension             │
├──────────────────────┼──────────────────────────────────────────────┤
│ @cluster/shared      │ All domain types (Session, Message, Task…)    │
│                      │ Emitter class (typed event bus)              │
│                      │ ID generation (nanoid-style)                 │
│                      │ Path utilities (resolveWithin, displayPath)  │
│                      │ Diff utilities                               │
│                      │ Memory types (categories, scopes)           │
├──────────────────────┼──────────────────────────────────────────────┤
│ @cluster/task-engine │ TaskGraphStore (DAG storage + topo sort)      │
│                      │ TaskEngine (batch-parallel executor)          │
│                      │ Pause/resume/cancel/retry controls           │
│                      │ Retry with exponential backoff               │
├──────────────────────┼──────────────────────────────────────────────┤
│ @cluster/context-engine│ Repo intelligence (file groups, languages) │
│                      │ File ranking (relevance scoring)              │
│                      │ Chunking (large file slicing)               │
│                      │ Symbol extraction (classes, functions)        │
├──────────────────────┼──────────────────────────────────────────────┤
│ @cluster/memory      │ MemoryStore (add/recall/search/pin/archive)   │
│                      │ MemoryDatabase (SQLite or in-memory + JSON)   │
│                      │ MemoryExtractor (pattern-based from prompts) │
│                      │ MemoryRetriever (hybrid vector + context)     │
│                      │ Synthetic embeddings (cosine similarity)      │
└──────────────────────┴──────────────────────────────────────────────┘
```

## IPC / Data Flow

All communication between renderer and main follows this pattern:

```
Renderer                              Main Process
    │                                      │
    │  ipcRenderer.invoke('sessions:list') │
    ├─────────────────────────────────────►┤
    │                                      │ SessionStore.listSessions()
    │                                      │
    │  ◄─── Promise<SessionSummary[]> ─────┤
    ├──────────────────────────────────────┤
    │                                      │
    │  ipcRenderer.invoke('agent:send', {   │
    │    sessionId, text, mode             │
    │  })                                  │
    ├─────────────────────────────────────►┤
    │                                      │ AgentLoop.run(text, signal)
    │                                      │   │
    │                                      │   ├─ ModelProvider.chat() → LLM API
    │                                      │   ├─ ToolRegistry.execute() → fs/child_process
    │                                      │   └─ SessionStore.append*() → persist
    │                                      │
    │  ◄─── Promise<{ ok: true }> ─────────┤
    │                                      │
    │  ipcRenderer.on('agent:message', cb) │◄─── events.emit('message', …)
    │  ipcRenderer.on('agent:tool:start',cb)◄─── events.emit('tool:start', …)
    │  ipcRenderer.on('agent:delta', cb)   │◄─── events.emit('delta', …)
    │  ipcRenderer.on('agent:done', cb)    │◄─── events.emit('done', …)
    │  ... (13 event channels total)       │
```

**Key design decisions:**
- `invoke()` = request/response (one-shot calls like `sessions:list`, `tools:execute`)
- `on()` = push-based event stream (agent progress, tool output, state changes)
- The preload bridge type-safety is defined in `IpcApi` interface
- No direct renderer→filesystem access; all I/O goes through main

## State Management Approach

Cluster uses a **reactive event-driven model** rather than a centralized store:

1. **Renderer state** lives in React hooks (`useAgent`, `useSessions`)
2. **Agent state** is an event stream (`Emitter<AgentEvents>`) — no Redux, no Zustand
3. **Persistence** is handled by `SessionStore` (lowdb JSON file) with debounced writes (150ms)
4. **Cross-component sharing** happens via lifting state to `App.tsx` and prop drilling
5. **Real-time updates** come from IPC event listeners that update hook state directly

This keeps the app lightweight but means state synchronization relies on correct event wiring — a failure in any `on*` listener silently drops data.

---

<div class="see-also">
<strong>Next:</strong> Read <a href="../workflow/execution-flow.md">Workflow & Execution Flow</a> to understand how a user message becomes executed tool calls and persisted results.
</div>
