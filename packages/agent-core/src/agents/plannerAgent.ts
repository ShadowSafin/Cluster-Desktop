import { createId, type Task, AGENT_DEFINITIONS } from '@cluster/shared';
import { TaskPlanner } from '@cluster/task-engine';
import { ContextEngine } from '@cluster/context-engine';
import type { BaseAgent, AgentContext, AgentRunOutput } from './types.js';

export class PlannerAgent implements BaseAgent {
  role = 'planner' as const;
  name = AGENT_DEFINITIONS.planner.name;
  private planner = new TaskPlanner();

  systemPrompt(): string {
    return AGENT_DEFINITIONS.planner.systemPrompt;
  }

  buildMessages(task: Task, context: string): import('../provider.js').ProviderMessage[] {
    return [
      { role: 'system', content: this.systemPrompt() },
      { role: 'user', content: `Goal: ${task.title}\nDetails: ${task.description ?? ''}\n\nRepo context:\n${context}` },
    ];
  }

  async run(task: Task, ctx: AgentContext): Promise<AgentRunOutput> {
    ctx.emitActivity(`Planner: analyzing "${task.title}"`);

    // Use context engine to gather file groups if available
    let fileGroups: Array<{ area: string; files: string[] }> | undefined;
    try {
      const engine = new ContextEngine({ projectRoot: ctx.projectRoot });
      const selection = await engine.selectContext(task.title);
      fileGroups = selection.repo?.fileGroups;
      ctx.emitActivity(`Planner: found ${selection.rankedFiles.length} relevant files, ${selection.chunks.length} chunks`);
    } catch {
      // fallback without context
    }

    // Heuristic planning (deterministic, fast, no LLM needed)
    const graph = this.planner.planHeuristic({
      goal: `${task.title} ${task.description ?? ''}`.trim(),
      fileGroups,
    });

    // Also try LLM planning if provider messages exist? For now return heuristic
    const summary = `Planned ${Object.keys(graph.tasks).length} tasks for: ${task.title}\n` +
      Object.values(graph.tasks).map((t) => `  - [${t.agentRole ?? 'unassigned'}] ${t.title}${t.dependsOn.length ? ` (depends: ${t.dependsOn.join(', ')})` : ''}`).join('\n');

    return {
      success: true,
      summary,
      toolCalls: [],
      artifacts: [{ type: 'taskGraph', graph }],
    };
  }

  /** Expose planner for direct graph creation without agent context. */
  createGraph(goal: string, fileGroups?: Array<{ area: string; files: string[] }>): ReturnType<TaskPlanner['planHeuristic']> {
    return this.planner.planHeuristic({ goal, fileGroups });
  }
}
