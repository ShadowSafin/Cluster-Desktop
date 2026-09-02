# Overview — Cluster Desktop

<div class="callout">
<strong>Cluster</strong> is a desktop AI coding assistant that runs as a native Electron application on Windows, macOS, and Linux. It combines multi-agent orchestration, persistent memory, real-time diff review, and safe rollback checkpoints into a single polished interface.
</div>

## What Problem Does Cluster Solve?

Modern AI coding assistants exist as web apps or terminal CLIs. Neither provides:

- **A persistent workspace context** — Cluster detects your project root, understands its language/framework, and remembers it across sessions.
- **Safe, auditable file modifications** — Every edit is backed up, versioned via checkpoints, and presented as a diff before you commit.
- **Long-running operations** — Background jobs (servers, dev watches) stay visible and controllable without leaving the app.
- **Durable project knowledge** — Cluster learns your preferences, architecture decisions, and bug-fix patterns and injects them into future prompts automatically.

## Key Features

### Agent Orchestration
| Feature | Description |
|---------|-------------|
| **Single-Agent Mode** | `AgentLoop` runs iterative planning → model call → tool execution → summarization until the task is complete |
| **Multi-Agent Mode** | `Coordinator` dispatches specialized agents (Planner, Coder, Reviewer, Tester, Context) across a DAG with parallel execution |
| **Role-Based Tool Access** | Each agent only sees the tools relevant to its role (e.g., Coder cannot run commands; Tester cannot edit files) |
| **File Locking** | Parallel agents acquire file locks to prevent conflicting edits |

### Tool Ecosystem
| Category | Tools |
|----------|-------|
| **Reading** | `workspace_info`, `list_files`, `read_file`, `search_text`, `git_status`, `git_diff` |
| **Writing** | `write_file`, `patch_file` (preferred for surgical edits) |
| **Execution** | `run_command` (live streaming output, cancellable) |
| **Verification** | `verify`, `discover_tests` (auto-discovers build/test/lint commands) |
| **Safety** | `checkpoint_create`, `checkpoint_list`, `checkpoint_rollback` |
| **Review** | `diff_preview`, `apply_hunks`, `patch_history` |

Every tool has **Zod-validated input**, **risk classification** (`safe` / `caution` / `destructive`), and **automatic backups** before edits.

### Memory System
- **Persistent**: Project and session memories survive across app restarts
- **Semantic Search**: Vector embeddings enable similarity-based recall of past work
- **Auto-Extraction**: Clusters goals, preferences, architecture decisions, and bug fixes from conversation history
- **Prompt Injection**: Retrieved memories are formatted and injected into the agent's system prompt before planning

### Checkpoints & Rollback
- **Snapshots**: Full file snapshots stored under `~/.cluster/checkpoints/<session>/<id>/`
- **One-Click Restore**: Roll back any session to any checkpoint
- **Git-Aware**: Checkpoints include the git HEAD hash at time of snapshot
- **Keyboard Shortcut**: `Ctrl+G` creates an instant checkpoint

### Background Jobs
- **Live Streaming**: `run_command` streams stdout/stderr in real-time
- **Process Tracking**: PID, command line, detected ports, duration
- **Start/Stop/Restart**: Full lifecycle control from the UI
- **Port Detection**: Automatically detects local server ports from output

