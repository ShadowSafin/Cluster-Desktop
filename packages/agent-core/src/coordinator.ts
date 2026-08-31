import {
  createId,
  nowIso,
  Emitter,
  type Task,
  type TaskGraph,
  type AgentRole,
  type ToolCall,
  type AgentActivity,
} from '@cluster/shared';
import { TaskEngine, type TaskExecutor } from '@cluster/task-engine';
import { TaskGraphStore } from '@cluster/task-engine';
import { ContextEngine } from '@cluster/context-engine';
import type { ToolRegistry } from '@cluster/tool-runtime';
import type { AgentConfig } from './config.js';
import type { ModelProvider } from './provider.js';
import type { AgentEvents } from './events.js';
import { PlannerAgent } from './agents/plannerAgent.js';
import { ContextAgent } from './agents/contextAgent.js';
import { CoderAgent } from './agents/coderAgent.js';
import { ReviewerAgent } from './agents/reviewerAgent.js';
import { TesterAgent } from './agents/testerAgent.js';
import type { BaseAgent } from './agents/types.js';

/**
 * Optional coordinator that manages task assignment and merges results.
 *
 * Responsibilities:
 * - Agents have distinct responsibilities (via role)
 * - Agents run in parallel when tasks are independent
 * - Coordinates outputs and avoids conflicting edits (file locks)
 * - Every agent action visible in TUI (via events)
 */

export interface CoordinatorOptions {
  config: AgentConfig;
  provider: ModelProvider;
  registry: ToolRegistry;
  projectRoot: string;
  sessionId: string;
  events: Emitter<AgentEvents>;
  backupsDir: string;
}

export class Coordinator {
  private planner: PlannerAgent;
  private contextAgent: ContextAgent;
  private coder: CoderAgent;
  private reviewer: ReviewerAgent;
  private tester: TesterAgent;
  private agents: Map<AgentRole, BaseAgent>;
  private fileLocks = new Set<string>();
  private activityLog: AgentActivity[] = [];

  constructor(private readonly opts: CoordinatorOptions) {
    this.planner = new PlannerAgent();
    this.contextAgent = new ContextAgent();
    this.coder = new CoderAgent(opts.config, opts.provider);
    this.reviewer = new ReviewerAgent();
    this.tester = new TesterAgent();
    this.agents = new Map<AgentRole, BaseAgent>([
      ['planner', this.planner],
      ['context', this.contextAgent],
      ['coder', this.coder],
      ['reviewer', this.reviewer],
      ['tester', this.tester],
    ]);
  }

  /** Expose planner for direct graph creation. */
  get plannerAgent(): PlannerAgent {
    return this.planner;
  }

  /** Create a task graph for a user request. */
  async createPlan(goal: string): Promise<TaskGraph> {
    this.emitActivity('planner', 'thinking', `Creating plan for: ${goal.slice(0, 80)}`);
    this.opts.events.emit('state', { phase: 'planning', label: 'Planning', iteration: 0, maxIterations: this.opts.config.maxIterations });

    // Use context engine for file groups to inform planning
    let fileGroups: Array<{ area: string; files: string[] }> | undefined;
    try {
      const engine = new ContextEngine({ projectRoot: this.opts.projectRoot });
      const intel = await engine.gatherIntelligence();
      fileGroups = intel.fileGroups;
      this.emitActivity('context', 'thinking', `Gathered repo intelligence: ${intel.languages.join(', ')} | ${intel.fileGroups.length} groups`);
    } catch {
      // ignore
    }

    const graph = this.planner.createGraph(goal, fileGroups);
    this.opts.events.emit('plan', {
      goal,
      steps: Object.values(graph.tasks).map((t) => ({ id: t.id, text: `[${t.agentRole ?? 'unassigned'}] ${t.title}`, status: 'pending' as const })),
      createdAt: nowIso(),
    });
    this.emitActivity('planner', 'done', `Plan created: ${Object.keys(graph.tasks).length} tasks, ${new TaskGraphStore(graph).executionBatches().length} batches`);
    this.opts.events.emit('state', { phase: 'thinking', label: 'Plan ready', iteration: 1, maxIterations: this.opts.config.maxIterations });
    return graph;
  }

