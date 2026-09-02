# Cluster — Desktop Coding Assistant

> **A full-featured, dark Electron desktop application with 10 dedicated views, multi-agent orchestration, and Windows executable packaging.**

Cluster is an AI coding assistant designed to deliver a calm, premium desktop environment for software engineering. Built on Electron, React 18, Vite, and TypeScript, Cluster coordinates specialized agents (Planner, Coder, Reviewer, Tester, and Context) with real tool execution, streaming command output, diff reviews, memory persistence, process monitoring, and safe rollback checkpoints.

```
┌─ Cluster Desktop ────────────────────────────────────────────────────────┐
│ [Sessions] [Workspace] [Tasks] [Diffs] [Logs] [Background] [Checkpoints]  │
│                                                                          │
│ SESSIONS ▸ atlas · main                       $ cluster plan & execute   │
│ AGENTS   Coder ● Reviewer ● Tester            ✓ 3 parallel agents active │
│                                                                          │
│ ┌─ Coder ──────────────┐ ┌─ Reviewer ──────────┐ ┌─ Tester ─────────────┐│
│ │ src/auth.ts ██████   │ │ tests/auth.ts ████  │ │ vitest run █████████ ││
│ └──────────────────────┘ └─────────────────────┘ └──────────────────────┘│
│                                                                          │
│ Diff Review: src/auth.ts (+18 -3) · Checkpoint created before coder edits│
│ cluster (main) · 3 tasks done · UTF-8 · LF · 100% parity verified         │
└──────────────────────────────────────────────────────────────────────────┘
```

## Desktop Pages & Views

Cluster is organized into 10 dedicated views accessible via the sidebar navigation rail, keyboard shortcuts (`1` to `0`), and the global Command Palette (`Ctrl+K`):

1. **Home / Sessions (`1`)**: List, search, filter, switch, rename, and delete sessions with message and edit stats.
2. **Workspace / Chat (`2`)**: Main conversational interface with assistant/user message cards, live tool outputs, streaming text, agent state pills, and interactive confirmation modals.
3. **Tasks / Plan (`3`)**: Step-by-step task DAG, parallel execution batches (dependency levels), role indicators, and progress tracking.
4. **Diff & Review (`4`)**: Unified code diffs, line addition/deletion counts, syntax highlighting, and rollback controls.
5. **Logs (`5`)**: Searchable, filterable event streams (`Emitter<AgentEvents>`), tool outputs, and raw log inspector.
6. **Background Processes (`6`)**: Real-time process manager tracking PID, command lines, detected ports, health status, and live output streams.
7. **Checkpoints (`7`)**: Saved snapshot timeline, file lists, commit hashes, and one-click rollback.
8. **Memory (`8`)**: Project and session knowledge persistence, rule categories, and manual memory entry creator.
9. **Provider / Model (`9`)**: Active LLM provider configuration, base URL, API key status, model discovery, and live connection test ping.
10. **Settings / Workspace (`0`)**: Workspace directory switcher (`dialog:openDirectory`), git status, 4-layer config inspection, and diagnostics.
11. **Command Palette (`Ctrl+K`)**: Quick actions, session switching, and slash commands (`/help`, `/tasks`, `/diff`, `/logs`, `/checkpoint`, etc.).

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
```bash
cp .env.example .env
# Edit CLUSTER_API_KEY / OPENAI_API_KEY, CLUSTER_BASE_URL, CLUSTER_MODEL
# Or configure directly inside the app on the Provider / Model page
```

### 3. Launch Development Desktop App
```bash
npm run dev
# or: npm run electron:dev
```

### 4. Build Production Bundle
```bash
npm run electron:build
```

### 5. Package Windows Executable (.exe)
```bash
npm run electron:package
# Creates standalone installer in apps/electron/release/Cluster-Setup-0.1.0.exe
# Launches directly without requiring a terminal.
```

## Configuration (4 layers, increasing priority)

1. Built-in defaults (`gpt-4o-mini`, 120s timeout, 40 iterations)
2. Env: `CLUSTER_API_KEY` / `OPENAI_API_KEY`, `CLUSTER_BASE_URL`, `CLUSTER_MODEL`, `CLUSTER_TOOL_MODE`, `CLUSTER_MAX_ITERATIONS`, `CLUSTER_COMMAND_TIMEOUT_MS`, `CLUSTER_CONFIRM_DESTRUCTIVE`, etc.
3. `~/.cluster/config.json`
4. `cluster.config.json` (project root)

```jsonc
// cluster.config.json
{
  "model": "gpt-4o",
  "temperature": 0.1,
  "commands": { "build": "npm run build", "test": "npm test --silent" },
  "ignore": ["dist/**", "node_modules/**"],
  "extraInstructions": "Always run typecheck after edits."
}
```

## How a request flows (shared)

