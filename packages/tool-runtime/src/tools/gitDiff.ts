import { z } from 'zod';
import { execa } from 'execa';
import { defineTool, okResult, failResult } from '../types.js';
import { formatUnifiedDiff } from '@cluster/shared';

const schema = z.object({
  base: z.string().optional().describe('Base ref to diff against (default: HEAD). Use "staged" for staged changes.'),
  path: z.string().optional().describe('Limit diff to a specific path.'),
  statOnly: z.boolean().optional().describe('If true, only return diff stat, not content.'),
});

export const gitDiffTool = defineTool<z.infer<typeof schema>>({
  name: 'git_diff',
  description: 'Show git diff for the working tree or a specific ref. Useful for understanding recent changes before making more edits.',
  schema,
  risk: 'safe',
  async execute(input, ctx) {
    const args: string[] = [];
    if (input.statOnly) {
      args.push('diff', '--stat');
    } else {
      args.push('diff');
    }
    if (input.base && input.base !== 'staged') {
      args.push(input.base);
    } else if (input.base === 'staged') {
      args.splice(1, 0, '--staged');
    }
    if (input.path) args.push('--', input.path);

    try {
      const result = await execa('git', args, { cwd: ctx.projectRoot, reject: false, timeout: 8000 });
      if (result.exitCode !== 0 && result.stderr) {
        return failResult(`git diff failed: ${result.stderr.slice(0, 500)}`, { code: 'git_error' });
      }
      const output = result.stdout ?? '';
      if (output.trim() === '') {
        return okResult('No changes.', { diff: '', empty: true });
      }
      const preview = output.length > 40_000 ? `${output.slice(0, 40_000)}\n… truncated …` : output;
      return okResult(preview, { diff: output, empty: false }, [{ type: 'log', lines: preview.split('\n').slice(0, 50) }]);
    } catch (error) {
      return failResult(`git diff failed: ${(error as Error).message}`, { code: 'git_error' });
    }
  },
});
