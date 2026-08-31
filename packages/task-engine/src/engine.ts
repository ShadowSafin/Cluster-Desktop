import { createId, nowIso, Emitter, type Task, type TaskGraph, type TaskStatus } from '@cluster/shared';
import { TaskGraphStore } from './graph.js';

export interface TaskEngineOptions {
  maxConcurrency?: number;
  defaultRetryAttempts?: number;
  retryBackoffMs?: number;
}

export type TaskExecutor = (task: Task, signal: AbortSignal) => Promise<{ success: boolean; result?: string; error?: string }>;

export interface TaskEngineEvents {
  'task:created': { task: Task };
  'task:started': { task: Task };
  'task:completed': { task: Task };
  'task:failed': { task: Task; error: string };
  'task:cancelled': { task: Task };
  'task:paused': { task: Task };
  'task:resumed': { task: Task };
  'task:retry': { task: Task; attempt: number };
  'graph:started': { graph: TaskGraph };
  'graph:paused': { graph: TaskGraph };
  'graph:resumed': { graph: TaskGraph };
  'graph:completed': { graph: TaskGraph };
  'graph:failed': { graph: TaskGraph; error: string };
  'graph:cancelled': { graph: TaskGraph };
  progress: { message: string; taskId?: string };
}

export class TaskEngine {
  readonly events: Emitter<TaskEngineEvents>;
  readonly store: TaskGraphStore;
  private executors = new Map<string, TaskExecutor>();
  private defaultExecutor?: TaskExecutor;
  private running = new Map<string, AbortController>();
  private paused = false;
  private cancelled = false;

  constructor(graph: TaskGraph, private readonly options: TaskEngineOptions = {}) {
    this.store = new TaskGraphStore(graph);
    this.events = new Emitter<TaskEngineEvents>();
  }

  static create(goal: string, options?: TaskEngineOptions): TaskEngine {
    const graph = TaskGraphStore.create(goal).graph;
    return new TaskEngine(graph, options);
  }

  get graph(): TaskGraph {
    return this.store.graph;
  }

  /** Register executor for a specific task type or as default. */
  registerExecutor(executor: TaskExecutor, taskId?: string): void {
    if (taskId) this.executors.set(taskId, executor);
    else this.defaultExecutor = executor;
  }

  /** Create tasks */
  addTask(init: Parameters<TaskGraphStore['addTask']>[0]): Task {
    const task = this.store.addTask(init);
    this.events.emit('task:created', { task });
    return task;
  }

  addTasks(inits: Array<Parameters<TaskGraphStore['addTask']>[0]>): Task[] {
    return inits.map((init) => this.addTask(init));
  }

  updateTask(id: string, patch: Partial<Task>): Task | undefined {
    return this.store.updateTask(id, patch);
  }

  getTask(id: string): Task | undefined {
    return this.store.getTask(id);
  }

