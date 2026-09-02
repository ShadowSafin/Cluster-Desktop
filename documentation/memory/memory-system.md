# Memory System

## Overview

Cluster's memory system gives the assistant **durable, project-aware knowledge** that persists across sessions. It extracts useful information from conversations automatically and surfaces it during future tasks via semantic search.

### What Memory Stores

| Category | Example | Source |
|----------|---------|--------|
| `project` | "Building a Next.js SaaS with Stripe integration" | Prompt extraction |
| `ui_style` | "Always use dark theme with Tailwind glassmorphism" | Prompt extraction |
| `user_preference` | "Never use Redux, prefer Zustand" | Prompt extraction / corrections |
| `provider_model` | "Use agnes-2.5-flash as default model" | Prompt extraction |
| `architecture` | "State management via React Query + TanStack Router" | Prompt extraction / plan strategy |
| `workflow` | "Test-driven development: write tests first" | Prompt extraction |
| `task` | "Task #abc: Implemented auth middleware (Success)" | Post-task extraction |
| `bug` | "Fixed: Redis TTL bug causing session expiry too early" | Post-task extraction |
| `file` | "src/config.ts is core to project architecture" | Post-task extraction |
| `command` | "npm run typecheck passes — verified working command" | Post-task extraction |
| `convention` | "All API routes go in src/routes/ prefixed with /api/" | User-created |
| `note` | General notes and facts | User-created |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MEMORY SYSTEM                                │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │  Extraction     │    │  Storage Layer  │    │   Retrieval    │  │
│  │                 │    │                 │    │                │  │
│  │ • From prompt   │───►│ • SQLite (+     │───►│ • Vector sim   │  │
│  │   (regex)       │    │   sqlite-vec)   │    │ • Hybrid score │  │
│  │ • From workflow │    │ • JSON fallback │    │ • Context boost│  │
│  │   (outcomes)    │    │ • In-memory     │    │ • Audit log    │  │
│  │ • From user     │    │   cache         │    │                │  │
│  │   (manual add)  │    │                 │    │                │  │
│  └─────────────────┘    └────────┬────────┘    └────────┬───────┘  │
│                                 │                       │           │
│                                 ▼                       ▼           │
│                      ┌─────────────────────┐  ┌──────────────────┐  │
│                      │  MemoryStore        │  │  formatForPrompt │  │
│                      │  (public API)       │  │  (prompt block)  │  │
│                      └─────────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Persistence Layer

### Database Backend (Dual Mode)

The `MemoryDatabase` class supports two backends:

| Backend | When Used | How |
|---------|-----------|-----|
| **Native SQLite + sqlite-vec** | Node.js 22+ with native `node:sqlite` module available | Real vector search via `sqlite-vec` extension |
| **In-memory Map + JSON dump** | Electron renderer, older Node, or when native SQLite unavailable | Cosine similarity computed in JavaScript |

### SQLite Schema

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  scope TEXT NOT NULL,
  project_root TEXT,
  session_id TEXT,
  source TEXT NOT NULL,
  importance REAL DEFAULT 0.5,
  confidence REAL DEFAULT 0.8,
  pinned INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  hits INTEGER DEFAULT 0,
  relevance REAL DEFAULT 0.5,
  tags JSON,
  metadata JSON,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_accessed_at TEXT
);

CREATE INDEX idx_mem_proj ON memories(project_root);
CREATE INDEX idx_mem_cat ON memories(category);
CREATE INDEX idx_mem_pinned ON memories(pinned);
CREATE INDEX idx_mem_archived ON memories(archived);

-- Vector index (only if sqlite-vec loads)
CREATE VIRTUAL TABLE vec_memories USING vec0(
  memory_id TEXT PRIMARY KEY,
  embedding float[1536]  -- OpenAI-compatible dimension
);
```

### JSON Fallback Format

When not using native SQLite, data is stored as `~/.cluster/cluster_memory.db.json`:

```json
{
  "version": 1,
  "updatedAt": "2026-09-03T00:00:00Z",
  "entries": [...],
  "embeddings": { "mem_xxx": [0.12, -0.34, ...] },
  "retrievalLogs": [...]
}
```

---

## Extraction Pipeline

Extraction happens at two points:

### 1. Pre-Task: `extractFromPrompt(userInput)`

Runs regex-based pattern matching on the raw user input before any LLM call. Detects:

| Pattern | Regex | Category | Importance |
|---------|-------|----------|------------|
| Project goals | `/(?:building|create|developing)\s+.../i` | `project` | 0.75 |
| UI style prefs | `/(?:always use|prefer|theme is)\s+.../i` | `ui_style` | 0.85 |
| Coding directives | `/(?:always|never|prefer)\s+.../i` | `user_preference` | 0.80 |
| Model preferences | `/(?:use model|preferred model)\s+.../i` | `provider_model` | 0.80 |
| Architecture decisions | `/(?:architecture|stack|framework)\s+is\s+.../i` | `architecture` | 0.85 |
| Workflow rules | `/(?:workflow|test first|tdd)\s+.../i` | `workflow` | 0.75 |

Noise rejection filters out greetings, short acknowledgements, and trivial confirmations (`hi`, `ok`, `sure`, etc.).

### 2. Post-Task: `extractFromWorkflow(ctx)`

Runs after task completion. Extracts from the agent's actual work:

| What | Condition | Category | Importance |
|------|-----------|----------|------------|
| Task summary | goal + summary exist | `task` | 0.60 (success) / 0.40 (failed) |
| Bug fix | errorEncountered + fixApplied | `bug` | 0.85 |
| Architecture from plan | plan.strategy exists | `architecture` | 0.80 |
| Important files | filesChanged array | `file` | 0.70 |
| Verified commands | contains npm/pnpm/yarn/cargo | `command` | 0.65 |
| User corrections | matches `instead of X use Y` | `user_preference` | **0.90** (pinned) |

### Deduplication

Before saving a new memory, the extractor checks for duplicates:

1. **Exact key match**: If `key` already exists, update value/importance/hits instead of creating new
2. **Semantic threshold**: Compute synthetic embeddings for both entries; if cosine similarity ≥ 0.88, merge into existing
3. **New entry**: Insert as fresh memory with generated embedding

---

## Retrieval Pipeline

### Contextual Retrieval

```typescript
const results = await memory.retrieveContextual({
  queryText: "Add authentication",
  projectRoot: "/path/to/project",
  sessionId: "sess_abc",
  limit: 6,
  minScore: 0.3,
})
```

### Hybrid Scoring Formula

Each candidate memory is scored with a weighted composite:

```
compositeScore = similarity × 0.5
               + importance × 0.2
               + pinned ? 0.15 : 0
               + contextBonus
