# Multi-Agent Orchestration

## Overview

When a user prefixes their message with `/multi `, Cluster switches from single-agent `AgentLoop` to the multi-agent `Coordinator`. The Coordinator decomposes complex requests into a DAG of tasks, assigns each to a specialist agent, and executes them in dependency order with parallelism.

## Coordinator Architecture

```
                    ┌─────────────────┐
                    │   Coordinator   │
                    │                 │
                    │  - Planner      │◄── TaskGraph
                    │  - Coder        │
                    │  - Reviewer     │
                    │  - Tester       │
                    │  - Context      │
                    │  - File locks   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ TaskEngine│  │  Agents  │  │ToolRegistry│
        │ (batch    │  │ (role    │  │ (filtered  │
        │  executor)│  │  filtered)│  │  per role)│
        └──────────┘  └──────────┘  └──────────┘
```

### Key Classes

| Class | Location | Purpose |
|-------|----------|---------|
| `Coordinator` | `agent-core/src/coordinator.ts` | Orchestrates the full multi-agent pipeline |
| `PlannerAgent` | `agent-core/src/agents/plannerAgent.ts` | Creates task graph from goal + repo intelligence |
| `ContextAgent` | `agent-core/src/agents/contextAgent.ts` | Gathers file groups and repo structure |
| `CoderAgent` | `agent-core/src/agents/coderAgent.ts` | Implements changes via read/write tools |
| `ReviewerAgent` | `agent-core/src/agents/reviewerAgent.ts` | Inspects changes for issues |
| `TesterAgent` | `agent-core/src/agents/testerAgent.ts` | Runs tests and verification |
| `TaskEngine` | `task-engine/src/engine.ts` | Executes DAG in parallel batches |
| `TaskGraphStore` | `task-engine/src/graph.ts` | DAG data structure + topological sort |

## Phase 1: Plan Creation

```typescript
const graph = await coordinator.createPlan(goal)
```

Steps:
1. **Gather intelligence** via `ContextEngine.gatherIntelligence()`
   - Detects project kind, languages, package manager
   - Groups files by area (src/, tests/, config/, etc.)
   - Captures recent git changes
2. **Create graph** via `PlannerAgent.createGraph(goal, fileGroups)`
   - Heuristic rules: detect if goal needs coding, testing, reviewing
   - Creates parent tasks and subtasks with explicit dependencies
   - Assigns `agentRole` to each task
   - Returns a `TaskGraph` (DAG with `tasks: Record<id, Task>`)
3. **Emit plan event** to renderer for visualization

### Example Graph for "Add auth middleware with rate limiting"

```
[context] Gather project structure          (root)
    │
    ▼
[planner] Break down into subtasks          (depends on context)
    │
    ├─────────────────────┬──────────────────┐
    ▼                     ▼                  ▼
[coder] Add auth file    [coder] Add rate    [reviewer] Review changes
                         limiting config        (parallel with coders)
    │                     │
    └────────┬────────────┘
             ▼
      [tester] Run tests + verify    (depends on both coders + reviewer)
```

## Phase 2: Graph Execution

```typescript
const { results } = await coordinator.runGraph(graph, signal)
```

### TaskEngine Execution Model

```typescript
const engine = new TaskEngine(graph, { maxConcurrency: 4 })
```

The engine processes tasks in **dependency-order batches**:

```
Batch 1: [context gathering]        — no dependencies, runs immediately
Batch 2: [planning]                 — depends on batch 1
Batch 3: [coder A, coder B, reviewer] — all independent, run IN PARALLEL
Batch 4: [testing]                  — depends on batch 3
```

Within each batch, up to `maxConcurrency` (default: 4) tasks run simultaneously via worker pool.

### Executor Registration

The Coordinator registers a custom executor:

```typescript
engine.registerExecutor(async (task, taskSignal) => {
  const role = task.agentRole ?? 'coder'
  const agent = agents.get(role) ?? coderAgent

  // File lock check
  const conflicting = task.files.filter(f => fileLocks.has(f))
  if (conflicting.length) await delay(300, taskSignal)  // Simple wait

  // Acquire locks
  for (const f of task.files) fileLocks.add(f)

  // Checkpoint before coder edits
  if (role === 'coder') {
    await registry.execute('checkpoint_create', { message: `Before ${task.title}` }, ctx)
  }

  // Run agent
  const output = await agent.run(task, ctx)

  // Release locks
  for (const f of task.files) fileLocks.delete(f)

  return { success: output.success, result: output.summary }
})
```

### Task Lifecycle Events

