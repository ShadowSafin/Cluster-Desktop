# UI Hooks

## useAgent

**Location:** `apps/electron/src/renderer/hooks/useAgent.ts`

The central hook that wires all agent IPC events to React state. Called with an optional `sessionId`.

### State Shape

```typescript
interface UseAgentState {
  // Core display state
  entries: TimelineEntry[];       // Full message/tool timeline
  agentState: AgentState;         // { phase, label, iteration, maxIterations }
  running: boolean;               // True while agent is active
  plan: any | null;               // LLM-generated Plan object
  taskGraph: TaskGraph | null;    // Multi-agent task DAG
  edits: Edit[];                  // File edits with diffs
  streamingText: string;          // Live token stream (reset per message)
  liveOutput: Record<string, string>;  // callId → accumulated stdout
  activity: string[];             // Timestamped log lines (max 200)
  jobs: BackgroundJob[];          // Background command jobs
  pendingConfirm: any | null;     // Confirmation request awaiting response
  recalledMemories: any[];        // Memories retrieved for current task
}
```

### Event Wire Map

| IPC Event | State Updated | Behavior |
|-----------|--------------|----------|
| `agent:message` | `entries`, `streamingText` (reset) | Adds message card; skips empty assistant messages |
| `agent:delta` | `streamingText` | Appends character to streaming buffer |
| `agent:tool:start` | `entries`, `agentState.phase`, `running` | Inserts tool card, sets phase='running' |
| `agent:tool:end` | `entries` (update), `edits` (if diff), `liveOutput` (clear) | Finalizes tool card; extracts diff for edits tab |
| `agent:tool:output` | `liveOutput`, `activity` | Streams command stdout chunk |
| `agent:progress` | `activity` | Adds log line; parses `[role] message` format |
| `agent:state` | `agentState`, `running` | Updates phase/label/iteration |
| `agent:plan` | `plan`, `taskGraph` | Derives task graph from plan steps |
| `agent:graph` | `taskGraph` | Direct graph update (multi-agent mode) |
| `agent:edit` | `edits` | Adds new edit to diff list |
| `agent:job` | `jobs` | Adds/updates background job |
| `agent:error` | `agentState.phase`, `entries` | Sets phase='error', appends error message |
| `agent:confirm` | `pendingConfirm` | Shows confirmation modal |
| `agent:done` | `running`, `agentState.phase`, `taskGraph` | Sets phase to 'done'/'cancelled', marks tasks complete |
| `agent:memory:recalled` | `recalledMemories`, `activity` | Shows recalled memory count |

### Lifecycle

```typescript
// On sessionId change (or null):
useEffect(() => {
  if (!sessionId) {
    // Reset all state
    return;
  }
  // 1. Load existing session data (messages, state, plan, edits, jobs)
  window.cluster.sessions.get(sessionId).then(sess => { ... })
  // 2. Load background jobs
  window.cluster.jobs.list(sessionId).then(setJobs)
  // 3. Subscribe to all agent events
  const unsubs = [
    window.cluster.agent.onMessage(...),
    window.cluster.agent.onDelta(...),
    // ... all 14 event listeners
  ]
  return () => unsubs.forEach(fn => fn())
}, [sessionId])
```

### Actions

```typescript
{
  submit(text: string): Promise<void>   // Send message to agent
  cancel(): Promise<void>               // Abort current execution
  confirm(approved: boolean): void      // Respond to confirmation request
  clear(): void                         // Clear chat view (doesn't delete persisted data)
}
```

### Demo Mode Handling

When no API key is configured, the main process runs in "demo mode" — it still uses real tools (read_file, write_file, run_command) but plans heuristically. The hook handles this identically; the only difference is the content of messages.

---

## useSessions

**Location:** `apps/electron/src/renderer/hooks/useSessions.ts`

Manages the session list for the current workspace.

### State Shape

```typescript
interface UseSessionsState {
  sessions: SessionSummary[];   // Sorted by updatedAt desc, limited to 50
  loading: boolean;
}
```

### Methods

```typescript
{
  refresh(): Promise<void>       // Re-fetch session list
  create(title?: string): Promise<Session | null>
  remove(id: string): Promise<void>
}
```

### Auto-refresh

