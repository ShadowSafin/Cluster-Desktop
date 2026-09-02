# Data Flow — How Data Moves Through Cluster

## The Event Bus Pattern

Cluster's central nervous system is the `Emitter<T>` class from `@cluster/shared`. It is a typed event bus that connects every subsystem:

```typescript
// In agent-core/src/events.ts
export interface AgentEvents {
  'message': { sessionId: string; message: Message };
  'delta': { sessionId: string; text: string };
  'tool:start': { sessionId: string; call: ToolCall };
  'tool:end': { sessionId: string; call: ToolCall };
  'tool:output': { sessionId: string; callId: string; chunk: string };
  'progress': { sessionId: string; message: string };
  'plan': { sessionId: string; plan: Plan };
  'state': { sessionId: string; state: AgentState };
  'error': { sessionId: string; error: AgentError };
  'done': { sessionId: string; summary: string; usage: ChatUsage; cancelled: boolean; iterations: number };
  'memory:recalled': { sessionId: string; memories: MemoryEntry[] };
}
```

The `Emitter` constructor receives an error handler callback. All emissions are fire-and-forget — the emitter never blocks the caller.

## Layer-by-Layer Flow

### 1. User Input → Renderer

```
User types in Composer
    │
    ▼
useAgent.submit(text)
    │
    ├─ Optimistically adds user message to entries state
    ├─ Sets running=true, phase='planning'
    └─ Calls window.cluster.agent.send({ sessionId, text, mode })
```

### 2. Renderer → Main (IPC)

```
ipcRenderer.invoke('agent:send', payload)
    │
    ▼
Main process: ipcMain.handle('agent:send', ...)
    │
    ├─ Gets SessionStore
    ├─ Loads workspace info + config
    ├─ Sets up Emitter with forwarding lambdas
    └─ Branches to demo mode or real LLM path
```

### 3. Main → Agent Loop

```
AgentLoop.run(userText, signal)
    │
    ├─ [If memory enabled] Extract durable knowledge from prompt
    ├─ [If memory enabled] Recall contextual memories → inject into system prompt
    ├─ emit('state', { phase:'planning' })
    ├─ createPlan(userText) → emit('plan', plan)
    │
    └─ For each iteration (1..maxIterations):
        │
        ├─ emit('state', { phase:'thinking' })
        ├─ provider.chat(messages, tools) → SSE stream
        │   │
        │   ├─ onDelta(text) → emit('delta', text) ──► streaming text in UI
        │   │
        │   └─ Returns { content, toolCalls, usage }
        │
        ├─ If toolCalls.length === 0:
        │   └─ Set summary, break loop
        │
        └─ runToolCalls(toolCalls, messageId, signal)
            │
            └─ For each tool call:
                ├─ emit('tool:start', record)
                ├─ registry.execute(name, input, ctx)
                │   │
                │   ├─ Zod validate input
                │   ├─ Evaluate risk (safe/caution/destructive)
                │   ├─ Check confirmation policy
                │   └─ Call tool.execute(input, ctx)
                │       │
                │       ├─ read_file → fs.readFile()
                │       ├─ write_file → fs.writeFile() (+ backup)
                │       ├─ patch_file → find/replace + diff
                │       ├─ run_command → child_process.spawn() (+ live stream)
                │       ├─ git_status → exec('git status')
                │       └─ ... (all 15 tools)
                │
                ├─ emit('tool:end', record)
                ├─ emit('message', tool-result)  // feed output back to model
                └─ Update plan step status
```

### 4. Agent → Session Store (Persistence)

```
During agent execution, every state change is persisted:

  events.on('message')    → store.appendMessage(sessionId, message)
  events.on('tool:start') → store.appendToolCall(sessionId, call)
  events.on('tool:end')   → store.updateToolCall(sessionId, call)
                          → if write/patch: store.appendEdit(sessionId, edit)
                          → if run_command: store.appendCommandRun(sessionId, run)
  events.on('plan')       → store.setPlan(sessionId, plan)
  events.on('state')      → store.updateState(sessionId, patch)
  events.on('error')      → store.appendError(sessionId, event)
  events.on('done')       → store.updateState(done) + store.flush()
```

**Write strategy**: `SessionStore.markDirty()` sets a 150ms debounce timer. `flush()` forces an immediate write. Final flush happens on session completion.

### 5. Agent → Renderer (Events)

```
Main process forwards every event to the renderer via IPC send:

  events.emit('message')  → wc.send('agent:message', { sessionId, message })
  events.emit('delta')    → wc.send('agent:delta', { sessionId, text })
  events.emit('tool:start') → wc.send('agent:tool:start', { sessionId, call })
  events.emit('tool:end')   → wc.send('agent:tool:end', { sessionId, call })
  events.emit('tool:output')→ wc.send('agent:tool:output', { sessionId, callId, chunk })
  events.emit('progress')   → wc.send('agent:progress', { sessionId, message })
  events.emit('plan')       → wc.send('agent:plan', { sessionId, plan })
  events.emit('state')      → wc.send('agent:state', { sessionId, state })
  events.emit('error')      → wc.send('agent:error', { sessionId, error })
  events.emit('done')       → wc.send('agent:done', { sessionId, ... })
  events.emit('memory:recalled') → wc.send('agent:memory:recalled', ...)
```

