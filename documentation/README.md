# Cluster Documentation

Welcome to the official documentation for **Cluster** — a desktop AI coding assistant built with Electron, React 18, and TypeScript. This documentation is organized by topic and written for developers who want to understand, extend, or contribute to Cluster.

---

## Table of Contents

### Getting Started
| Doc | Description |
|-----|-------------|
| [Overview](./overview.md) | What Cluster is, what problem it solves, key features, and current product direction |
| [Quick Start](./guide/quick-start.md) | How to install, configure, and run Cluster locally |

### Architecture
| Doc | Description |
|-----|-------------|
| [System Architecture](./architecture/system.md) | High-level architecture diagram, module breakdown, Electron vs renderer responsibilities, IPC/data flow |
| [Package Map](./architecture/packages.md) | Every package explained: agent-core, tool-runtime, storage, workspace, shared, task-engine, context-engine, memory, ui-kit |
| [Data Flow](./architecture/data-flow.md) | How data moves between UI → agent → tools → storage → back to UI |

### Workflow & Execution
| Doc | Description |
|-----|-------------|
| [Workflow & Execution Flow](./workflow/execution-flow.md) | What happens from app launch through session creation, task planning, execution, and completion |
| [Agent Loop](./workflow/agent-loop.md) | Single-agent execution: planning, model calls, tool dispatch, streaming, and finalization |
| [Multi-Agent Orchestration](./workflow/multi-agent.md) | Coordinator, TaskEngine, task graphs, parallelism, file locks, and role-based agents |

### Data Model
| Doc | Description |
|-----|-------------|
| [Core Data Models](./reference/data-model.md) | Session, Message, ToolCall, Edit, CommandRun, ErrorEvent types and their relationships |
| [Task Graph Types](./reference/task-graph.md) | Task, TaskGraph, AgentRole definitions and lifecycle states |

### System Features
| Doc | Description |
|-----|-------------|
| [Memory System](./memory/memory-system.md) | Persistent memory, vector embeddings, extraction pipeline, retrieval, and UI |
| [Provider / Model System](./provider/provider-system.md) | Provider configuration, model discovery, routing, fallback behavior, and LLM integration |
| [Tool Runtime](./tools/tool-runtime.md) | ToolRegistry, all 15+ tools, safety/risk classification, permissions, and verification |
| [Checkpoints & Rollback](./checkpoints/checkpoints.md) | Snapshot creation, file recovery, metadata storage, and rollback flow |
| [Context Engine](./context/context-engine.md) | Repo intelligence gathering, file ranking, chunking, and symbol extraction |

### User Interface
| Doc | Description |
|-----|-------------|
| [Pages & Screens](./ui/pages.md) | Complete page map (all 10 views), what each does, navigation, and keyboard shortcuts |
| [Components](./ui/components.md) | Sidebar, TopBar, Composer, DiffViewer, CommandPalette, WorkspaceSwitcher |
| [Hooks](./ui/hooks.md) | useAgent, useSessions — event wiring and state management |

### Operations
| Doc | Description |
|-----|-------------|
| [Background Jobs](./operations/background-jobs.md) | Long-running process detection, launching, tracking, logs, and health checks |
| [Packaging & Build](./build/packaging.md) | Development workflow, building, packaging Windows .exe, environment variables |
| [Configuration](./configuration/config.md) | 4-layer config resolution, environment variables, cluster.config.json, ~/.cluster/config.json |

### Development
| Doc | Description |
|-----|-------------|
| [Developer Guide](./guide/developer-guide.md) | How to add a new page, agent, tool, provider, memory category, extend IPC |
| [Troubleshooting](./troubleshooting/troubleshooting.md) | Startup issues, build problems, provider errors, session recovery, memory issues |
| [Contribution Guide](./guide/contribution-guide.md) | Repo conventions, folder structure, naming, testing expectations, code style |

---

## Documentation Status

```
[██████████] Overview          — Complete
[██████████] Architecture       — Complete
[██████████] Workflow           — Complete
[██████████] Data Model         — Complete
[██████████] Memory System      — Complete
[██████████] Provider System    — Complete
[██████████] Tools              — Complete
[██████████] UI / Pages         — Complete
[██████████] Checkpoints        — Complete
[██████████] Context Engine     — Complete
[██████████] Background Jobs    — Complete
[██████████] Packaging/Build    — Complete
[██████████] Configuration      — Complete
[██████████] Developer Guide    — Complete
[██████████] Troubleshooting    — Complete
[██████████] Contribution Guide — Complete
```

All documentation reflects the actual codebase as of v0.1.0.
