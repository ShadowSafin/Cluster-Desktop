import {
  createId,
  nowIso,
  type Task,
  type TaskGraph,
  type TaskStatus,
  createTask,
  createTaskGraph,
} from '@cluster/shared';

/**
 * DAG task graph implementation.
 *
 * Provides:
 * - Parent/subtask hierarchy
 * - Dependency handling (DAG)
 * - Topological sorting
 * - Status tracking (blocked, ready, running, etc.)
 * - Parallel execution readiness detection
 */

export class TaskGraphStore {
  graph: TaskGraph;

  constructor(graph: TaskGraph) {
    this.graph = graph;
  }

  static create(goal: string, id?: string): TaskGraphStore {
    const graph = createTaskGraph({ id: id ?? createId('graph'), goal });
    return new TaskGraphStore(graph);
  }

  static from(graph: TaskGraph): TaskGraphStore {
    return new TaskGraphStore(structuredClone(graph));
  }

  addTask(init: {
    title: string;
    description?: string;
    parentId?: string | null;
    dependsOn?: string[];
    agentRole?: Task['agentRole'];
    priority?: Task['priority'];
    maxAttempts?: number;
    complexity?: number;
  }): Task {
    const id = createId('task');
    const task = createTask({ id, ...init });
    this.graph.tasks[id] = task;

    if (init.parentId) {
      const parent = this.graph.tasks[init.parentId];
      if (parent) {
        parent.subtasks.push(id);
        parent.updatedAt = nowIso();
      }
    } else {
      this.graph.rootIds.push(id);
    }

    // update dependents reverse index
    for (const depId of task.dependsOn) {
      const dep = this.graph.tasks[depId];
      if (dep) {
        dep.dependents = dep.dependents ?? [];
        if (!dep.dependents.includes(id)) dep.dependents.push(id);
      }
    }

    this.recomputeBlocked();
    this.graph.updatedAt = nowIso();
    return task;
  }

  addTasks(tasks: Array<Parameters<TaskGraphStore['addTask']>[0]>): Task[] {
    return tasks.map((t) => this.addTask(t));
  }

  getTask(id: string): Task | undefined {
    return this.graph.tasks[id];
  }

  updateTask(id: string, patch: Partial<Task>): Task | undefined {
    const task = this.graph.tasks[id];
    if (!task) return undefined;
    Object.assign(task, patch, { updatedAt: nowIso() });
    this.recomputeBlocked();
    this.graph.updatedAt = nowIso();
    return task;
  }

  /** Set status and handle lifecycle timestamps automatically. */
  setStatus(id: string, status: TaskStatus, error?: string): Task | undefined {
    const task = this.graph.tasks[id];
    if (!task) return undefined;
    task.status = status;
    task.updatedAt = nowIso();
    if (status === 'running' && !task.startedAt) task.startedAt = nowIso();
    if (['done', 'failed', 'cancelled', 'skipped'].includes(status)) task.finishedAt = nowIso();
    if (error !== undefined) task.error = error;
    this.recomputeBlocked();
    this.recomputeGraphStatus();
    return task;
  }

  /** All tasks that are ready to run (pending with deps satisfied). */
  readyTasks(): Task[] {
    return Object.values(this.graph.tasks).filter((t) => t.status === 'ready' || t.status === 'pending' && this.depsSatisfied(t));
  }

  /** Tasks currently blocked. */
  blockedTasks(): Task[] {
    return Object.values(this.graph.tasks).filter((t) => t.status === 'blocked');
  }

  /** Topological order or error if cycle. */
  topologicalOrder(): { ok: true; order: string[] } | { ok: false; error: string; cycle: string[] } {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];
    const cycle: string[] = [];

    const dfs = (id: string): boolean => {
      if (visiting.has(id)) {
        cycle.push(id);
        return false;
      }
      if (visited.has(id)) return true;
      visiting.add(id);
      const task = this.graph.tasks[id];
      if (task) {
        for (const dep of task.dependsOn) {
          if (!dfs(dep)) {
            cycle.push(id);
            return false;
          }
        }
      }
      visiting.delete(id);
      visited.add(id);
      order.push(id);
      return true;
    };

