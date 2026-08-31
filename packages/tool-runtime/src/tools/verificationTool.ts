import { z } from 'zod';
import { defineTool, okResult, failResult } from '../types.js';
import { runVerification, discoverTests, selectRelevantTests, autoFixLoop } from '../verification.js';

const schema = z.object({
  command: z.string().optional().describe('Command to run (auto-discovered if omitted).'),
  kind: z.enum(['test', 'build', 'lint', 'format', 'typecheck', 'custom']).optional().describe('Verification kind for reporting.'),
  cwd: z.string().optional().describe('Working directory.'),
  autoFix: z.boolean().optional().describe('Whether to attempt auto-fix on lint/format failures.'),
  relevantOnly: z.boolean().optional().describe('If true, only run relevant tests based on changed files.'),
});

export const verifyTool = defineTool<z.infer<typeof schema>>({
  name: 'verify',
  description: 'Run verification: tests, build, lint, or typecheck. Discovers relevant commands and parses failures. Auto-fixes lint/format when possible.',
  schema,
  risk: 'safe',
  async execute(input, ctx) {
    const projectRoot = ctx.projectRoot;

    let command = input.command;
    if (!command) {
      const discovered = await discoverTests(projectRoot);
      // If relevantOnly, filter by git changed files
      if (input.relevantOnly) {
        // Try to get changed files via git diff
        let changed: string[] = [];
        try {
          const { execa } = await import('execa');
          const res = await execa('git', ['diff', '--name-only', 'HEAD'], { cwd: projectRoot, reject: false, timeout: 3000 });
          if (res.exitCode === 0) changed = res.stdout.split('\n').filter(Boolean);
        } catch {
          // ignore
        }
        const relevant = selectRelevantTests(changed, discovered);
        if (relevant.length === 0) {
          return okResult('No relevant verification needed for these changes.', { skipped: true, reason: 'no relevant tests' });
        }
        command = relevant[0];
      } else {
        command = discovered[0] ?? 'npm test --silent';
      }
    }

    const kind = input.kind as any ?? undefined;
    ctx.emitProgress(`Running verification: ${command}`);

    try {
      const run = await autoFixLoop({
        projectRoot,
        sessionId: ctx.sessionId,
        command,
        kind,
        cwd: input.cwd,
        autoFix: input.autoFix ?? true,
        emitOutput: (chunk) => ctx.emitOutput(chunk),
        signal: ctx.signal,
      });

      const result = run.result;
      const output = [
        `Verification: ${result.kind} — ${result.passed ? 'PASSED' : 'FAILED'}`,
        `Command: ${result.command}`,
        `Exit: ${result.exitCode} in ${result.durationMs}ms`,
        '',
        result.summary,
        ...(result.failures.length > 0 ? ['', 'Failures:', ...result.failures.map((f) => `  ${f.file ?? ''}${f.line ? `:${f.line}` : ''} ${f.message}`)] : []),
        ...(result.autoFixed ? ['', 'Auto-fixed formatting/lint issues.'] : []),
      ].join('\n');

      if (result.passed) {
        return okResult(output, { verification: result, autoFixed: result.autoFixed }, [{ type: 'log', lines: output.split('\n') }]);
      }
      return failResult(output, { code: 'verification_failed', data: { verification: result } });
    } catch (error) {
      return failResult(`Verification failed to run: ${(error as Error).message}`, { code: 'verification_error' });
    }
  },
});

const emptySchema = z.object({});
export const discoverTestsTool = defineTool<z.infer<typeof emptySchema>>({
  name: 'discover_tests',
  description: 'Discover available test/build/lint commands in the project.',
  schema: emptySchema,
  risk: 'safe',
  async execute(_input, ctx) {
    const tests = await discoverTests(ctx.projectRoot);
    const lines = ['Discovered verification commands:', ...tests.map((t) => `  - ${t}`)];
    return okResult(lines.join('\n'), { commands: tests });
  },
});
