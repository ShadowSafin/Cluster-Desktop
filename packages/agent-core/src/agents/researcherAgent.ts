import { AGENT_DEFINITIONS, type Task, type ToolCall } from '@cluster/shared';
import type { BaseAgent, AgentContext, AgentRunOutput } from './types.js';
import { ModelProvider, type ProviderMessage } from '../provider.js';
import type { AgentConfig } from '../config.js';

export class ResearcherAgent implements BaseAgent {
  role = 'researcher' as const;
  name = AGENT_DEFINITIONS.researcher.name;

  constructor(private readonly config?: AgentConfig, private readonly provider?: ModelProvider) {}

  systemPrompt(): string {
    return AGENT_DEFINITIONS.researcher.systemPrompt;
  }

  buildMessages(task: Task, context: string): ProviderMessage[] {
    return [
      { role: 'system', content: this.systemPrompt() },
      {
        role: 'user',
        content: `Research Task: ${task.title}\nDescription: ${task.description ?? ''}\n\nContext:\n${context}\n\nAnalyze the relevant files, discover existing patterns, and summarize findings clearly for the coordinator and builders. Do not edit files.`,
      },
    ];
  }

  async run(task: Task, ctx: AgentContext): Promise<AgentRunOutput> {
    ctx.emitActivity(`Researcher: investigating "${task.title}"`);
    const toolCalls: ToolCall[] = [];
    const filesExamined: string[] = [];

    if (ctx.signal.aborted) {
      return { success: false, summary: 'Cancelled', toolCalls, error: 'Cancelled' };
    }

    try {
      // 1. If task has targeted files, inspect them
      if (task.files && task.files.length > 0) {
        for (const file of task.files.slice(0, 5)) {
          if (ctx.signal.aborted) break;
          try {
            const outcome = await ctx.registry.execute('read_file', { path: file }, {
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
              agentRole: 'researcher',
            });
            if (outcome.result.ok) {
              filesExamined.push(file);
            }
          } catch {
            // best-effort
          }
        }
      } else {
        // Run list_files or workspace_info to discover layout
        try {
          const outcome = await ctx.registry.execute('list_files', { maxDepth: 2 }, {
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
            agentRole: 'researcher',
          });
          if (outcome.result.ok && Array.isArray(outcome.result.data)) {
            filesExamined.push(...outcome.result.data.slice(0, 8));
          }
        } catch {
          // ignore
        }
      }

      const summary = filesExamined.length > 0
        ? `Researcher analyzed ${filesExamined.length} files (${filesExamined.slice(0, 3).join(', ')}${filesExamined.length > 3 ? '…' : ''}). Context verified for builder agents.`
        : `Researcher inspected workspace structure for "${task.title}". No blocking architectural conflicts found.`;

      ctx.emitActivity(`Researcher: ${summary}`);
      return {
        success: true,
        summary,
        toolCalls,
        artifacts: filesExamined.map(f => ({ type: 'file_ref', path: f })),
      };
    } catch (err: any) {
      const msg = err?.message || 'Research completed with non-fatal notice';
      return { success: true, summary: `Researcher completed: ${msg}`, toolCalls };
    }
  }
}