    for (const id of Object.keys(this.graph.tasks)) {
      if (!visited.has(id)) {
        if (!dfs(id)) {
          return { ok: false, error: `Cycle detected involving ${cycle.join(' -> ')}`, cycle };
        }
      }
    }
    return { ok: true, order };
  }

  /** Execution order grouped into parallel batches. */
  executionBatches(): string[][] {
    const order = this.topologicalOrder();
    if (!order.ok) return [Object.keys(this.graph.tasks)];

    const levels = new Map<string, number>();
    const batchMap = new Map<number, string[]>();

    for (const id of order.order) {
      const task = this.graph.tasks[id];
      if (!task) continue;
      const level = task.dependsOn.length === 0 ? 0 : Math.max(...task.dependsOn.map((d) => (levels.get(d) ?? -1) + 1));
      levels.set(id, level);
      const arr = batchMap.get(level) ?? [];
      arr.push(id);
      batchMap.set(level, arr);
    }

    return [...batchMap.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }

  /** Build tree for UI inspection. */
  taskTree(): Array<{ task: Task; children: ReturnType<TaskGraphStore['taskTree']> }> {
    const build = (id: string): { task: Task; children: ReturnType<typeof build>[] } => {
      const task = this.graph.tasks[id]!;
      return {
        task,
        children: task.subtasks.map((childId) => build(childId)),
      };
    };
    return this.graph.rootIds.map(build);
  }

  /** Detect independent tasks that can run in parallel. */
  parallelGroups(): Task[][] {
    const batches = this.executionBatches();
    return batches.map((batch) => batch.map((id) => this.graph.tasks[id]!).filter(Boolean)).filter((g) => g.length > 0);
  }

  clone(): TaskGraphStore {
    return TaskGraphStore.from(this.graph);
  }

  toJSON(): TaskGraph {
    return structuredClone(this.graph);
  }

  private depsSatisfied(task: Task): boolean {
    if (task.dependsOn.length === 0) return true;
    return task.dependsOn.every((depId) => {
      const dep = this.graph.tasks[depId];
      return dep?.status === 'done' || dep?.status === 'skipped';
    });
  }

  private recomputeBlocked(): void {
    for (const task of Object.values(this.graph.tasks)) {
      if (['done', 'failed', 'cancelled', 'skipped', 'running', 'paused'].includes(task.status)) continue;
      const satisfied = this.depsSatisfied(task);
      if (!satisfied) {
        if (task.status !== 'blocked') {
          task.status = 'blocked';
          task.updatedAt = nowIso();
        }
      } else {
        if (task.status === 'blocked') {
          task.status = 'pending';
          task.updatedAt = nowIso();
        }
      }
      // pending with deps satisfied becomes ready
      if (task.status === 'pending' && this.depsSatisfied(task)) {
        task.status = 'ready';
      }
    }
  }

  private recomputeGraphStatus(): void {
    const tasks = Object.values(this.graph.tasks);
    if (tasks.length === 0) return;
    const hasRunning = tasks.some((t) => t.status === 'running' || t.status === 'ready');
    const hasFailed = tasks.some((t) => t.status === 'failed');
    const allDone = tasks.every((t) => ['done', 'skipped', 'cancelled'].includes(t.status));
    const anyPaused = tasks.some((t) => t.status === 'paused');

    if (anyPaused) this.graph.status = 'paused';
    else if (hasRunning) this.graph.status = 'running';
    else if (allDone && !hasFailed) this.graph.status = 'done';
    else if (hasFailed && !hasRunning) this.graph.status = 'failed';
    this.graph.updatedAt = nowIso();
  }
}

export function detectCycle(graph: TaskGraph): string[] | null {
  const store = TaskGraphStore.from(graph);
  const result = store.topologicalOrder();
  if (!result.ok) return result.cycle;
  return null;
}