```
┌─────────────────────────────────────────────────────────────────┐
│ Renderer (Electron) or TUI ── prompt ──▶ agent-core ──▶ tool-runtime│
│     ▲                           │                 │                │
│     └──────── events ◀── Emitter ◀──────── workspace/storage      │
└─────────────────────────────────────────────────────────────────┘
```
1. UI hands prompt to **agent-core** (`AgentLoop` for single-agent, `Coordinator` + `TaskEngine` for multi-agent).
2. **ModelProvider** (`packages/agent-core/src/provider.ts`) streams `/chat/completions` (SSE, native tool_calls, fallback to fenced-JSON text protocol).
3. **ToolRegistry** validates via `zod`, emits `tool:start`/`tool:end`/`tool:output` (live chunk streaming for `run_command`).
4. UI subscribes to the event stream (TUI via `useAgent` hooks, Electron via `preload` → `ipcRenderer` → `window.cluster.agent.on*`).
5. Every turn is persisted to **storage** (`SessionStore` via `lowdb` JSON under `~/.cluster/db.json`, debounced 150ms, flushed at turn end). `resume`/`Ctrl+R` rehydrates.

## Layout

```
.
├── apps/
│   ├── tui/                Ink TUI — reference impl (preserved)
│   │   ├── src/cli.ts          commander entry (start/resume/sessions/config/doctor)
│   │   ├── src/bootstrap.ts    assembles config + stores + coordinator
│   │   ├── src/App.tsx         header + split pane + palette + composer
│   │   ├── src/hooks/useAgent.ts  agent controller (single + multi, events→state)
│   │   └── src/components/     ChatView, Composer, TaskBoard, DiffPanel, AgentPanel, Verify, Checkpoints, Memory, Logs…
│   └── electron/           Electron desktop — parity build
│       ├── src/main/index.ts   BrowserWindow, IPC handlers (sessions/workspace/config/checkpoints/agent sim), security
│       ├── src/preload/index.ts contextBridge → window.cluster
│       ├── src/renderer/       React + Vite + Tailwind premium dark UI
│       │   ├── App.tsx         Sidebar + TopBar + Agent tabs + TaskCards + Chat + Diff + Tabs (Tasks/Diff/Verify/Logs/Checkpoints/Memory/Background) + Composer + StatusBar + Palette + Settings
│       │   ├── components/     Sidebar, TopBar, TaskCards, DiffViewer, CommandPalette, Composer
│       │   ├── hooks/          useSessions, useAgent (IPC-backed)
│       │   └── styles/global.css  grid-bg, scrollbars, glows
│       ├── vite.config.ts, tailwind.config.js, postcss.config.js
│       └── package.json        build + electron-builder (win nsis → .exe)
├── packages/
│   ├── agent-core/         provider, orchestrator, coordinator, agents/*, stateMachine, history
│   ├── tool-runtime/       registry + tools (read_file, write_file, patch_file, run_command live, git_*, verify, checkpoints, diffReview)
│   ├── workspace/          detectProjectRoot, loadWorkspaceInfo, git, watchWorkspace, manifest, context
│   ├── storage/            SessionStore (lowdb), checkpoints (snapshot/rollback), backups, patchHistory, paths
│   ├── shared/             types (Session/Message/ToolCall/Edit/TaskGraph…), events, tasks, diff, logger, paths
│   ├── task-engine/        TaskGraphStore (DAG) + TaskEngine (batch-parallel, concurrency, retry, pause/cancel)
│   ├── context-engine/     repoIntelligence, chunking, ranking, symbols
│   ├── memory/             MemoryStore (project vs session)
│   └── ui-kit/             tokens
├── docs/
│   ├── ARCHITECTURE.md     full map before migration
│   └── FEATURE_AUDIT.md    TUI → Electron parity checklist
├── tsconfig.base.json / tsconfig.json (project references include apps/electron)
└── package.json            workspaces + scripts (build, electron:dev/build/package)
```

## Tools available to the agent (both shells)

| Tool | Purpose | Risk |
|------|---------|------|
| `workspace_info` | project kind/pm, git branch, languages | safe |
| `list_files` | glob | safe |
| `read_file` | text file (binary + range) | safe |
| `search_text` | literal/regex across project | safe |
| `git_status` / `git_diff` | working tree | safe |
| `write_file` | create/overwrite | varies |
| `patch_file` | targeted find/replace (preferred) | varies |
| `run_command` | shell with live `tool:output` streaming | varies |
| `verify` / `discover_tests` | build/test/lint discovery | varies |
| `checkpoint_create/list/rollback` | snapshot + rollback | safe |
| `diff_preview/applyHunks/patchHistory` | hunk-level review | safe |

Risk via `packages/tool-runtime/src/safety.ts`: `rm -rf`, `git push --force` etc. always prompt. Backups under `~/.cluster/backups/<session>/<call>/…`.

## Electron desktop feature map (mirrors TUI)

