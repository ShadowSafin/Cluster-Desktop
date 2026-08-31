import { z } from 'zod';
import { formatGitState, readGitPorcelain, readGitState } from '@cluster/workspace';
import { defineTool, failResult, okResult } from '../types.js';

const schema = z.object({
  includeFiles: z
    .boolean()
    .optional()
    .describe('Include the raw list of changed files. Defaults to false.'),
});

export const gitStatusTool = defineTool<z.infer<typeof schema>>({
  name: 'git_status',
  description:
    'Report the current git branch, whether the working tree has uncommitted changes, ' +
    'and how many files are staged, modified or untracked. Call this before and after ' +
    'making changes so the diff stays attributable.',
  schema,
  risk: 'safe',
  async execute(input, ctx) {
    const state = await readGitState(ctx.projectRoot);

    if (!state) {
      return failResult('This directory is not a git repository.', {
        code: 'not_a_repo',
        hint: 'Do not attempt git operations here.',
      });
    }

    const lines = [
      `Branch: ${state.branch}${state.head ? ` @ ${state.head}` : ''}`,
      `Working tree: ${state.dirty ? 'dirty' : 'clean'} (${state.staged} staged, ${state.unstaged} modified, ${state.untracked} untracked)`,
      `Summary: ${formatGitState(state)}`,
    ];
    if (state.lastCommit) lines.push(`Last commit: ${state.lastCommit}`);

    if (input.includeFiles) {
      const porcelain = await readGitPorcelain(ctx.projectRoot);
      if (porcelain) {
        lines.push('', 'Changed files:', porcelain);
      }
    }

    return okResult(lines.join('\n'), state);
  },
});
