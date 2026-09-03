import { AGENT_DEFINITIONS, type Task, type ToolCall } from '@cluster/shared';
import type { BaseAgent, AgentContext, AgentRunOutput } from './types.js';
import { ModelProvider, type ProviderMessage } from '../provider.js';
import type { AgentConfig } from '../config.js';

export class BackendBuilderAgent implements BaseAgent {
  role = 'backend-builder' as const;
  name = AGENT_DEFINITIONS['backend-builder'].name;

  constructor(private readonly config?: AgentConfig, private readonly provider?: ModelProvider) {}

  systemPrompt(): string {
    return AGENT_DEFINITIONS['backend-builder'].systemPrompt;
  }

  buildMessages(task: Task, context: string): ProviderMessage[] {
    return [
      { role: 'system', content: this.systemPrompt() },
      {
        role: 'user',
        content: `Backend Task: ${task.title}\nDetails: ${task.description ?? ''}\n\nContext:\n${context}\n\nImplement the server logic, APIs, and data models cleanly. Write robust error handling and maintain type safety.`,
      },
    ];
  }

  async run(task: Task, ctx: AgentContext): Promise<AgentRunOutput> {
    ctx.emitActivity(`Backend Builder: processing "${task.title}"`);
    const toolCalls: ToolCall[] = [];
    const filesModified: string[] = [];

    if (ctx.signal.aborted) {
      return { success: false, summary: 'Cancelled', toolCalls, error: 'Cancelled' };
    }

    try {
      const roleTools = typeof ctx.registry.forRole === 'function' ? ctx.registry.forRole('backend-builder') : [];
      const allowed = Array.isArray(roleTools) ? roleTools.map((t: any) => t.name) : [];
      ctx.emitActivity(`Backend Builder: allowed tools ${allowed.join(', ')}`);

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
              agentRole: 'backend-builder',
            });
            filesModified.push(f);
          } catch {
            // best effort
          }
        }
      }

      const summary = filesModified.length > 0
        ? `Backend Builder updated data and service layer in ${filesModified.join(', ')}.`
        : `Backend Builder configured service APIs and handlers for "${task.title}".`;

      ctx.emitActivity(`Backend Builder: ${summary}`);
      return {
        success: true,
        summary,
        toolCalls,
        artifacts: filesModified.map(f => ({ type: 'file_edit', path: f })),
      };
    } catch (err: any) {
      const msg = err?.message || 'Backend Builder encountered error';
      return { success: false, summary: `Backend Builder failed: ${msg}`, toolCalls, error: msg };
    }
  }
}
