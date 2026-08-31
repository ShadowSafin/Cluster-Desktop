import { createId, nowIso, createTask, createTaskGraph, } from '@cluster/shared';
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
    graph;
    constructor(graph) {
        this.graph = graph;
    }
    static create(goal, id) {
        const graph = createTaskGraph({ id: id ?? createId('graph'), goal });
        return new TaskGraphStore(graph);
    }
    static from(graph) {
        return new TaskGraphStore(structuredClone(graph));
    }
    addTask(init) {
        const id = createId('task');
        const task = createTask({ id, ...init });
        this.graph.tasks[id] = task;
        if (init.parentId) {
            const parent = this.graph.tasks[init.parentId];
            if (parent) {
                parent.subtasks.push(id);
                parent.updatedAt = nowIso();
            }
        }
        else {
            this.graph.rootIds.push(id);
        }
        // update dependents reverse index
        for (const depId of task.dependsOn) {
            const dep = this.graph.tasks[depId];
            if (dep) {
                dep.dependents = dep.dependents ?? [];
                if (!dep.dependents.includes(id))
                    dep.dependents.push(id);
            }
        }
        this.recomputeBlocked();
        this.graph.updatedAt = nowIso();
        return task;
    }
    addTasks(tasks) {
        return tasks.map((t) => this.addTask(t));
    }
    getTask(id) {
        return this.graph.tasks[id];
    }
    updateTask(id, patch) {
        const task = this.graph.tasks[id];
        if (!task)
            return undefined;
        Object.assign(task, patch, { updatedAt: nowIso() });
        this.recomputeBlocked();
        this.graph.updatedAt = nowIso();
        return task;
    }
    /** Set status and handle lifecycle timestamps automatically. */
    setStatus(id, status, error) {
        const task = this.graph.tasks[id];
        if (!task)
            return undefined;
        task.status = status;
        task.updatedAt = nowIso();
        if (status === 'running' && !task.startedAt)
            task.startedAt = nowIso();
        if (['done', 'failed', 'cancelled', 'skipped'].includes(status))
            task.finishedAt = nowIso();
        if (error !== undefined)
            task.error = error;
        this.recomputeBlocked();
        this.recomputeGraphStatus();
        return task;
    }
    /** All tasks that are ready to run (pending with deps satisfied). */
    readyTasks() {
        return Object.values(this.graph.tasks).filter((t) => t.status === 'ready' || t.status === 'pending' && this.depsSatisfied(t));
    }
    /** Tasks currently blocked. */
    blockedTasks() {
        return Object.values(this.graph.tasks).filter((t) => t.status === 'blocked');
    }
    /** Topological order or error if cycle. */
    topologicalOrder() {
        const visited = new Set();
        const visiting = new Set();
        const order = [];
        const cycle = [];
        const dfs = (id) => {
            if (visiting.has(id)) {
                cycle.push(id);
                return false;
            }
            if (visited.has(id))
                return true;
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
    executionBatches() {
        const order = this.topologicalOrder();
        if (!order.ok)
            return [Object.keys(this.graph.tasks)];
        const levels = new Map();
        const batchMap = new Map();
        for (const id of order.order) {
            const task = this.graph.tasks[id];
            if (!task)
                continue;
            const level = task.dependsOn.length === 0 ? 0 : Math.max(...task.dependsOn.map((d) => (levels.get(d) ?? -1) + 1));
            levels.set(id, level);
            const arr = batchMap.get(level) ?? [];
            arr.push(id);
            batchMap.set(level, arr);
        }
        return [...batchMap.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    }
    /** Build tree for UI inspection. */
    taskTree() {
        const build = (id) => {
            const task = this.graph.tasks[id];
            return {
                task,
                children: task.subtasks.map((childId) => build(childId)),
            };
        };
        return this.graph.rootIds.map(build);
    }
    /** Detect independent tasks that can run in parallel. */
    parallelGroups() {
        const batches = this.executionBatches();
        return batches.map((batch) => batch.map((id) => this.graph.tasks[id]).filter(Boolean)).filter((g) => g.length > 0);
    }
    clone() {
        return TaskGraphStore.from(this.graph);
    }
    toJSON() {
        return structuredClone(this.graph);
    }
    depsSatisfied(task) {
        if (task.dependsOn.length === 0)
            return true;
        return task.dependsOn.every((depId) => {
            const dep = this.graph.tasks[depId];
            return dep?.status === 'done' || dep?.status === 'skipped';
        });
    }
    recomputeBlocked() {
        for (const task of Object.values(this.graph.tasks)) {
            if (['done', 'failed', 'cancelled', 'skipped', 'running', 'paused'].includes(task.status))
                continue;
            const satisfied = this.depsSatisfied(task);
            if (!satisfied) {
                if (task.status !== 'blocked') {
                    task.status = 'blocked';
                    task.updatedAt = nowIso();
                }
            }
            else {
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
    recomputeGraphStatus() {
        const tasks = Object.values(this.graph.tasks);
        if (tasks.length === 0)
            return;
        const hasRunning = tasks.some((t) => t.status === 'running' || t.status === 'ready');
        const hasFailed = tasks.some((t) => t.status === 'failed');
        const allDone = tasks.every((t) => ['done', 'skipped', 'cancelled'].includes(t.status));
        const anyPaused = tasks.some((t) => t.status === 'paused');
        if (anyPaused)
            this.graph.status = 'paused';
        else if (hasRunning)
            this.graph.status = 'running';
        else if (allDone && !hasFailed)
            this.graph.status = 'done';
        else if (hasFailed && !hasRunning)
            this.graph.status = 'failed';
        this.graph.updatedAt = nowIso();
    }
}
export function detectCycle(graph) {
    const store = TaskGraphStore.from(graph);
    const result = store.topologicalOrder();
    if (!result.ok)
        return result.cycle;
    return null;
}
//# sourceMappingURL=graph.js.map