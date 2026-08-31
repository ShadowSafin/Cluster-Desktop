import { Emitter, type Task, type TaskGraph } from '@cluster/shared';
import { TaskGraphStore } from './graph.js';
export interface TaskEngineOptions {
    maxConcurrency?: number;
    defaultRetryAttempts?: number;
    retryBackoffMs?: number;
}
export type TaskExecutor = (task: Task, signal: AbortSignal) => Promise<{
    success: boolean;
    result?: string;
    error?: string;
}>;
export interface TaskEngineEvents {
    'task:created': {
        task: Task;
    };
    'task:started': {
        task: Task;
    };
    'task:completed': {
        task: Task;
    };
    'task:failed': {
        task: Task;
        error: string;
    };
    'task:cancelled': {
        task: Task;
    };
    'task:paused': {
        task: Task;
    };
    'task:resumed': {
        task: Task;
    };
    'task:retry': {
        task: Task;
        attempt: number;
    };
    'graph:started': {
        graph: TaskGraph;
    };
    'graph:paused': {
        graph: TaskGraph;
    };
    'graph:resumed': {
        graph: TaskGraph;
    };
    'graph:completed': {
        graph: TaskGraph;
    };
    'graph:failed': {
        graph: TaskGraph;
        error: string;
    };
    'graph:cancelled': {
        graph: TaskGraph;
    };
    progress: {
        message: string;
        taskId?: string;
    };
}
export declare class TaskEngine {
    private readonly options;
    readonly events: Emitter<TaskEngineEvents>;
    readonly store: TaskGraphStore;
    private executors;
    private defaultExecutor?;
    private running;
    private paused;
    private cancelled;
    constructor(graph: TaskGraph, options?: TaskEngineOptions);
    static create(goal: string, options?: TaskEngineOptions): TaskEngine;
    get graph(): TaskGraph;
    /** Register executor for a specific task type or as default. */
    registerExecutor(executor: TaskExecutor, taskId?: string): void;
    /** Create tasks */
    addTask(init: Parameters<TaskGraphStore['addTask']>[0]): Task;
    addTasks(inits: Array<Parameters<TaskGraphStore['addTask']>[0]>): Task[];
    updateTask(id: string, patch: Partial<Task>): Task | undefined;
    getTask(id: string): Task | undefined;
    /** Run all tasks respecting dependencies, with parallel execution for independent tasks. */
    runAll(signal?: AbortSignal): Promise<TaskGraph>;
    /** Execute in dependency-order batches, parallel within each batch. */
    private executeBatches;
    private runParallel;
    private executeTask;
    private unblockDependents;
    /** Cancellation */
    cancel(taskId?: string): void;
    pause(taskId?: string): void;
    resume(taskId?: string): void;
    /** Retry a failed task */
    retry(taskId: string): void;
    getStatus(): TaskGraph['status'];
    isRunning(): boolean;
    isPaused(): boolean;
    /** Stats for UI */
    stats(): {
        total: number;
        done: number;
        failed: number;
        running: number;
        pending: number;
        blocked: number;
        cancelled: number;
    };
    private combineSignals;
    private delay;
    private waitForResume;
}
//# sourceMappingURL=engine.d.ts.map