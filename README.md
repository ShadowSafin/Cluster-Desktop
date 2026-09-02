# Cluster

<div align="center">

**A desktop AI coding assistant with multi-agent orchestration, persistent memory, and safe rollback checkpoints.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://typescriptlang.org)
[![Electron](https://img.shields.io/badge/Electron-31.7-black.svg)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org)
[![Node](https://img.shields.io/badge/Node-%3E%3D20.10-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Documentation](./documentation/) · [Architecture](./documentation/architecture/system.md) · [Quick Start](./documentation/guide/quick-start.md) · [Troubleshooting](./documentation/troubleshooting/troubleshooting.md)

</div>

---

## What Is Cluster?

Cluster is a **premium dark-themed Electron desktop application** that acts as an AI-powered coding companion. It runs specialized agents — Planner, Coder, Reviewer, Tester, and Context — in parallel across your project, executes real file edits and shell commands, and gives you full visibility into every action through diffs, logs, and checkpoints.

```
┌─ Cluster Desktop ───────────────────────────────────────────────────────────┐
│                                                                            │
│  ◈ CLUSTER          workspace: my-project              [⚙] [✓] [◈ New]    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                            │
│  ┌─ Sessions ──────────────┐  ┌─ Workspace ─────────────────────────────┐  │
│  │ • my-project (active)   │  │                                            │ │
│  │   24 msgs · gpt-4o-mini │  │  USER   Add rate limiting to auth        │ │
│  │                         │  │                                            │ │
│  │ • api-refactor          │  │  ◈ ASSISTANT  Thinking (iter 3/40)       │ │
│  │   12 msgs · gpt-4o      │  │     ├─ read_file src/middleware/auth.ts  │ │
│  │                         │  │     ├─ patch_file (rate limiter added)   │ │
│  │ + New Session           │  │     └─ verify → 12 passed ✓              │ │
│  └─────────────────────────┘  │                                            │ │
│                                │  ┌─ Tasks [3/4 done] ─┐  ┌─ Diffs [+18-3]─┐│
│  [1] Sessions  [2] Workspace  │  │ ▶ Gather context   │  │ src/auth.ts    ││
│  [3] Tasks     [4] Diffs      │  │ ✔ Design schema    │  │ @@ -10,7 +10,7 @@││
│  [5] Logs      [6] Background │  │ ✔ Implement routes │  │ -old() {}      ││
│  [7] Checkpoints [8] Memory   │  │ ✔ Review changes   │  │ +new() {}      ││
│  [9] Provider  [0] Settings   │  └────────────────────┘  └────────────────┘│
│                                │                                            │ │
│                                │  my-project/main · auth middleware ·      │ │
│                                │  gpt-4o-mini · 3 edits · running         │ │
│                                └────────────────────────────────────────────┘ │
│  my-project/main · auth middleware · gpt-4o-mini · 18 edits · done          │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### Multi-Agent Orchestration
| Capability | Description |
|------------|-------------|
| **Specialized Agents** | Planner decomposes requests · Coder implements changes · Reviewer inspects for issues · Tester runs verification · Context gathers repo intelligence |
| **Parallel Execution** | Independent tasks run concurrently (up to 4 workers) with dependency-ordered batches |
| **Role-Based Access** | Each agent only sees tools relevant to its role — Coders can't run commands; Testers can't edit files |
| **File Locking** | Parallel agents acquire file locks to prevent conflicting edits |

### Safe Code Modification
| Feature | Detail |
|---------|--------|
| **15+ Tools** | Read, write, patch, search, git ops, command execution, verification, diff review |
| **Zod Validation** | Every tool input is validated before execution — invalid calls never reach the filesystem |
| **Risk Classification** | Every tool call is classified as `safe` / `caution` / `destructive` with appropriate confirmation gates |
| **Automatic Backups** | Files are backed up to `~/.cluster/backups/` before any modification |
| **Checkpoints** | Full file snapshots with git HEAD tracking; one-click rollback via `Ctrl+G` |

### Persistent Memory
| Aspect | How It Works |
|--------|-------------|
| **Auto-Extraction** | Goals, preferences, architecture decisions, and bug fixes are extracted from conversations |
| **Semantic Search** | Vector-based recall surfaces relevant past work for new tasks |
| **Prompt Injection** | Retrieved memories are formatted and injected into the system prompt before planning |
| **Cross-Session** | Knowledge persists across sessions and app restarts |

### Production-Ready UI
| Element | Implementation |
|---------|---------------|
| **10 Dedicated Views** | Sessions, Workspace, Tasks, Diffs, Logs, Background Jobs, Checkpoints, Memory, Provider, Settings |
| **Live Streaming** | Token-by-token text streaming + real-time command output |
| **Command Palette** | `Ctrl+K` for instant navigation and actions across all pages |
| **Keyboard Shortcuts** | `1-0` for pages, `Ctrl+C` cancel, `Ctrl+G` checkpoint, `Ctrl+O` open folder |
| **Dark Theme** | Premium `#07070a` base with Tailwind CSS, Inter + JetBrains Mono fonts |

---

## Architecture Overview

```
                    ┌─────────────────────────────┐
                    │      ELECTRON APP            │
                    │                             │
    ┌───────────────┼─────────────────────────┐   │
    │  Renderer      │  Main Process           │   │
    │  (React 18)    │  (BrowserWindow)        │   │
    │                │                         │   │
    │  • 10 Pages    │  • IPC handlers (40+)   │   │
    │  • Components  │  • Agent execution      │   │
    │  • Hooks       │  • Storage access       │   │
    │  • State       │  • Background jobs      │   │
    └───────┬────────┴──────────┬──────────────┘   │
            │                   │                  │
            │   window.cluster  │                  │
            │   (contextBridge) │                  │
            └────────┬──────────┘                  │
                     │                             │
    ┌────────────────┼────────────────────────┐    │
    │     NPM PACKAGES (typed, isolated)       │    │
    │                                        │    │
    │  ┌──────────┐ ┌──────────┐ ┌────────┐ │    │
    │  │ agent-core│ │tool-rtime│ │storage │ │    │
    │  │          │ │          │ │        │ │    │
    │  │AgentLoop │ │Registry  │ │Sessions│ │    │
    │  │Coordinator│ │15+Tools │ │Checkpts│ │    │
    │  │Provider  │ │Safety    │ │Backups │ │    │
    │  └────┬─────┘ └────┬─────┘ └───┬────┘ │    │
    │       │            │           │       │    │
    │  ┌────┴─────┐ ┌────┴─────┐ ┌───┴────┐ │    │
    │  │workspace │ │ shared   │ │memory  │ │    │
    │  │         │ │types/util│ │store   │ │    │
    │  │detect   │ │emitter   │ │vector  │ │    │
    │  │manifest │ │paths     │ │extract │ │    │
    │  └──────────┘ └──────────┘ └────────┘ │    │
    │                                        │    │
    │  ┌──────────┐ ┌──────────┐ ┌────────┐ │    │
    │  │task-eng  │ │context   │ │ui-kit  │ │    │
    │  │         │ │engine    │ │        │ │    │
    │  │DAG+exec  │ │ranking   │ │DiffView│ │    │
    │  │retry/cancel│ │chunking │ │Panel  │ │    │
    │  └──────────┘ └──────────┘ └────────┘ │    │
    └────────────────────────────────────────┘    │
                                                     │
                                          ┌────────┴────────┐
                                          │ OpenAI-Compatible│
                                          │ Chat Completions │
                                          │    API Endpoint   │
                                          └─────────────────┘
```

---

## Quick Start

### Prerequisites

| Requirement | Minimum |
|-------------|---------|
| Node.js | >= 20.10.0 |
| npm | Bundled with Node |
| Git | Any version |

### Installation

```bash
git clone <repo-url>
cd "C:\Coding Agent"
npm install
```

### Configuration

```bash
# Option 1: Environment variables
cp .env.example .env
# Edit .env → set CLUSTER_API_KEY and CLUSTER_BASE_URL

# Option 2: In-app (Provider page, press 9)
# Option 3: Config files (~/.cluster/config.json or cluster.config.json)
```

### Run

```bash
npm run electron:dev     # Development mode (Vite + tsc watch + Electron)
npm run electron:build   # Production build
npm run electron:package # Windows installer (.exe)
```

---

## Configuration

Cluster resolves config from **4 layers** (lowest to highest priority):

| Layer | Location | Example |
|-------|----------|---------|
| 1. Defaults | Hardcoded | `model: "gpt-4o-mini"`, `maxIterations: 40` |
| 2. Environment | `.env` / shell | `CLUSTER_API_KEY=sk-...` |
| 3. Global | `~/.cluster/config.json` | Project-wide settings |
| 4. Project | `<root>/cluster.config.json` | Per-workspace overrides |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLUSTER_API_KEY` | — | LLM API key (or `OPENAI_API_KEY`) |
| `CLUSTER_BASE_URL` | `https://api.openai.com/v1` | Chat completions endpoint base |
| `CLUSTER_MODEL` | `gpt-4o-mini` | Model name |
| `CLUSTER_TOOL_MODE` | `auto` | `auto` · `native` · `text` |
| `CLUSTER_MAX_ITERATIONS` | `40` | Max agent loop iterations |
| `CLUSTER_COMMAND_TIMEOUT_MS` | `120000` | Command timeout (2 min) |
| `CLUSTER_CONFIRM_DESTRUCTIVE` | `true` | Require confirmation for destructive actions |
| `CLUSTER_CONFIRM_COMMANDS` | `false` | Paranoid mode: confirm ALL commands |
| `CLUSTER_HOME` | `~/.cluster/` | Override storage directory |

---

## Tool Reference

| Tool | Category | Risk | Purpose |
|------|----------|------|---------|
| `workspace_info` | Reading | safe | Project metadata, git state, languages |
| `list_files` | Reading | safe | Glob-based file listing |
| `read_file` | Reading | safe | Text file with optional line range |
| `search_text` | Reading | safe | Literal or regex search across project |
| `git_status` | Git | safe | Branch, dirty state, staged/unstaged counts |
| `git_diff` | Git | safe | Unified diff of working tree |
| `write_file` | Writing | varies | Create or overwrite files (with backup) |
| `patch_file` | Writing | varies | Surgical find-and-replace edits |
| `run_command` | Execution | varies | Shell command with live output streaming |
| `verify` | Verification | caution | Auto-discover and run build/test/lint |
| `discover_tests` | Verification | safe | Find test files and commands |
| `checkpoint_create` | Safety | safe | Snapshot current files |
| `checkpoint_list` | Safety | safe | List available checkpoints |
| `checkpoint_rollback` | Safety | destructive | Restore files from a checkpoint |
| `diff_preview` | Review | safe | Preview diff before applying |
| `apply_hunks` | Review | caution | Apply selected hunks from a diff |
| `patch_history` | Review | safe | View patch operation history |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `Cmd+K` | Open command palette |
| `Ctrl+O` / `Cmd+O` | Open workspace folder |
| `Ctrl+G` / `Cmd+G` | Create checkpoint snapshot |
| `Ctrl+C` (when running) | Cancel agent execution |
| `Escape` | Close modal / decline confirmation |
| `1` – `9`, `0` | Navigate to page |
| `Enter` | Send message |
| `Shift+Enter` | Newline in composer |

---

## Project Structure

```
cluster-cli/
├── apps/electron/            Electron desktop app
│   ├── src/main/             BrowserWindow + IPC handlers
│   ├── src/preload/          contextBridge → window.cluster
│   └── src/renderer/         React 18 + Vite + Tailwind
├── packages/
│   ├── agent-core/           LLM client, agent loop, coordinator
│   ├── tool-runtime/         Tool registry, 15+ tools, safety
│   ├── storage/              Session persistence, checkpoints
│   ├── workspace/            Project detection, manifest parsing
│   ├── shared/               Types, events, IDs, path utils
│   ├── task-engine/          DAG scheduling, parallel execution
│   ├── context-engine/       Repo intelligence, file ranking
│   ├── memory/               Persistent memory, vector search
│   └── ui-kit/               Reusable React components
├── docs/                     Legacy architecture & audit docs
├── scripts/                  Build & utility scripts
└── package.json              Workspace root
```

---

## Development

```bash
npm run typecheck       # TypeScript check across all packages
npm run build           # Full build (all packages + electron)
npm test                # Run test suite
npm run test:watch      # Watch mode

# Electron
npm run electron:dev    # Dev mode with hot reload
npm run electron:build  # Production build
npm run electron:package # Windows .exe installer
```

---

## Documentation

Full documentation lives in [`/documentation/`](./documentation/):

| Doc | Topic |
|-----|-------|
| [Overview](./documentation/overview.md) | What Cluster is, features, architecture |
| [System Architecture](./documentation/architecture/system.md) | Module breakdown, IPC flow, process model |
| [Package Map](./documentation/architecture/packages.md) | Every package explained |
| [Data Flow](./documentation/architecture/data-flow.md) | How data moves through the system |
| [Execution Flow](./documentation/workflow/execution-flow.md) | Request → response lifecycle |
| [Agent Loop](./documentation/workflow/agent-loop.md) | Single-agent deep dive |
| [Multi-Agent](./documentation/workflow/multi-agent.md) | Coordinator, TaskEngine, roles |
| [Data Models](./documentation/reference/data-model.md) | Session, Message, ToolCall, Edit types |
| [Memory System](./documentation/memory/memory-system.md) | Extraction, retrieval, storage |
| [Provider System](./documentation/provider/provider-system.md) | LLM integration, config, fallback |
| [Tools](./documentation/tools/tool-runtime.md) | All 15+ tools documented |
| [Checkpoints](./documentation/checkpoints/checkpoints.md) | Snapshots and rollback |
| [Context Engine](./documentation/context/context-engine.md) | Repo intelligence & chunking |
| [Pages](./documentation/ui/pages.md) | All 10 views documented |
| [Components](./documentation/ui/components.md) | UI component reference |
| [Hooks](./documentation/ui/hooks.md) | useAgent, useSessions, IPC API |
| [Background Jobs](./documentation/operations/background-jobs.md) | Job lifecycle and tracking |
| [Packaging](./documentation/build/packaging.md) | Build, package, distribute |
| [Configuration](./documentation/configuration/config.md) | 4-layer config resolution |
| [Developer Guide](./documentation/guide/developer-guide.md) | How to extend Cluster |
| [Troubleshooting](./documentation/troubleshooting/troubleshooting.md) | Common issues and fixes |
| [Contribution Guide](./documentation/guide/contribution-guide.md) | Conventions, style, PR checklist |

---

## License

MIT