The hook re-fetches on mount and whenever `projectRoot` changes. It does NOT auto-poll — session list updates come from the `sessions:updated` IPC event fired by the main process after mutations.

### Integration with App.tsx

```typescript
const { sessions, refresh, create: createSession, remove: deleteSession } = useSessions(
  isElectron ? projectRoot || undefined : undefined
);

// Auto-select first session
useEffect(() => {
  if (sessions.length > 0 && !activeSessionId) {
    setActiveSessionId(sessions[0].id);
  }
}, [sessions, activeSessionId]);
```

---

## IPC API Surface (`IpcApi`)

**Location:** `apps/electron/src/preload/index.ts`

All exposed methods via `window.cluster`:

### sessions
```typescript
list(filter?: { projectRoot?, limit?, all? }): Promise<SessionSummary[]>
get(id: string): Promise<Session | null>
create(opts: { projectRoot, model?, title? }): Promise<Session>
delete(id: string): Promise<boolean>
rename(id: string, title: string): Promise<Session>
onUpdated(cb: (data) => void): () => void  // Cleanup function
```

### workspace
```typescript
info(root: string): Promise<WorkspaceInfo | null>
detect(cwd?: string): Promise<{ root: string }>
git(root: string): Promise<GitState | null>
```

### storage
```typescript
paths(): Promise<StoragePaths>
```

### config
```typescript
get(projectRoot?: string): Promise<AgentConfig & { apiKey: string; _hasKey: boolean }>
set(key: string, value: any, projectRoot?: string): Promise<any>
```

### checkpoints
```typescript
list(sessionId: string): Promise<Checkpoint[]>
create(opts: { sessionId, projectRoot, message? }): Promise<Checkpoint>
rollback(opts: { sessionId, checkpointId, projectRoot }): Promise<{ restored, errors }>
```

### agent
```typescript
send(payload: { sessionId, text, mode? }): Promise<{ ok: boolean }>
cancel(sessionId: string): Promise<{ cancelled: boolean }>
confirm(sessionId, requestId, approved: boolean): void
onMessage(cb): () => void
onDelta(cb): () => void
onToolStart(cb): () => void
onToolEnd(cb): () => void
onToolOutput(cb): () => void
onProgress(cb): () => void
onState(cb): () => void
onPlan(cb): () => void
onGraph(cb): () => void
onEdit(cb): () => void
onJob(cb): () => void
onError(cb): () => void
onConfirm(cb): () => void
onDone(cb): () => void
onMemoryRecalled(cb): () => void
```

### tools
```typescript
execute(opts: { sessionId, tool, input, projectRoot? }): Promise<ToolExecutionOutcome>
runCommand(opts: { sessionId, command, cwd?, background? }): Promise<{ jobId: string }>
```

### jobs
```typescript
list(sessionId?: string): Promise<BackgroundJob[]>
start(opts: { command, cwd?, sessionId? }): Promise<{ id, started }>
stop(id: string): Promise<boolean>
restart(id: string): Promise<any>
```

### models
```typescript
list(opts?: { baseUrl?, apiKey?, projectRoot? }): Promise<{ ok, models, error? }>
test(opts: { baseUrl?, apiKey?, model? }): Promise<{ ok, latencyMs, reply?, error? }>
```

### verification
```typescript
run(opts: { sessionId, projectRoot }): Promise<VerificationResult>
```

### memory
```typescript
list(opts?): Promise<MemoryEntry[]>
search(opts): Promise<MemoryEntry[]>
add(opts): Promise<MemoryEntry | null>
update(opts): Promise<MemoryEntry | null>
pin(opts): Promise<boolean>
archive(opts): Promise<boolean>
delete(opts): Promise<boolean>
clearProject(opts): Promise<number>
stats(opts): Promise<MemoryStats>
getRetrievedForTask(opts): Promise<MemoryRetrievalLog[]>
```

### diagnostics
```typescript
get(projectRoot?: string): Promise<DiagnosticsReport>
```

### shell / dialog / app
```typescript
shell.openPath(p: string): Promise<string>           // Opens file/folder in OS handler
dialog.openDirectory(): Promise<string | null>        // Native folder picker
app.info(): Promise<{ version, platform, arch, isPackaged }>
```