  /** Run all tasks respecting dependencies, with parallel execution for independent tasks. */
  async runAll(signal?: AbortSignal): Promise<TaskGraph> {
    this.cancelled = false;
    this.paused = false;
    this.store.graph.status = 'running';
    this.events.emit('graph:started', { graph: this.store.graph });

    const abort = signal ?? new AbortController().signal;

    try {
      await this.executeBatches(abort);
      if (this.cancelled) {
        this.store.graph.status = 'cancelled';
        this.events.emit('graph:cancelled', { graph: this.store.graph });
      } else if ((this.store.graph.status as string) !== 'paused' && (this.store.graph.status as string) !== 'failed') {
        const hasFailed = Object.values(this.store.graph.tasks).some((t) => t.status === 'failed');
        this.store.graph.status = hasFailed ? 'failed' : 'done';
        if (hasFailed) {
          this.events.emit('graph:failed', { graph: this.store.graph, error: 'One or more tasks failed' });
        } else {
          this.events.emit('graph:completed', { graph: this.store.graph });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.graph.status = 'failed';
      this.events.emit('graph:failed', { graph: this.store.graph, error: message });
    }

    return this.store.graph;
  }

  /** Execute in dependency-order batches, parallel within each batch. */
  private async executeBatches(signal: AbortSignal): Promise<void> {
    const batches = this.store.executionBatches();
    const maxConcurrency = this.options.maxConcurrency ?? 4;

    for (const batch of batches) {
      if (signal.aborted || this.cancelled) break;
      while (this.paused) {
        await this.waitForResume(signal);
        if (signal.aborted || this.cancelled) break;
      }

      // Filter to only tasks that are still pending/ready
      const executable = batch
        .map((id) => this.store.getTask(id))
        .filter((t): t is Task => t !== undefined && (t.status === 'ready' || t.status === 'pending' || t.status === 'blocked'));

      if (executable.length === 0) continue;

      // Wait for dependencies to be satisfied before running batch
      for (const task of executable) {
        // Re-evaluate blocked status; deps may not be done yet if earlier batch had failures
        if (task.status === 'blocked') continue;
        if (task.dependsOn.some((depId) => {
          const dep = this.store.getTask(depId);
          return dep !== undefined && !(['done', 'skipped'] as string[]).includes(dep.status as string);
        })) {
          this.store.setStatus(task.id, 'blocked');
        }
      }

      const ready = executable.filter((t) => t.status === 'ready');
      if (ready.length === 0) continue;

      // Run ready tasks in parallel, limited concurrency
      await this.runParallel(ready, maxConcurrency, signal);
    }
  }

  private async runParallel(tasks: Task[], limit: number, signal: AbortSignal): Promise<void> {
    const queue = [...tasks];
    const workers: Promise<void>[] = [];

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        if (signal.aborted || this.cancelled) break;
        while (this.paused) {
          await this.waitForResume(signal);
        }
        const task = queue.shift();
        if (!task) break;
        // Skip if task became blocked/cancelled while waiting
        const current = this.store.getTask(task.id);
        if (!current || !(['ready', 'pending'] as string[]).includes(current.status as string)) continue;
        await this.executeTask(current, signal);
      }
    };

    const concurrency = Math.min(limit, tasks.length);
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
  }

