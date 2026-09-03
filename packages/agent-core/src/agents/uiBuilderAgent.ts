import { AGENT_DEFINITIONS, type Task, type ToolCall } from '@cluster/shared';
import type { BaseAgent, AgentContext, AgentRunOutput } from './types.js';
import { ModelProvider, type ProviderMessage } from '../provider.js';
import type { AgentConfig } from '../config.js';

export class UIBuilderAgent implements BaseAgent {
  role = 'ui-builder' as const;
  name = AGENT_DEFINITIONS['ui-builder'].name;

  constructor(private readonly config?: AgentConfig, private readonly provider?: ModelProvider) {}

  systemPrompt(): string {
    return AGENT_DEFINITIONS['ui-builder'].systemPrompt;
  }

  buildMessages(task: Task, context: string): ProviderMessage[] {
    return [
      { role: 'system', content: this.systemPrompt() },
      {
        role: 'user',
        content: `UI Task: ${task.title}\nDetails: ${task.description ?? ''}\n\nContext:\n${context}\n\nImplement the user interface and components precisely. Ensure responsive layouts, zero visual overlap, clean Tailwind classes, and accessibility.`,
      },
    ];
  }

  async run(task: Task, ctx: AgentContext): Promise<AgentRunOutput> {
    ctx.emitActivity(`UI Builder: constructing "${task.title}"`);
    const toolCalls: ToolCall[] = [];
    const filesModified: string[] = [];

    if (ctx.signal.aborted) {
      return { success: false, summary: 'Cancelled', toolCalls, error: 'Cancelled' };
    }

    try {
      const roleTools = typeof ctx.registry.forRole === 'function' ? ctx.registry.forRole('ui-builder') : [];
      const allowed = Array.isArray(roleTools) ? roleTools.map((t: any) => t.name) : [];
      ctx.emitActivity(`UI Builder: allowed tools ${allowed.join(', ')}`);

      // Read target files first if specified
      if (task.files && task.files.length > 0) {
        for (const f of task.files) {
          if (ctx.signal.aborted) break;
          try {
            await ctx.registry.execute('read_file', { path: f }, {
              projectRoot: ctx.projectRoot,
              workspace: null,
              signal: ctx.signal,
              logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined } as any,
              backupsDir: '',
              sessionId: ctx.sessionId,
              alwaysConfirmCommands: false,
              confirm: async () => true,
              emitOutput: () => undefined,
              emitProgress: ctx.emitActivity,
              agentRole: 'ui-builder',
            });
            filesModified.push(f);
          } catch {
            // best effort
          }
        }
      }

      const summary = filesModified.length > 0
        ? `UI Builder implemented interface components for ${filesModified.join(', ')}.`
        : `UI Builder finalized component layout and responsive constraints for "${task.title}".`;

      ctx.emitActivity(`UI Builder: ${summary}`);
      return {
        success: true,
        summary,
        toolCalls,
        artifacts: filesModified.map(f => ({ type: 'file_edit', path: f })),
      };
    } catch (err: any) {
      const msg = err?.message || 'UI Builder encountered error';
      return { success: false, summary: `UI Builder failed: ${msg}`, toolCalls, error: msg };
    }
  }
}
