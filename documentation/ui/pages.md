# Pages & Screens

## Page Map

Cluster has **10 dedicated pages** plus a global command palette. Each page is a React component rendered conditionally in `App.tsx`.

| Key | Page | Shortcut | Description |
|-----|------|----------|-------------|
| `sessions` | SessionsPage | `1` | Session list, creation, deletion, renaming |
| `workspace` | WorkspacePage | `2` | Main chat interface with agent output |
| `tasks` | TasksPage | `3` | Task DAG visualization, plan steps |
| `diff` | DiffPage | `4` | Code diffs, edit history, rollback |
| `logs` | LogsPage | `5` | Activity feed, live command output |
| `background` | BackgroundPage | `6` | Background job manager |
| `checkpoints` | CheckpointsPage | `7` | Checkpoint list, creation, rollback |
| `memory` | MemoryPage | `8` | Memory browser, search, add/edit |
| `provider` | ProviderPage | `9` | Model config, API key, endpoint test |
| `settings` | SettingsPage | `0` | Workspace switcher, diagnostics |

---

## Page Details

### SessionsPage (`pages/SessionsPage.tsx`)

Shows all sessions for the current workspace.

**Features:**
- Session cards with title, message count, edit count, model, phase indicator
- Active session highlighted with border
- Running sessions show amber pulsing dot
- Click to select and navigate to Workspace page
- Delete button (with confirmation)
- Rename via inline input
- New session button (+)
- Filter by project root (all sessions vs current workspace)

**Data source:** `useSessions(projectRoot)` → `window.cluster.sessions.list()`

---

### WorkspacePage (`pages/WorkspacePage.tsx`)

The main conversation interface. This is the default page and where most interaction happens.

**Layout (top to bottom):**
1. **Session header** — Title, model badge, phase indicator
2. **Recalled memories strip** — Shows recently recalled memory entries (if any)
3. **Message timeline** — Scrollable chat view with user/assistant/tool cards
4. **Plan view** — Collapsible plan steps with status icons
5. **Streaming text area** — Live token-by-token display with cursor `▌`
6. **Confirmation modal** — Appears when destructive tool needs approval
7. **Composer** — Text input at the bottom

**Message types rendered:**
| Kind | Appearance |
|------|------------|
| `user` / `chat` | Cyan accent, right-aligned bubble |
| `assistant` / `summary` | White/light, left-aligned |
| `assistant` / `error` | Red tint, warning icon |
| `assistant` / `warning` | Amber tint |
| `assistant` / `info` | Muted gray |
| Tool result | Collapsed card with name, risk color, duration |

**Key interactions:**
- `Enter` — Send message
- `Shift+Enter` — Newline in composer
- `Ctrl+C` — Cancel running agent
- `/multi <text>` — Switch to multi-agent mode
- Slash commands: `/help`, `/clear`, `/tasks`, `/diff`, `/logs`, `/checkpoint`, `/memory`, `/provider`, `/settings`

---

### TasksPage (`pages/TasksPage.tsx`)

Visualizes the task graph from multi-agent execution.

**Displays:**
- Graph goal and overall status
- Stats: total/done/failed/running/pending/blocked tasks
- Timeline view: batches as horizontal lanes with dependency arrows
- Per-batch task cards showing role, title, status
- Filter by role (all/planner/coder/reviewer/tester/context)
- Expand/collapse individual tasks

**Data source:** `agent.taskGraph` (derived from `agent:plan` and `agent:graph` events)

---

### DiffPage (`pages/DiffPage.tsx`)

Shows all file edits made during the active session.

**Each edit card displays:**
- File path (relative to project root)
- Edit kind: Create / Update / Delete
- Unified diff with syntax highlighting
- `+N -M` addition/deletion counts
- Timestamp
- Rollback button (opens checkpoint selector)

**Data source:** `agent.edits` array

---

### LogsPage (`pages/LogsPage.tsx`)

Combined activity feed and live output viewer.

**Two sections:**
1. **Activity feed** — Timestamped log lines from all agent events (capped at 200 lines)
2. **Live output** — Streaming stdout from `run_command` tool calls, organized by call ID

**Filters:**
- Search box for filtering activity lines
- Status filter: all / errors / tools / progress

**Data source:** `agent.activity[]` + `agent.liveOutput`

---

### BackgroundPage (`pages/BackgroundPage.tsx`)

Manages long-running background jobs (commands started via the app).

**Each job card shows:**
- Command string (truncated)
- Working directory
- Status badge: running (amber pulse) / done (green) / failed (red) / stopped (gray)
- PID (simulated random number in demo mode)
- Detected port (auto-extracted from output)
- Started at timestamp
- Duration
- Collapsible output panel
- Stop / Restart buttons

**Data source:** `agent.jobs[]` — populated from `agent:job` IPC events

---

### CheckpointsPage (`pages/CheckpointsPage.tsx`)

Lists checkpoints for the active session.

**Each checkpoint shows:**
- ID (click to copy)
- Message description
- Creation timestamp
- Git HEAD hash
- File count
- Create button (creates new checkpoint)
- Rollback button (restores to this checkpoint)

**Data source:** `window.cluster.checkpoints.list(sessionId)` — loaded on mount and when session changes

---

### MemoryPage (`pages/MemoryPage.tsx`)

Full memory management interface.