  private async executeTask(task: Task, parentSignal: AbortSignal): Promise<void> {
    const controller = new AbortController();
    const combined = this.combineSignals(parentSignal, controller.signal);
    this.running.set(task.id, controller);
    this.store.setStatus(task.id, 'running');
    this.events.emit('task:started', { task: this.store.getTask(task.id)! });
    this.events.emit('progress', { message: `Starting: ${task.title}`, taskId: task.id });

    const executor = this.executors.get(task.id) ?? this.defaultExecutor;
    if (!executor) {
      this.store.setStatus(task.id, 'failed', 'No executor registered');
      this.events.emit('task:failed', { task: this.store.getTask(task.id)!, error: 'No executor' });
      this.running.delete(task.id);
      return;
    }

    let lastError: string | undefined;
    const maxAttempts = task.retry.maxAttempts;

    for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
      if (combined.aborted || this.cancelled) {
        this.store.setStatus(task.id, 'cancelled');
        this.events.emit('task:cancelled', { task: this.store.getTask(task.id)! });
        break;
      }

      if (attempt > 0) {
        this.events.emit('task:retry', { task: this.store.getTask(task.id)!, attempt });
        await this.delay(task.retry.backoffMs * attempt, combined);
      }

      try {
        const result = await executor(this.store.getTask(task.id)!, combined);
        if (combined.aborted || this.cancelled) {
          this.store.setStatus(task.id, 'cancelled');
          this.events.emit('task:cancelled', { task: this.store.getTask(task.id)! });
          break;
        }
        if (result.success) {
          this.store.updateTask(task.id, { result: result.result ?? null, error: null });
          this.store.setStatus(task.id, 'done');
          this.events.emit('task:completed', { task: this.store.getTask(task.id)! });
          // Unblock dependents
          this.unblockDependents(task.id);
          break;
        } else {
          lastError = result.error ?? 'Unknown failure';
          task.retry.attempts = attempt + 1;
          if (attempt >= maxAttempts) {
            this.store.setStatus(task.id, 'failed', lastError);
            this.events.emit('task:failed', { task: this.store.getTask(task.id)!, error: lastError });
            // Don't crash whole graph; continue but emit graph failed later
            break;
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        task.retry.attempts = attempt + 1;
        if (attempt >= maxAttempts) {
          this.store.setStatus(task.id, 'failed', lastError);
          this.events.emit('task:failed', { task: this.store.getTask(task.id)!, error: lastError });
          break;
        }
      }
    }

    this.running.delete(task.id);
  }

  private unblockDependents(taskId: string): void {
    const task = this.store.getTask(taskId);
    if (!task?.dependents) return;
    for (const depId of task.dependents) {
      const dep = this.store.getTask(depId);
      if (!dep) continue;
      const depsDone = dep.dependsOn.every((id) => {
        const d = this.store.getTask(id);
        return d?.status === 'done' || d?.status === 'skipped';
      });
      if (depsDone && dep.status === 'blocked') {
        this.store.setStatus(dep.id, 'ready');
      }
    }
  }

  /** Cancellation */
  cancel(taskId?: string): void {
    if (taskId) {
      const ctrl = this.running.get(taskId);
      ctrl?.abort();
      const task = this.store.getTask(taskId);
      if (task && ['running', 'ready', 'pending', 'blocked'].includes(task.status)) {
        this.store.setStatus(taskId, 'cancelled');
        this.events.emit('task:cancelled', { task: this.store.getTask(taskId)! });
      }
    } else {
      this.cancelled = true;
      for (const ctrl of this.running.values()) ctrl.abort();
      for (const task of Object.values(this.store.graph.tasks)) {
        if ((['running', 'ready', 'pending', 'blocked', 'paused'] as string[]).includes(task.status as string)) {
          this.store.setStatus(task.id, 'cancelled');
        }
      }
      this.store.graph.status = 'cancelled';
      this.events.emit('graph:cancelled', { graph: this.store.graph });
    }
  }

  pause(taskId?: string): void {
    if (taskId) {
      const task = this.store.getTask(taskId);
      if (task && task.status === 'running') {
        this.store.setStatus(taskId, 'paused');
        this.events.emit('task:paused', { task: this.store.getTask(taskId)! });
      }
    } else {
      this.paused = true;
      this.store.graph.status = 'paused';
      for (const task of Object.values(this.store.graph.tasks)) {
        if (task.status === 'running') {
          this.store.setStatus(task.id, 'paused');
        }
      }
      this.events.emit('graph:paused', { graph: this.store.graph });
    }
  }

  resume(taskId?: string): void {
    if (taskId) {
      const task = this.store.getTask(taskId);
      if (task && task.status === 'paused') {
        this.store.setStatus(taskId, 'ready');
        this.events.emit('task:resumed', { task: this.store.getTask(taskId)! });
      }
    } else {
      this.paused = false;
      this.store.graph.status = 'running';
      for (const task of Object.values(this.store.graph.tasks)) {
        if (task.status === 'paused') {
          this.store.setStatus(task.id, 'ready');
        }
      }
      this.events.emit('graph:resumed', { graph: this.store.graph });
    }
  }

  /** Retry a failed task */
  retry(taskId: string): void {
    const task = this.store.getTask(taskId);
    if (!task) return;
    if (task.status !== 'failed') return;
    task.retry.attempts = 0;
    task.error = null;
    this.store.setStatus(taskId, 'ready');
    this.events.emit('task:retry', { task: this.store.getTask(taskId)!, attempt: 0 });
  }

  getStatus(): TaskGraph['status'] {
    return this.store.graph.status;
  }

  isRunning(): boolean {
    return this.store.graph.status === 'running';
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Stats for UI */
  stats(): { total: number; done: number; failed: number; running: number; pending: number; blocked: number; cancelled: number } {
    const tasks = Object.values(this.store.graph.tasks);
    return {
      total: tasks.length,
      done: tasks.filter((t) => t.status === 'done').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      running: tasks.filter((t) => t.status === 'running').length,
      pending: tasks.filter((t) => t.status === 'pending' || t.status === 'ready').length,
      blocked: tasks.filter((t) => t.status === 'blocked').length,
      cancelled: tasks.filter((t) => t.status === 'cancelled').length,
    };
  }

  private combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
    if (a.aborted) return a;
    if (b.aborted) return b;
    const ctrl = new AbortController();
    const onAbort = (): void => ctrl.abort();
    a.addEventListener('abort', onAbort, { once: true });
    b.addEventListener('abort', onAbort, { once: true });
    return ctrl.signal;
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new Error('Cancelled'));
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('Cancelled'));
      }, { once: true });
    });
  }

  private async waitForResume(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.paused) return resolve();
      if (signal.aborted) return reject(new Error('Cancelled'));
      const check = setInterval(() => {
        if (!this.paused) {
          clearInterval(check);
          resolve();
        }
        if (signal.aborted) {
          clearInterval(check);
          reject(new Error('Cancelled'));
        }
      }, 100);
      signal.addEventListener('abort', () => {
        clearInterval(check);
        reject(new Error('Cancelled'));
      }, { once: true });
    });
  }
}
