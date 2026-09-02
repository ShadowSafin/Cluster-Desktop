# Background Jobs

## Overview

Background jobs let you run arbitrary shell commands from within Cluster and monitor them in real-time. Unlike the agent's `run_command` tool (which is tied to a session turn), background jobs are independent and persist until stopped or the app restarts.

## How Jobs Are Created

### Via UI (Background page)

User types a command and clicks "Start":

```
Input: "npm run dev"
cwd: (defaults to project root)
session: (optional, for association)
```

### Via IPC

```typescript
ipcMain.handle('jobs:start', async (_e, opts) => {
  const id = createId('job')
  const job = { id, command, cwd, status: 'running', output: '', startedAt: now() }
  jobRegistry.set(id, job)

  // Spawn via tool-runtime run_command
  registry.execute('run_command', { command, cwd }, ctx)
    .then(res => { job.status = res.ok ? 'done' : 'failed'; emit job update })
    .catch(err => { job.status = 'failed'; emit error })

  return { id, started: true }
})
```

## Job Lifecycle

```
start
  │
  ▼
running ◄────────────────────────────────┐
  │                                     │ stop requested
  │  ┌──────┐  ┌──────┐  ┌──────┐      │
  │  │chunk │  │chunk │  │chunk │      │
  │  └──────┘  └──────┘  └──────┘      │
  │                                     │
  ├──► done (exitCode 0) ────────────────┤
  │                                     │
  ├──► failed (exitCode ≠ 0) ────────────┤
  │                                     │
  └──► stopped (abort signal) ───────────┤
                                        │
                   ┌──── restart ────────┘
                   ▼
              (new job created with same command)
```

## Job Tracking

Jobs are stored in an in-memory `Map<string, JobRecord>`:

```typescript
const jobRegistry = new Map<string, {
  id: string;
  command: string;
  cwd: string;
  status: 'running' | 'done' | 'failed' | 'stopped';
  pid?: number;           // Simulated (random 4-5 digit number)
  port?: number;          // Auto-detected from output
  output: string;         // Accumulated stdout + stderr
  startedAt: string;
  durationMs?: number;
  controller?: AbortController;
}>();
```

### Port Detection

The job tracker scans output for common server startup patterns:

```typescript
const portMatch = chunk.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|port|Port)[:\s]+(\d{2,5})/i)
if (portMatch && !job.port) {
  job.port = parseInt(portMatch[1], 10)
}
```

This means a dev server outputting `Local: http://localhost:3000` will automatically populate the port field.

## Job Operations

| Operation | IPC Channel | Description |
|-----------|-------------|-------------|
| List | `jobs:list` | Returns all jobs (optionally filtered by sessionId) |
| Start | `jobs:start` | Creates and launches a new job |
| Stop | `jobs:stop` | Aborts the job's AbortController, marks as 'stopped' |
| Restart | `jobs:restart` | Creates a new job with the same command and cwd |

### Stop Implementation

```typescript
ipcMain.handle('jobs:stop', async (_e, id) => {
  const job = jobRegistry.get(id)
  if (!job) return false
  job.controller?.abort()
  job.status = 'stopped'
  return true
})
```

Note: `AbortController.abort()` signals the underlying `run_command` tool to stop, but the actual OS process may continue running until it receives SIGTERM. There is no explicit `process.kill()` call — this is a known limitation.

### Restart Implementation

Restart creates a **new** job ID but reuses the same command and cwd:

```typescript
ipcMain.handle('jobs:restart', async (_e, id) => {
  const oldJob = jobRegistry.get(id)
  if (!oldJob) return null
  oldJob.controller?.abort()  // Stop the old one

  const newId = createId('job')
  const newJob = { ...oldJob, id: newId, status: 'running', output: '', controller: new AbortController() }
  jobRegistry.set(newId, newJob)
  jobRegistry.delete(id)

  // Re-spawn with same parameters
  // ... (same logic as jobs:start)
})
```

## Job Events to Renderer

```typescript
// While running:
event.sender.send('agent:tool:output', { sessionId, callId: jobId, chunk })
event.sender.send('agent:job', { sessionId, job: { ...job, controller: undefined } })

// On completion:
event.sender.send('agent:job', { sessionId, job: { ...job, controller: undefined } })
```

The `controller` is stripped before sending to avoid serializing AbortController objects.

## Relationship to Agent Commands

Background jobs and agent `run_command` calls share the same underlying tool (`run_command` from tool-runtime). The difference is:

| Aspect | Agent Command | Background Job |
|--------|--------------|----------------|
| Lifecycle | Tied to agent turn | Independent |
| Cancellation | Via agent cancel (AbortController) | Via jobs:stop |
| Persistence | Lost on session delete | Lost on app restart only |
| Output streaming | Via `tool:output` event | Via `tool:output` event |
| UI location | LogsPage + inline | BackgroundPage |

## Limitations

| Limitation | Details |
|-----------|---------|
| In-memory only | Jobs are not persisted to disk; restarting the app loses all jobs |
| No true process kill | Uses AbortController signal; the child process may outlive the job record |
| PID is simulated | Random 4-5 digit number, not the real OS PID |
| No stdin support | Commands cannot receive interactive input |
| Single output stream | stdout and stderr are merged into one `output` string |

---

<div class="see-also">
<strong>Next:</strong> Read <a href="../build/packaging.md">Packaging & Build</a> to learn how to package Cluster into a Windows installer.
</div>