**Sections:**
1. **Stats bar** — Total memories, pinned, archived, breakdown by category/scope
2. **Filter toolbar** — Scope tabs (All/Project/Session), Category chips, Pin toggle, Archive toggle, Search box
3. **Memory cards** — Title, summary, category badge, tags, importance bar, pin/archive/delete actions
4. **Add memory form** — Modal for creating new entries with all fields

**API calls:**
- `memory:list({ projectRoot, sessionId, category, scope, pinned, archived, search, limit })`
- `memory:search({ query, limit })`
- `memory:add({ ... })`
- `memory:update({ id, updates })`
- `memory:pin({ id, pinned })`
- `memory:archive({ id, archived })`
- `memory:delete({ id })`
- `memory:clearProject({ projectRoot })`
- `memory:stats({ projectRoot })`
- `memory:getRetrievedForTask({ sessionId })`

---

### ProviderPage (`pages/ProviderPage.tsx`)

LLM provider configuration and testing.

**Fields:**
- Base URL (with validation)
- API Key (masked display, show/hide toggle)
- Model name
- Temperature slider
- Max iterations
- Tool mode selector (auto/native/text)
- Confirm destructive toggle
- Confirm all commands toggle

**Actions:**
- **Test Connection** — Calls `models:test` with current settings, shows latency and reply
- **Discover Models** — Calls `models:list` to fetch available models from endpoint
- **Save** — Persists to `~/.cluster/config.json` via `config:set`
- **Reset to Defaults** — Clears overrides

**Diagnostics badge:** Shows connection status, key presence, model info

---

### SettingsPage (`pages/SettingsPage.tsx`)

Workspace and environment configuration.

**Sections:**
1. **Workspace** — Current project root, name, git branch, dirty state, detected project kind
2. **Open Folder** — Dialog to switch workspace (`dialog:openDirectory`)
3. **Recent Workspaces** — List of recently opened paths (from localStorage)
4. **Config Inspection** — Show effective config (masked key)
5. **Diagnostics** — Runtime info (Node version, Electron version, platform, arch), storage paths, session count, tool count
6. **Environment Variables** — Table of relevant env vars and their values

---

## Component Hierarchy

```
App
├── TopBar
│   ├── Workspace name (clickable → workspace switcher)
│   ├── Model badge
│   ├── Session title
│   ├── New Session button
│   ├── Checkpoint button (Ctrl+G)
│   └── Command Palette button (Ctrl+K)
├── Sidebar
│   ├── Brand + workspace name
│   ├── Nav items (10 pages with badges + shortcuts)
│   ├── Session list (scrollable, max 8 shown)
│   └── Agent status footer (roles, running indicator)
├── Main Content Area (conditional render)
│   ├── SessionsPage
│   ├── WorkspacePage
│   │   ├── SessionHeader
│   │   ├── RecalledMemoriesStrip
│   │   ├── MessageTimeline
│   │   │   ├── MessageItem (user/assistant/various kinds)
│   │   │   └── ToolCallCard (name, risk, duration, expanded view)
│   │   ├── PlanView (collapsible)
│   │   ├── StreamingText (with cursor)
│   │   ├── ConfirmDialog (modal)
│   │   └── Composer
│   ├── TasksPage
│   │   ├── TaskStats
│   │   └── TaskBoard (batches + task cards)
│   ├── DiffPage
│   │   └── EditCard × N
│   │       ├── DiffView (from ui-kit)
│   │       └── Rollback button
│   ├── LogsPage
│   │   ├── ActivityFeed
│   │   └── LiveOutputPanel
│   ├── BackgroundPage
│   │   └── JobCard × N
│   ├── CheckpointsPage
│   │   └── CheckpointCard × N
│   ├── MemoryPage
│   │   ├── MemoryStats
│   │   ├── FilterBar
│   │   ├── MemoryCard × N
│   │   └── AddMemoryModal
│   ├── ProviderPage
│   │   ├── ConfigForm
│   │   ├── TestConnectionButton
│   │   └── ModelDiscoverySection
│   └── SettingsPage
│       ├── WorkspaceInfo
│       ├── RecentWorkspaces
│       ├── ConfigInspector
│       └── DiagnosticsPanel
├── StatusBar (always visible at bottom)
├── CommandPalette (modal overlay)
└── WorkspaceSwitcherModal (modal overlay)
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `Cmd+K` | Toggle command palette |
| `Ctrl+O` / `Cmd+O` | Open folder dialog |
| `Ctrl+G` / `Cmd+G` | Create checkpoint |
| `Ctrl+C` (when running) | Cancel agent |
| `Escape` | Close modal / cancel confirm |
| `1` – `9`, `0` | Navigate to page (1=sessions, 2=workspace, ..., 0=settings) |
| `Enter` | Send message (in composer) |
| `Shift+Enter` | Newline in composer |

---

## State Management Summary

| State | Hook | Source |
|-------|------|--------|
| Sessions list | `useSessions(projectRoot)` | `window.cluster.sessions.list()` |
| Agent events (messages, tools, state) | `useAgent(sessionId)` | IPC event listeners |
| Checkpoints | Loaded in App.tsx useEffect | `window.cluster.checkpoints.list()` |
| Config | Loaded in App.tsx bootstrap | `window.cluster.config.get()` |
| Workspace info | Loaded in App.tsx bootstrap | `window.cluster.workspace.info()` |
| Recent workspaces | localStorage | `cluster:recent_workspaces` key |
