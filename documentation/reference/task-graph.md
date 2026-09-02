# Task Graph Types

Detailed reference for the multi-agent task system types, defined in `packages/shared/src/tasks.ts` and extended in `packages/task-engine/src/`.

## Task

A single unit of work within a task graph.

```typescript
interface Task {
  id: string;                              // Unique ID (e.g., "task_x1y2z3")
  parentId?: string | null;                // Parent task in hierarchical view
  title: string;                           // Human-readable title
  description?: string;                    // Expanded description
  status: TaskStatus;                      // see below
  priority: TaskPriority;                  // low | normal | high | critical
  agentRole: AgentRole | null;             // Assigned role or null (unassigned)
  dependsOn: string[];                     // IDs of prerequisite tasks
  dependents?: string[];                   // IDs of downstream tasks (derived)
  retry: {
    maxAttempts: number;                   // Default: 2
    attempts: number;                      // Current attempt count
    backoffMs: number;                     // Default: 1000
  };
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  error?: string | null;                   // Error message if failed
  subtasks: string[];                      // Child task IDs
  toolCallIds: string[];                   // Tool calls produced during execution
  result?: string | null;                  // Summary result on completion
  complexity?: number;                     // 1-5 estimate for scheduling
  files?: string[];                        // Files this task touches (for locking)
}
```

## TaskStatus

```typescript
type TaskStatus =
  | 'pending'    // Created but not yet eligible for execution
  | 'blocked'    // Waiting on a dependency that hasn't completed
  | 'ready'      // Dependencies satisfied, eligible for execution
  | 'running'    // Currently being executed
  | 'paused'     // Execution suspended (manual pause)
  | 'done'       // Completed successfully
  | 'failed'     // Exhausted all retries
  | 'skipped'    // Skipped due to a dependency failure
  | 'cancelled'  // Cancelled by user or abort signal
```

## TaskPriority

```typescript
type TaskPriority = 'low' | 'normal' | 'high' | 'critical'
```

Priority affects scheduling order within a batch (higher priority tasks run first).

## AgentRole

```typescript
type AgentRole =
  | 'planner'    // Decomposes requests into task graphs
  | 'coder'      // Implements code changes
  | 'reviewer'   // Inspects code for issues
  | 'tester'     // Runs tests and verification
  | 'context'    // Gathers repository intelligence
  | 'coordinator'// Orchestrates other agents
```

## TaskGraph

```typescript
interface TaskGraph {
  id: string;                          // Graph ID
  goal: string;                        // Original user request
  createdAt: string;
  updatedAt: string;
  tasks: Record<string, Task>;         // All tasks indexed by ID
  rootIds: string[];                   // Tasks with no dependencies
  status: 'pending' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled';
}
```

## TaskGraphStore

The immutable-ish store behind `TaskGraph`. Key methods:

```typescript
class TaskGraphStore {
  readonly graph: TaskGraph;

  // Factory
  static create(goal: string): TaskGraphStore;

  // Mutations
  addTask(init: { title, description?, agentRole?, dependsOn?, parentId?, priority?, complexity? }): Task;
  updateTask(id: string, patch: Partial<Task>): Task | undefined;
  setStatus(id: string, status: TaskStatus, error?: string): void;

  // Queries
  getTask(id: string): Task | undefined;
  topologicalOrder(): { ok: boolean; order: string[]; error?: string };

  // Execution planning
  executionBatches(): string[][];  // Array of batches, each batch is a list of task IDs
  parallelGroups(): string[][];    // Same as executionBatches (alias)
}
```

### Topological Sort

`topologicalOrder()` performs a Kahn's algorithm sort. Returns `{ ok: false, error: 'Cycle detected...' }` if the graph has cycles. This is called during graph validation to prevent deadlocks.

### Execution Batches

Batches are computed by assigning each task a **level** equal to the longest path from any root to that task:

```
Level 0: [task_A]  (no dependencies)
Level 1: [task_B, task_C]  (depend on A)
Level 2: [task_D]  (depends on B)
Level 3: [task_E, task_F]  (depend on C and D)
```

The engine processes batches sequentially but runs all tasks within a batch in parallel (up to `maxConcurrency`).

## TaskEvent

Events emitted by `TaskEngine`:

```typescript
interface TaskEvent {
  type:
  | 'task:created'
  | 'task:updated'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:cancelled'
  | 'task:paused'
  | 'task:resumed'
  | 'task:retry'
  | 'graph:completed'
  | 'graph:failed';
  taskId?: string;
  graphId: string;
  task?: Task;
  graph?: TaskGraph;
  error?: string;
}
```

## Example: Constructed Graph

For the goal "Build a REST API with authentication and rate limiting":

```
task_graph:
  goal: "Build a REST API with authentication and rate limiting"
  tasks:
    t_ctx_001:
      title: "Analyze project structure"
      agentRole: context
      status: done
      dependsOn: []

    t_pln_002:
      title: "Design API schema and auth flow"
      agentRole: planner
      status: done
      dependsOn: [t_ctx_001]

    t_cdr_003:
      title: "Implement route handlers"
      agentRole: coder
      status: done
      dependsOn: [t_pln_002]
      files: ["src/routes/api.ts"]

    t_cdr_004:
      title: "Implement JWT authentication middleware"
      agentRole: coder
      status: running
      dependsOn: [t_pln_002]
      files: ["src/middleware/auth.ts"]

    t_cdr_005:
      title: "Implement rate limiter"
      agentRole: coder
      status: pending
      dependsOn: [t_pln_002]
      files: ["src/middleware/rateLimit.ts"]

    t_rvr_006:
      title: "Review all changes"
      agentRole: reviewer
      status: blocked
      dependsOn: [t_cdr_003, t_cdr_004, t_cdr_005]

    t_tst_007:
      title: "Run tests and verify"
      agentRole: tester
      status: blocked
      dependsOn: [t_rvr_006]

  batches:
    - [t_ctx_001]              // Level 0
    - [t_pln_002]              // Level 1
    - [t_cdr_003, t_cdr_004, t_cdr_005]  // Level 2 (parallel)
    - [t_rvr_006]              // Level 3
    - [t_tst_007]              // Level 4
```
