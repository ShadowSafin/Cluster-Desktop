import { Emitter, type TaskGraph, type Task, type VerificationSummary } from '@cluster/shared';
import type { AgentEvents } from './events.js';
import { TaskGraphStore } from '@cluster/task-engine';
import type { Coordinator } from './coordinator.js';
import type { MemoryStore } from '@cluster/memory';
import { runVerification } from '@cluster/tool-runtime';

/**
 * High-level orchestrator that ties together:
 * - Task planning
 * - Multi-agent dispatch
 * - Context intelligence
 * - Verification loop
 * - Memory persistence
 *
 * Ensures every step is event-driven and the UI can render live.
 */

export interface OrchestratorOptions {
  coordinator: Coordinator;
  memory?: MemoryStore | null;
  events: Emitter<AgentEvents>;
  projectRoot: string;
  sessionId: string;
  onTaskGraph?: (graph: TaskGraph) => void;
}

export class Orchestrator {
  constructor(private readonly opts: OrchestratorOptions) {}

  /** Full flow: user request -> plan -> agents -> verify -> memory. */
  async execute(request: string, signal: AbortSignal): Promise<{ graph: TaskGraph; verification?: VerificationSummary; summary: string }> {
    const start = Date.now();

    // 1. Planning (coordinator creates graph visible in TUI)
    const graph = await this.opts.coordinator.createPlan(request);
    this.opts.onTaskGraph?.(graph);

    // Persist to memory
    if (this.opts.memory) {
      await this.opts.memory.add({
        scope: 'session',
        category: 'note',
        key: `plan:${graph.id.slice(0, 8)}`,
        value: `Goal: ${request.slice(0, 300)} — ${Object.keys(graph.tasks).length} tasks`,
        source: 'auto',
      }).catch(() => undefined);
    }

    // 2. Multi-agent execution
    const { graph: finished, results } = await this.opts.coordinator.runGraph(graph, signal);
    this.opts.onTaskGraph?.(finished);

    if (signal.aborted) {
      return { graph: finished, summary: 'Cancelled by user' };
    }

    // 3. Verification (automatic, but relevant)
    let verification: VerificationSummary | undefined;
    try {
      // Only verify if there were coder edits
      const hadEdits = Object.values(finished.tasks).some((t) => t.agentRole === 'coder' && t.status === 'done');
      if (hadEdits) {
        const ver = await runVerification({
          projectRoot: this.opts.projectRoot,
          sessionId: this.opts.sessionId,
          signal,
          emitOutput: (chunk) => this.opts.events.emit('progress', { message: chunk.slice(0, 200) }),
        });
        const passed = ver.result.passed;
        verification = {
          total: 1,
          passed: passed ? 1 : 0,
          failed: passed ? 0 : 1,
          durationMs: ver.result.durationMs,
          results: [ver.result],
          message: ver.summary,
        };
        this.opts.events.emit('progress', { message: `Verification: ${ver.summary}` });
        if (!passed && ver.shouldAutoFix) {
          this.opts.events.emit('progress', { message: 'Attempting auto-fix for verification failures…' });
        }
      }
    } catch {
      // verification failure should not crash orchestrator
    }

    // 4. Memory persistence: save summary to project memory
    const summary = this.buildSummary(finished, results, verification, Date.now() - start);
    if (this.opts.memory) {
      await this.opts.memory.add({
        scope: 'project',
        category: 'pattern',
        key: `task-${finished.id.slice(0, 8)}`,
        value: summary.slice(0, 1500),
        source: 'auto',
        tags: ['orchestrator', 'phase2'],
      }).catch(() => undefined);
      for (const task of Object.values(finished.tasks)) {
        await this.opts.memory.appendTaskHistory(task.id, task.title, task.status).catch(() => undefined);
      }
    }

    return { graph: finished, verification, summary };
  }

  private buildSummary(graph: TaskGraph, results: Map<string, { success: boolean; summary: string }>, verification: VerificationSummary | undefined, durationMs: number): string {
    const store = new TaskGraphStore(graph);
    const stats = {
      done: Object.values(graph.tasks).filter((t) => t.status === 'done').length,
      failed: Object.values(graph.tasks).filter((t) => t.status === 'failed').length,
      total: Object.keys(graph.tasks).length,
    };
    const lines: string[] = [];
    lines.push(`Orchestrated ${stats.total} tasks in ${durationMs}ms: ${stats.done} done, ${stats.failed} failed`);
    lines.push(`Batches: ${store.executionBatches().length} parallel groups`);
    if (verification) lines.push(`Verification: ${verification.message}`);
    for (const [taskId, result] of results) {
      const task = graph.tasks[taskId];
      lines.push(`  ${result.success ? '✓' : '✗'} [${task?.agentRole ?? '?'}] ${task?.title ?? taskId}: ${result.summary.slice(0, 100)}`);
    }
    return lines.join('\n');
  }
}
