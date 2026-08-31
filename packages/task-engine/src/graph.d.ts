import { type Task, type TaskGraph, type TaskStatus } from '@cluster/shared';
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
export declare class TaskGraphStore {
    graph: TaskGraph;
    constructor(graph: TaskGraph);
    static create(goal: string, id?: string): TaskGraphStore;
    static from(graph: TaskGraph): TaskGraphStore;
    addTask(init: {
        title: string;
        description?: string;
        parentId?: string | null;
        dependsOn?: string[];
        agentRole?: Task['agentRole'];
        priority?: Task['priority'];
        maxAttempts?: number;
        complexity?: number;
    }): Task;
    addTasks(tasks: Array<Parameters<TaskGraphStore['addTask']>[0]>): Task[];
    getTask(id: string): Task | undefined;
    updateTask(id: string, patch: Partial<Task>): Task | undefined;
    /** Set status and handle lifecycle timestamps automatically. */
    setStatus(id: string, status: TaskStatus, error?: string): Task | undefined;
    /** All tasks that are ready to run (pending with deps satisfied). */
    readyTasks(): Task[];
    /** Tasks currently blocked. */
    blockedTasks(): Task[];
    /** Topological order or error if cycle. */
    topologicalOrder(): {
        ok: true;
        order: string[];
    } | {
        ok: false;
        error: string;
        cycle: string[];
    };
    /** Execution order grouped into parallel batches. */
    executionBatches(): string[][];
    /** Build tree for UI inspection. */
    taskTree(): Array<{
        task: Task;
        children: ReturnType<TaskGraphStore['taskTree']>;
    }>;
    /** Detect independent tasks that can run in parallel. */
    parallelGroups(): Task[][];
    clone(): TaskGraphStore;
    toJSON(): TaskGraph;
    private depsSatisfied;
    private recomputeBlocked;
    private recomputeGraphStatus;
}
export declare function detectCycle(graph: TaskGraph): string[] | null;
//# sourceMappingURL=graph.d.ts.map