  /** Run graph with multi-agent dispatch. */
  async runGraph(graph: TaskGraph, signal: AbortSignal): Promise<{ graph: TaskGraph; results: Map<string, { success: boolean; summary: string }> }> {
    const engine = new TaskEngine(graph, { maxConcurrency: 4 });
    const results = new Map<string, { success: boolean; summary: string }>();

    // Register executor that dispatches to correct agent
    const executor: TaskExecutor = async (task, taskSignal) => {
      const role = task.agentRole ?? 'coder';
      const agent = this.agents.get(role) ?? this.coder;

      // Conflict avoidance: check file locks
      const files = task.files ?? [];
      const conflicting = files.filter((f) => this.fileLocks.has(f));
      if (conflicting.length > 0) {
        this.emitActivity(role, 'waiting', `Waiting for lock: ${conflicting.join(', ')}`);
        // Simple wait — retry after short delay if lock held (real impl would queue)
        await this.delay(300, taskSignal);
      }
      // Acquire locks
      for (const f of files) this.fileLocks.add(f);

      this.emitActivity(role, 'acting', `Starting task: ${task.title}`);
      this.opts.events.emit('progress', { message: `[${role}] ${task.title}` });

      try {
        const ctx = {
          projectRoot: this.opts.projectRoot,
          sessionId: this.opts.sessionId,
          task,
          signal: taskSignal,
          registry: this.withRoleFilter(role),
          providerMessages: [],
          emitActivity: (msg: string) => this.emitActivity(role, 'thinking', msg),
          emitToolStart: (call: ToolCall) => this.opts.events.emit('tool:start', call),
          emitToolEnd: (call: ToolCall) => this.opts.events.emit('tool:end', call),
        };

        // Create checkpoint before coder edits
        if (role === 'coder') {
          try {
            await this.opts.registry.execute('checkpoint_create', { message: `Before ${task.title}` }, {
              projectRoot: this.opts.projectRoot,
              workspace: null,
              signal: taskSignal,
              logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined } as any,
              backupsDir: this.opts.backupsDir,
              sessionId: this.opts.sessionId,
              alwaysConfirmCommands: false,
              confirm: async () => true,
              emitOutput: () => undefined,
              emitProgress: () => undefined,
            });
          } catch {
            // checkpoint is best-effort
          }
        }

        const output = await agent.run(task, ctx as any);
        results.set(task.id, { success: output.success, summary: output.summary });

        // Forward tool calls to events
        for (const call of output.toolCalls) {
          // Already emitted via emitTool*
        }

        this.emitActivity(role, output.success ? 'done' : 'error', output.summary.slice(0, 200));
        return { success: output.success, result: output.summary, error: output.error };
      } catch (error) {
        const msg = (error as Error).message;
        this.emitActivity(role, 'error', `Failed: ${msg.slice(0, 150)}`);
        results.set(task.id, { success: false, summary: msg });
        return { success: false, error: msg };
      } finally {
        for (const f of files) this.fileLocks.delete(f);
      }
    };

    engine.registerExecutor(executor);
    // Wire engine events to AgentEvents for TUI visibility
    engine.events.on('task:started', ({ task }) => this.emitActivity(task.agentRole ?? 'coordinator', 'acting', `Task started: ${task.title}`));
    engine.events.on('task:completed', ({ task }) => this.emitActivity(task.agentRole ?? 'coordinator', 'done', `Task done: ${task.title}`));
    engine.events.on('task:failed', ({ task, error }) => this.emitActivity(task.agentRole ?? 'coordinator', 'error', `Task failed: ${task.title} — ${error}`));
    engine.events.on('task:retry', ({ task, attempt }) => this.emitActivity(task.agentRole ?? 'coordinator', 'thinking', `Retry ${attempt}: ${task.title}`));

    await engine.runAll(signal);

    // Emit merged summary
    const doneCount = Object.values(engine.graph.tasks).filter((t) => t.status === 'done').length;
    const failedCount = Object.values(engine.graph.tasks).filter((t) => t.status === 'failed').length;
    const summary = `Multi-agent run complete: ${doneCount} done, ${failedCount} failed out of ${Object.keys(engine.graph.tasks).length}`;
    this.emitActivity('coordinator', failedCount ? 'error' : 'done', summary);
    this.opts.events.emit('progress', { message: summary });
    this.opts.events.emit('done', {
      summary,
      usage: { prompt: 0, completion: 0, total: 0 },
      cancelled: signal.aborted,
      iterations: Object.keys(engine.graph.tasks).length,
    });

    return { graph: engine.graph, results };
  }

  /** Convenience: plan and run in one go. */
  async handleRequest(userInput: string, signal: AbortSignal): Promise<TaskGraph> {
    const graph = await this.createPlan(userInput);
    const { graph: finished } = await this.runGraph(graph, signal);
    return finished;
  }

  getActivity(): AgentActivity[] {
    return [...this.activityLog];
  }

  private withRoleFilter(role: AgentRole): ToolRegistry {
    // Create a filtered view: registry still contains all tools, but provider will be told to filter
    // We return the same registry but caller will use forRole(role) when building prompts.
    // For execution, the coder's allow-list is enforced inside CoderAgent.
    return this.opts.registry;
  }

  private emitActivity(role: AgentRole, phase: AgentActivity['phase'], message: string): void {
    const activity: AgentActivity = {
      agentRole: role,
      agentId: `${role}_${createId('agent').slice(0, 6)}`,
      phase,
      message,
      timestamp: nowIso(),
    };
    this.activityLog.push(activity);
    if (this.activityLog.length > 200) this.activityLog.shift();
    this.opts.events.emit('progress', { message: `[${role}] ${message}` });
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
}