```
task:created     → Task added to graph
task:started     → Worker picked up the task
task:completed   → Executor returned success
task:failed      → Executor threw or returned failure (may retry)
task:cancelled   → Signal aborted or explicit cancel
task:paused      → Pause requested
task:resumed     → Resume after pause
task:retry       → Retry attempt (exponential backoff: 1s, 2s, 4s...)
graph:started    → Execution begins
graph:completed  → All tasks done
graph:failed     → One or more tasks failed
graph:cancelled  → Overall cancellation
```

## Agent Role Definitions

Defined in `packages/shared/src/agents.ts`:

| Role | Name | Tools Allowed | Parallel? | Max Concurrency |
|------|------|---------------|-----------|-----------------|
| `planner` | Planner | workspace_info, list_files, read_file, search_text, git_status | No | 1 |
| `context` | Context | Same as planner + denied: write_file, patch_file, run_command | Yes | 2 |
| `coder` | Coder | read_file, list_files, search_text, **write_file, patch_file**, git_status, workspace_info | Yes | 3 |
| `reviewer` | Reviewer | read_file, list_files, search_text, git_status | Yes | 2 |
| `tester` | Tester | **run_command**, read_file, list_files, workspace_info | Yes | 2 |
| `coordinator` | Coordinator | All tools | No | 1 |

### Tool Permission Matrix

```
                    workspace  list  read  search  write  patch  run  git  verify
planner              ✓         ✓     ✓     ✓       ✗      ✗      ✗    ✓    ✗
context              ✓         ✓     ✓     ✓       ✗      ✗      ✗    ✓    ✗
coder                ✓         ✓     ✓     ✓       ✓      ✓      ✗    ✓    ✗
reviewer             ✓         ✓     ✓     ✓       ✗      ✗      ✗    ✓    ✗
tester               ✓         ✓     ✓     ✓       ✗      ✗      ✓    ✗    ✓
coordinator          ✓         ✓     ✓     ✓       ✓      ✓      ✓    ✓    ✓
```

## File Locking

To prevent two parallel coder agents from editing the same file simultaneously, the Coordinator uses a `Set<string>` of locked paths:

```typescript
private fileLocks = new Set<string>()

// Before executing a task:
const conflicting = files.filter(f => this.fileLocks.has(f))
if (conflicting.length) await this.delay(300, signal)  // Brief wait

// Acquire
for (const f of files) this.fileLocks.add(f)

// Finally: release
for (const f of files) this.fileLocks.delete(f)
```

> **Note**: This is a simple busy-wait approach. A proper implementation would use a queue with promise-based locking.

## Checkpoint Before Edits

Every time a `coder` agent is about to execute, a checkpoint is created automatically (best-effort — failures are silently caught):

```typescript
if (role === 'coder') {
  await registry.execute('checkpoint_create', { message: `Before ${task.title}` }, ctx)
}
```

This ensures the user can roll back to a known-good state if the multi-agent run goes wrong.

## Result Aggregation

After all tasks complete:

```typescript
const results = new Map<string, { success: boolean; summary: string }>()

// executor sets results.set(task.id, { success, summary })
// After runAll completes:
const doneCount = Object.values(tasks).filter(t => t.status === 'done').length
const failedCount = Object.values(tasks).filter(t => t.status === 'failed').length

const summaryMsg = {
  content: `### Execution Summary\n\n${summaryText}\n\n${doneCount} done, ${failedCount} failed out of ${total}`,
  kind: 'summary'
}
store.appendMessage(sessionId, summaryMsg)
emit('agent:message', { message: summaryMsg })
```

## Pausing and Resuming

The TaskEngine supports fine-grained control:

```typescript
engine.pause()         // Pause all tasks
engine.pause(taskId)   // Pause one task
engine.resume()        // Resume all
engine.resume(taskId)  // Resume one task
engine.cancel()        // Cancel everything
engine.retry(taskId)   // Reset one failed task to ready
```

Event emissions allow the UI to update status badges in real-time.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Task executor throws | Catch → mark as `failed` → continue with other tasks |
| Task returns `{success: false}` | Increment retry counter; retry up to `maxAttempts` (default 2) |
| All retries exhausted | Mark as `failed`; don't crash the graph |
| Graph has any failures at end | Set graph status to `failed`; emit `graph:failed` |
| Signal aborted during execution | All running tasks cancelled; graph marked `cancelled` |
| No executor registered for task | Task immediately marked `failed` with "No executor" |

---

<div class="see-also">
<strong>Next:</strong> Read <a href="../reference/data-model.md">Core Data Models</a> to understand the exact shape of Session, Message, and ToolCall types that flow through this orchestration.
</div>