### 6. Renderer → React State (Hooks)

```
useAgent hook subscribes to all agent events:

  onMessage  → setEntries (append message card)
  onDelta    → setStreamingText (append character)
  onToolStart→ setEntries (append tool card), setAgentState(phase='running')
  onToolEnd  → update tool card in entries, setEdits if diff present
  onToolOutput→ setLiveOutput (stream stdout chunk)
  onProgress → pushActivity (log line)
  onState    → setAgentState (phase/label/iteration)
  onPlan     → setPlan + derive TaskGraph
  onError    → setAgentState(phase='error'), append error message
  onDone     → setRunning(false), setAgentState(phase='done')
```

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER INPUT                                   │
│                         "Add auth middleware"                          │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        RENDERER (React)                              │
│                                                                      │
│  Composer ──submit──► useAgent.submit()                             │
│       │                                                    ┌─────────┴─────────┐
│       │                                                    │  Optimistic UI   │
│       │                                                    │  - add msg card  │
│       │                                                    │  - show spinner  │
│       │                                                    └─────────┬─────────┘
│       │                                                          │
│       │                                              window.cluster.agent.send()
│       │                                                          │
│       │                                                          ▼
│       │                                            ┌───────────────────────┐
│       │                                            │   IPC: agent:send     │
│       │                                            └───────────┬───────────┘
│       │                                                        │
└───────┼────────────────────────────────────────────────────────┼──────────────────┐
        │                                                        │                  │
        │                                                        ▼                  │
        │                                       ┌────────────────────────┐          │
        │                                       │    MAIN PROCESS        │          │
        │                                       │                        │          │
        │                                       │  getStore()            │          │
        │                                       │  loadWorkspaceInfo()   │          │
        │                                       │  loadConfig()          │          │
        │                                       │                        │          │
        │                                       │  ┌─────────────────┐   │          │
        │                                       │  │  AgentLoop      │   │          │
        │                                       │  │  OR             │   │          │
        │                                       │  │  Coordinator    │   │          │
        │                                       │  └────────┬────────┘   │          │
        │                                       │           │            │          │
        │                                       │    ┌──────┴──────┐     │          │
        │                                       │    │ ModelProvider│     │          │
        │                                       │    │ (LLM API)    │     │          │
        │                                       │    └──────────────┘     │          │
        │                                       │           │            │          │
        │                                       │    ┌──────┴──────┐     │          │
        │                                       │    │ToolRegistry │     │          │
        │                                       │    │ (15+ tools) │     │          │
        │                                       │    └──────────────┘     │          │
        │                                       │           │            │          │
        │                                       │    ┌──────┴──────┐     │          │
        │                                       │    │  SessionStore│     │          │
        │                                       │    │  (lowdb JSON)│     │          │
        │                                       │    └──────────────┘     │          │
        │                                       └───────────┬────────────┘          │
        │                                                   │                      │
        │                                       ┌───────────┴──────────┐            │
        │                                       │  IPC: agent:* events  │            │
        │                                       │  (14 event channels)  │            │
        │                                       └───────────┬──────────┘            │
        │                                                   │                      │
        ▼                                                   ▼                      │
┌────────────────────────────────────────────────────────────────────────────────┐
│                         RENDERER STATE (React Hooks)                             │
│                                                                                │
│  useAgent hooks listen to all agent:* events                                  │
│                                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  entries     │  │  agentState  │  │   edits      │  │   liveOutput     │   │
│  │  (message    │  │  (phase,     │  │  (diffs      │  │  (command       │   │
│  │   cards)     │  │   label,     │  │   objects)   │  │   streaming)     │   │
│  │              │  │   iteration) │  │              │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                                                │
│  Pages render from this state:                                                 │
│  • WorkspacePage  → entries, agentState, streamingText, plan, edits            │
│  • TasksPage      → taskGraph, plan, liveOutput                                 │
│  • DiffPage       → edits                                                      │
│  • LogsPage       → activity, liveOutput, jobs                                  │
│  • BackgroundPage → jobs                                                       │
│  • CheckpointsPage→ (loaded on demand)                                         │
│  • MemoryPage     → (loaded on demand)                                         │
│  • ProviderPage   → (loaded on demand)                                         │
│  • SettingsPage   → (loaded on demand)                                         │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Patterns

| Pattern | Where Used | Why |
|---------|------------|-----|
| **Event-driven state** | All agent execution | Decouples execution from UI; enables replay |
| **Debounced persistence** | SessionStore | Avoids 100s of disk writes per session turn |
| **AbortController** | AgentLoop, TaskEngine, tools | Clean cancellation at every level |
| **Optimistic UI** | useAgent.submit() | Instant feedback before server confirms |
| **Dual storage backend** | MemoryDatabase | SQLite for performance, JSON dump for portability |
| **Layered config** | AgentCore.config | Flexibility: defaults → env → global → project |
| **Risk classification** | ToolRegistry.execute() | Safety gate before every tool call |
| **Context isolation** | Electron preload | Renderer has zero direct filesystem/API access |