```

Where `contextBonus` includes:
- **+0.12** if category matches the task category
- **+0.15** if memory's file path matches active project files
- **+0.08** for high-priority categories (`user_preference`, `ui_style`, `bug`)

Results below `minScore` (default 0.3) are filtered out.

### Prompt Formatting

Retrieved memories are formatted into a structured Markdown block injected into the system prompt:

```markdown
## Recalled Project & User Memory (Active Context)
The following durable project memories and guidelines were retrieved for this task:

### USER PREFERENCE
- [USER PREFERENCE] **Directive: No Redux**: User coding preference: "never use redux, use zustand"

### ARCHITECTURE
- [ARCHITECTURE] **Architecture: React Query TanStack Router**: Architectural specification: React Query with TanStack Router

### BUG FIX
- [BUG] **Bug Fix: Redis TTL**: Resolved: Redis TTL was set to 60s instead of 3600s causing premature logout
```

This block is appended to the system prompt before planning, ensuring the model respects past learnings.

---

## MemoryStore Public API

```typescript
class MemoryStore {
  // Initialization
  async init(): Promise<void>              // Lazy-init SQLite or JSON backend

  // CRUD
  async add(entry: MemoryAddInput): Promise<MemoryEntry>
  async recall(options?): Promise<MemoryEntry[]>
  async search(queryText: string, limit?: number): Promise<VectorSearchResult[]>
  async pin(id: string, pinned: boolean): Promise<boolean>
  async archive(id: string, archived: boolean): Promise<boolean>
  async delete(id: string): Promise<boolean>
  async clearProject(): Promise<number>     // Returns count deleted

  // Extraction
  async extractFromPrompt(prompt: string, opts?): Promise<MemoryEntry[]>
  async extractFromWorkflow(ctx: TaskOutcomeContext): Promise<MemoryEntry[]>

  // Retrieval
  async retrieveContextual(opts: ContextualRetrievalOptions): Promise<VectorSearchResult[]>
  async formatForPrompt(queryText?): Promise<string>

  // Analytics
  async getStats(): Promise<MemoryStats>
  async getRetrievalLogs(limit?: number): Promise<MemoryRetrievalLog[]>

  // Convenience helpers
  async addImportantFile(path: string, reason: string): Promise<void>
  async addConvention(pattern: string, description: string): Promise<void>
  async addArchitectureNote(note: string): Promise<void>
}
```

---

## Memory in the Agent Loop

Integration point in `AgentLoop.run()`:

```typescript
// Pre-task: extract and recall
if (deps.memory) {
  await deps.memory.extractFromPrompt(userInput, ...)
  const recalled = await deps.memory.retrieveContextual({ queryText: userInput, limit: 6 })
  events.emit('memory:recalled', { memories: recalled })
  const promptBlock = await deps.memory.formatForPrompt(userInput)
  if (promptBlock) this.systemPrompt += `\n\n${promptBlock}`
}

// Post-task: persist learnings
if (deps.memory && !cancelled) {
  await deps.memory.extractFromWorkflow({
    goal: userInput,
    summary,
    success: !error && !cancelled,
    filesChanged: Array.from(this.changedFiles),
    commandsRun: Array.from(this.executedCommands),
    errorEncountered: error || undefined,
    plan: this.currentPlan || undefined,
    userCorrection: /* regex detection */,
    projectRoot: deps.projectRoot,
    sessionId: deps.sessionId,
  })
}
```

---

## Memory UI (`MemoryPage`)

The Memory page provides:
- **Filter tabs**: All / Pinned / Archived by scope (project vs session)
- **Category chips**: Click to filter by `bug`, `architecture`, `preference`, etc.
- **Search box**: Text search across title, summary, value, tags
- **Pin/Archive toggles**: One-click management
- **Delete button**: Removes individual entries
- **Clear Project**: Wipes all memories for the current workspace
- **Manual Add**: Form to create new entries with full field control
- **Stats bar**: Total count, pinned/archived counts, breakdown by category and scope
- **Retrieval audit**: Shows which memories were recalled for recent tasks

---

## Current Limitations

| Limitation | Details |
|-----------|---------|
| **Synthetic embeddings** | Current implementation uses hash-based deterministic vectors, not real ML embeddings. Good for demo; limited accuracy for large corpora. |
| **No cross-project recall** | Memories are scoped to `projectRoot` (or global). Cross-project semantic search is not implemented. |
| **In-memory only during session** | If the app crashes mid-write, the last ~150ms of memory additions may be lost (same as session store). |
| **Single embedding dimension** | Fixed at 1536 dimensions (OpenAI-compatible). Cannot dynamically adjust. |
