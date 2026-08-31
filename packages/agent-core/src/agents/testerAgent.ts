import { AGENT_DEFINITIONS } from '@cluster/shared';
import { runVerification, autoFixLoop, discoverTests } from '@cluster/tool-runtime';
import type { BaseAgent, AgentContext, AgentRunOutput } from './types.js';

export class TesterAgent implements BaseAgent {
  role = 'tester' as const;
  name = AGENT_DEFINITIONS.tester.name;

  systemPrompt(): string {
    return AGENT_DEFINITIONS.tester.systemPrompt;
  }

  buildMessages(task: import('@cluster/shared').Task): import('../provider.js').ProviderMessage[] {
    return [
      { role: 'system', content: this.systemPrompt() },
      { role: 'user', content: `Verification task: ${task.title}\n${task.description ?? ''}\nRun relevant tests and checks, parse failures, attempt auto-fix.` },
    ];
  }

  async run(task: import('@cluster/shared').Task, ctx: AgentContext): Promise<AgentRunOutput> {
    ctx.emitActivity(`Tester: verifying "${task.title}"`);

    let summary = '';
    let success = true;

    try {
      // Discover commands
      const commands = await discoverTests(ctx.projectRoot);
      ctx.emitActivity(`Tester: discovered ${commands.join(', ')}`);

      // Run verification via registry's verify tool if present, otherwise direct
      const verifyTool = ctx.registry.get('verify');
      if (verifyTool) {
        const outcome = await ctx.registry.execute('verify', { relevantOnly: true, autoFix: true }, {
          projectRoot: ctx.projectRoot,
          workspace: null,
          signal: ctx.signal,
          logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined } as any,
          backupsDir: '',
          sessionId: ctx.sessionId,
          alwaysConfirmCommands: false,
          confirm: async () => true,
          emitOutput: (chunk) => ctx.emitActivity(chunk.slice(0, 200)),
          emitProgress: ctx.emitActivity,
          agentRole: 'tester',
        });
        summary = outcome.result.output.slice(0, 1000);
        success = outcome.result.ok;
        ctx.emitActivity(`Tester: verify ${success ? 'passed' : 'failed'}`);
      } else {
        // Direct verification
        const run = await autoFixLoop({
          projectRoot: ctx.projectRoot,
          sessionId: ctx.sessionId,
          signal: ctx.signal,
          emitOutput: (chunk) => ctx.emitActivity(chunk.slice(0, 200)),
        });
        summary = run.summary;
        success = run.result.passed;
        if (run.result.failures.length) {
          summary += `\nFailures: ${run.result.failures.map((f) => f.message).join('; ')}`;
        }
      }
    } catch (error) {
      summary = `Verification failed: ${(error as Error).message}`;
      success = false;
    }

    const plain = success ? `✓ Verification passed for "${task.title}"` : `✗ Verification failed for "${task.title}": ${summary.slice(0, 400)}`;

    return {
      success,
      summary: plain,
      toolCalls: [],
      artifacts: [{ type: 'verification', summary }],
      error: success ? undefined : summary,
    };
  }
}