- **Sessions:** left sidebar lists 50 recents, active highlighted with `3 agents` badge, idle/running dots, `+ New session` → `window.cluster.sessions.create`
- **Multi-agent:** header `cluster run --parallel 3`, 3 cards (Cora writing / Milo reviewing / Zephyr planning) with progress bars + glows, file locks, checkpoint-before-edit
- **Task planning:** `Task board` tab — stats, timeline batches (topological levels), by-agent grouping, iconForStatus
- **Messages & tools:** Chat feed (user/assistant/error), ToolCallCard (name, risk color, duration), streaming cursor `▌`, live output panel
- **Diff/review:** `Diff` tab — unified diff, `+18 -3`, hunk colors, apply/rollback, `patchHistory` link
- **Logs & background:** `Logs` tab (activity 200 cap) + `Background` tab (run_command streaming, `tool:output` capped 32k)
- **Verification:** `Verify` tab — build/test/lint with passed/failed, duration, auto-fix attempts (mirrors `VerificationPanel`)
- **Checkpoints:** `Checkpoints` tab — `listCheckpoints`, `createCheckpoint` (Ctrl+G), `rollbackToCheckpoint`, gitHead + hash
- **Memory:** `Memory` tab — project vs session recall (limit 10) from `MemoryStore`
- **Provider/model:** top bar model pill + Settings modal (workspace, model, baseUrl, key presence) — mirrors `doctor`/`config`
- **Workspace:** top bar `cluster — ~/projects/atlas — zsh`, `detectProjectRoot` + `loadWorkspaceInfo` via IPC
- **Command palette:** `Ctrl/Cmd+K` — tasks/diff/verify/logs/checkpoints/memory/clear/multi/new-session/checkpoint/settings/verify/background
- **Slash commands:** `/help /plan /edits /tasks /diff /verify /agents /memory /checkpoint /multi /checkpoint-create /rollback /status` (handled in `handleSlash`)
- **Keyboard shortcuts:** `Enter` send, `Shift+Enter` newline, `Esc` close, `Ctrl+C` cancel→quit, `Tab` focus cycle, `1-8` tab switch, `Ctrl+G` checkpoint, `Ctrl+K` palette
- **States:** `idle/planning/thinking/reading/editing/running/verifying/summarizing/waiting/done/error/cancelled` + task `pending/ready/blocked/running/paused/done/failed/cancelled`

See `docs/FEATURE_AUDIT.md` for the full checklist.

## Visual direction (Electron)

Premium dark desktop, not terminal:

- Very dark bg `#07070a` + subtle grid lines `rgba(255,255,255,0.025)` 32px
- Surfaces `#0f0f11` / `#111113` / `#18181b`, thin borders `#232326` / `#2a2a2e`, rounded `xl` cards, `shadow-cluster`
- Accent `emerald #00d9a5` (writing), `amber #f59e0b` (reviewing), `violet #8b5cf6` (planning), glows `0 0 20px …`
- Mono for diffs/code (`JetBrains Mono`), sans for UI (`Inter`)
- Hierarchy: sidebar 260px, top bar 36px (drag-region), agent tabs 36px, secondary tabs, scrollable central workspace, composer, status bar 28px
- No clutter/ghost text/jitter — fixed heights, `overflow-hidden` splits, `backdrop-blur` overlays

## Development

```bash
npm run typecheck          # tsc -b
npm run build              # tsc -b → all dist
npm run dev                # TUI: tsx apps/tui/src/cli.ts
npm test                   # vitest run
npm run test:watch         # vitest

# Electron
npm run electron:dev       # vite@5173 + tsc --watch + electron
npm run electron:build     # tsc (main+preload) + vite build → apps/electron/dist
npm run electron:package   # + electron-builder --win --x64 → release/Cluster-Setup-*.exe
```

Tests live as `*.test.ts` next to code (real behavior, not mocks).

## Troubleshooting

- `✖ api key (not set)` — `CLUSTER_API_KEY` or `OPENAI_API_KEY` or `cluster config-set apiKey …` (Electron: Settings modal shows key presence)
- `endpoint does not support function calling` — auto-fallback to text protocol (slower but complete)
- `Refused to access "<path>" outside project root` — sandboxed to `detectProjectRoot`; use `--cwd`
- Sessions missing — `CLUSTER_HOME=/some/path cluster start` (Electron respects same via `resolveStoragePaths`)
- Wrong project root — `--cwd <dir>` (Electron: re-detect via `window.cluster.workspace.detect()`)
- Electron `dist/electron.exe` missing — re-run `npm install` (postinstall downloads binary); packaging needs Windows + network

## What Phase 2 already includes (beyond Phase 1 scope)

- Multi-agent orchestration (`Coordinator` + `TaskEngine` + file locks)
- `TaskGraphStore` DAG, parallel batches, retry/backoff, pause/cancel
- Checkpoints & rollback, patchHistory & hunk review
- Verification loop & auto-fix suggestion
- MemoryStore (project/session), ContextEngine (repo intelligence)

## Migration notes

1. **Analyze first** — `docs/ARCHITECTURE.md` before any code move.
2. **Restore TUI** if deleted — `git rebase`/`cherry-pick`/`reset` (here TUI was intact, so preserved).
3. **Learn TUI** end-to-end — session flow, agent orchestration, events, tools, persistence, checkpoints, shortcuts (see `docs/FEATURE_AUDIT.md`).
4. **Migrate to Electron** with parity — reuse `packages/*` directly, IPC for fs/commands/storage, renderer only for UI.
5. **Remove TUI only after parity** — TUI still ships (`npm start`).

## License

MIT.
