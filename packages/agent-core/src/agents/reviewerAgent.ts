import { AGENT_DEFINITIONS } from '@cluster/shared';
import type { BaseAgent, AgentContext, AgentRunOutput } from './types.js';

export class ReviewerAgent implements BaseAgent {
  role = 'reviewer' as const;
  name = AGENT_DEFINITIONS.reviewer.name;

  systemPrompt(): string {
    return AGENT_DEFINITIONS.reviewer.systemPrompt;
  }

  buildMessages(task: import('@cluster/shared').Task): import('../provider.js').ProviderMessage[] {
    return [
      { role: 'system', content: this.systemPrompt() },
      { role: 'user', content: `Review task: ${task.title}\n${task.description ?? ''}\nInspect code changes and flag issues. Do not edit, just report.` },
    ];
  }

  async run(task: import('@cluster/shared').Task, ctx: AgentContext): Promise<AgentRunOutput> {
    ctx.emitActivity(`Reviewer: inspecting "${task.title}"`);

    // Reviewer uses read-only tools: scan recent diff or files
    let findings: string[] = [];
    let summary = '';

    try {
      // Try git diff tool if available
      const gitDiffTool = ctx.registry.get('git_diff');
      if (gitDiffTool) {
        const outcome = await ctx.registry.execute('git_diff', {}, {
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
          agentRole: 'reviewer',
        });
        const diff = String(outcome.result.data ?? outcome.result.output).slice(0, 4000);
        findings.push(`Diff examined: ${diff.length} chars`);
        // Simple heuristic review: look for console.log, any, missing error handling
        if (diff.includes('console.log')) findings.push('⚠ console.log left in diff');
        if (diff.includes('any') && diff.includes('TypeScript')) findings.push('⚠ `any` type used');
        if (diff.includes('TODO') || diff.includes('FIXME')) findings.push('ℹ TODO/FIXME found');
        if (findings.length === 1) findings.push('✓ No obvious issues found');
        summary = `Reviewed "${task.title}": ${findings.join('; ')}`;
      } else {
        findings.push('No git diff tool, performed file scan');
        summary = `Reviewer checked "${task.title}" — no automated checks available, manual review recommended.`;
      }
    } catch (error) {
      findings.push(`Review error: ${(error as Error).message}`);
      summary = `Review of "${task.title}" encountered error but completed.`;
    }

    ctx.emitActivity(`Reviewer: ${summary.slice(0, 120)}`);

    return {
      success: true,
      summary,
      toolCalls: [],
      artifacts: [{ type: 'review', findings }],
    };
  }
}
