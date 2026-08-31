/**
 * Task graph types for Phase 2 orchestration.
 *
 * Task graphs are DAGs: tasks with dependencies, parallel execution,
 * retry, cancellation, pause/resume, and lifecycle status.
 */
export type TaskStatus = 'pending' | 'blocked' | 'ready' | 'running' | 'paused' | 'done' | 'failed' | 'skipped' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';
export type AgentRole = 'planner' | 'coder' | 'reviewer' | 'tester' | 'context' | 'coordinator';
export interface Task {
    id: string;
    parentId?: string | null;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    /** Agent role assigned to this task, null means unassigned. */
    agentRole: AgentRole | null;
    /** IDs of tasks this task depends on. */
    dependsOn: string[];
    /** IDs of tasks that depend on this task (convenience, derived). */
    dependents?: string[];
    /** Retry configuration. */
    retry: {
        maxAttempts: number;
        attempts: number;
        backoffMs: number;
    };
    /** Execution metadata. */
    createdAt: string;
    updatedAt: string;
    startedAt?: string | null;
    finishedAt?: string | null;
    error?: string | null;
    /** Subtask IDs (children in the hierarchy). */
    subtasks: string[];
    /** Tool calls produced while executing this task. */
    toolCallIds: string[];
    /** Result summary set on completion. */
    result?: string | null;
    /** Estimated complexity 1-5 for scheduling. */
    complexity?: number;
    /** Files touched by this task. */
    files?: string[];
}
export interface TaskGraph {
    id: string;
    goal: string;
    createdAt: string;
    updatedAt: string;
    tasks: Record<string, Task>;
    rootIds: string[];
    status: 'pending' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled';
}
export interface TaskEvent {
    type: 'task:created' | 'task:updated' | 'task:started' | 'task:completed' | 'task:failed' | 'task:cancelled' | 'task:paused' | 'task:resumed' | 'task:retry' | 'graph:completed' | 'graph:failed';
    taskId?: string;
    graphId: string;
    task?: Task;
    graph?: TaskGraph;
    error?: string;
}
export declare function createTask(init: {
    id: string;
    title: string;
    description?: string;
    parentId?: string | null;
    dependsOn?: string[];
    agentRole?: AgentRole | null;
    priority?: TaskPriority;
    maxAttempts?: number;
    complexity?: number;
}): Task;
export declare function createTaskGraph(init: {
    id: string;
    goal: string;
}): TaskGraph;
//# sourceMappingURL=tasks.d.ts.map