### UI & Navigation
- **10 Dedicated Views**: Sessions, Workspace, Tasks, Diffs, Logs, Background, Checkpoints, Memory, Provider, Settings
- **Command Palette**: `Ctrl+K` for instant navigation and actions
- **Keyboard Shortcuts**: `1-0` for page switching, `Ctrl+C` to cancel, `Enter` to submit
- **Dark Theme**: Premium dark UI with Tailwind CSS and a #07070a base

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ELECTRON APP                                │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────────────────────────────┐  │
│  │   Renderer   │◄──►│           Main Process                   │  │
│  │   (React)    │    │  (Electron BrowserWindow + IPC)           │  │
│  │              │    │                                          │  │
│  │  • 10 Pages  │    │  • Session Store (lowdb JSON)            │  │
│  │  • Components│    │  • Tool Registry + Execution             │  │
│  │  • Hooks     │    │  • Background Job Tracker                │  │
│  │  • State     │    │  • Model Provider Client                  │  │
│  └──────┬───────┘    │  • Memory Store                           │  │
│         │            │  • Checkpoint Manager                     │  │
│         │            │  • Workspace Detector                     │  │
│         │            └──────────────────────────────────────────┘  │
│         │ IPC (contextBridge → window.cluster)                      │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │                    NPM PACKAGES                           │      │
│  │                                                            │      │
│  │  ┌─────────────┐ ┌─────────────┐ ┌────────────────────┐  │      │
│  │  │ agent-core  │ │ tool-runtime │ │     storage        │  │      │
│  │  │             │ │              │ │                    │  │      │
│  │  │ AgentLoop   │ │ ToolRegistry │ │  SessionStore      │  │      │
│  │  │ Coordinator │ │ 15+ Tools    │ │  Checkpoints       │  │      │
│  │  │ Provider    │ │ Safety/Risk  │ │  Backups           │  │      │
│  │  │ Prompts     │ │ Verification │ │                    │  │      │
│  │  └─────────────┘ └─────────────┘ └────────────────────┘  │      │
│  │                                                            │      │
│  │  ┌─────────────┐ ┌─────────────┐ ┌────────────────────┐  │      │
│  │  │ workspace   │ │  shared     │ │    context-engine  │  │      │
│  │  │             │ │              │ │                    │  │      │
│  │  │ detectRoot  │ │ All types    │ │  File Ranking      │  │      │
│  │  │ loadInfo    │ │ Events/ID    │ │  Chunking          │  │      │
│  │  │ git/files   │ │ helpers      │ │  Symbols           │  │      │
│  │  └─────────────┘ └─────────────┘ └────────────────────┘  │      │
│  │                                                            │      │
│  │  ┌─────────────┐ ┌─────────────┐ ┌────────────────────┐  │      │
│  │  │  task-engine │ │   memory    │ │      ui-kit        │  │      │
│  │  │              │ │              │ │                    │  │      │
│  │  │ TaskGraph    │ │ MemoryStore  │ │  DiffView          │  │      │
│  │  │ TaskEngine   │ │ Extraction   │ │  Collapsible       │  │      │
│  │  │ Batch runner │ │ Retrieval    │ │  SplitPane         │  │      │
│  │  │ Retry/Cancel │ │ Vector DB    │ │  TaskItem          │  │      │
│  │  └─────────────┘ └─────────────┘ └────────────────────┘  │      │
│  └──────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  OpenAI-Compatible    │
              │  Chat Completions API │
              │  (any /v1 endpoint)   │
              └───────────────────────┘
```

## Major Subsystems

| Subsystem | Package | Responsibility |
|-----------|---------|----------------|
| **Agent Core** | `@cluster/agent-core` | LLM interaction, agent loop, coordinator, prompts, config |
| **Tool Runtime** | `@cluster/tool-runtime` | Tool registry, validation, execution, safety, verification |
| **Storage** | `@cluster/storage` | Session persistence (JSON), checkpoints, backups, path resolution |
| **Workspace** | `@cluster/workspace` | Project detection, manifest parsing, git state, file watching |
| **Task Engine** | `@cluster/task-engine` | DAG-based task scheduling, parallel batch execution, retry logic |
| **Context Engine** | `@cluster/context-engine` | Repository intelligence, file ranking, chunking, symbol extraction |
| **Memory** | `@cluster/memory` | Persistent memory store, semantic search, extraction, retrieval |
| **Shared** | `@cluster/shared` | TypeScript types, ID generation, event emitters, path utilities |
| **UI Kit** | `@cluster/ui-kit` | Reusable React components (DiffView, SplitPane, TaskItem) |

## Current Product Direction

**Phase 1** (current): Reliable MVP foundation
- Single-agent loop with robust tool execution
- Multi-agent orchestration via Coordinator + TaskEngine
- Complete tool set (15+ tools) with safety checks
- Checkpoints, memory, background jobs
- Electron desktop app with 10 views

**Near-term Goals**:
- Enhanced vector memory with real embeddings (currently uses synthetic embeddings)
- Better cross-provider compatibility (Anthropic, Google via LiteLLM proxy)
- Plugin architecture for custom tools
- Collaborative session sharing
- Web-based deployment option

---

<div class="see-also">
<strong>Next:</strong> Read the <a href="./architecture/system.md">Architecture Overview</a> to understand how these subsystems connect, then the <a href="./workflow/execution-flow.md">Execution Flow</a> to see what happens when you send a message.
</div>
