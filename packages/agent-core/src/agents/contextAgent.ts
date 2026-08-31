import { AGENT_DEFINITIONS } from '@cluster/shared';
import { ContextEngine } from '@cluster/context-engine';
import type { BaseAgent, AgentContext, AgentRunOutput } from './types.js';

export class ContextAgent implements BaseAgent {
  role = 'context' as const;
  name = AGENT_DEFINITIONS.context.name;

  systemPrompt(): string {
    return AGENT_DEFINITIONS.context.systemPrompt;
  }

  buildMessages(task: import('@cluster/shared').Task): import('../provider.js').ProviderMessage[] {
    return [
      { role: 'system', content: this.systemPrompt() },
      { role: 'user', content: `Context task: ${task.title}\n${task.description ?? ''}` },
    ];
  }

  async run(task: import('@cluster/shared').Task, ctx: AgentContext): Promise<AgentRunOutput> {
    ctx.emitActivity(`Context: gathering intelligence for "${task.title}"`);
    const engine = new ContextEngine({ projectRoot: ctx.projectRoot, maxFiles: 12, maxTokens: 28000 });

    let selection;
    try {
      selection = await engine.selectContext(`${task.title} ${task.description ?? ''}`);
    } catch (error) {
      return { success: false, summary: `Context failed: ${(error as Error).message}`, toolCalls: [], error: String(error) };
    }

    const summary = [
      `Context gathered for: ${task.title}`,
      selection.summary,
      '',
      'Top files:',
      ...selection.rankedFiles.slice(0, 6).map((f) => `  ${f.path} (score ${f.score}) — ${f.reasons.join(', ')}`),
      '',
      selection.chunks.length ? `Relevant chunks: ${selection.chunks.length}` : '',
      ...selection.chunks.slice(0, 2).map((c) => `  ${c.path}:${c.startLine}-${c.endLine} (${c.tokenEstimate} tokens)`),
      '',
      `Symbols: ${selection.symbols.slice(0, 8).map((s) => s.name).join(', ')}`,
    ].filter(Boolean).join('\n');

    ctx.emitActivity(`Context: ranked ${selection.rankedFiles.length} files, ${selection.symbols.length} symbols`);

    return {
      success: true,
      summary,
      toolCalls: [],
      artifacts: [{ type: 'context', selection }],
    };
  }
}
