import { z } from 'zod';
import { formatWorkspaceContext, loadWorkspaceInfo } from '@cluster/workspace';
import { defineTool, okResult } from '../types.js';

const schema = z.object({
  includeFileTree: z
    .boolean()
    .optional()
    .describe('Include a sample of the project file tree. Defaults to false.'),
});

export const workspaceInfoTool = defineTool<z.infer<typeof schema>>({
  name: 'workspace_info',
  description:
    'Report the detected project type, package manager, languages, git state and likely ' +
    'build/test/lint commands. Call this at the start of a task in an unfamiliar repository ' +
    'to learn how the project is meant to be built and verified.',
  schema,
  risk: 'safe',
  async execute(input, ctx) {
    // The context is already loaded at startup; only re-scan on demand.
    const info = ctx.workspace ?? (await loadWorkspaceInfo(ctx.projectRoot));
    const lines = [formatWorkspaceContext(info)];

    if (input.includeFileTree) {
      const { listDirectory } = await import('@cluster/workspace');
      const { entries } = await listDirectory(ctx.projectRoot, '.', { maxEntries: 60 });
      lines.push('', '## Root entries');
      for (const entry of entries) {
        lines.push(`- ${entry.type === 'directory' ? `${entry.name}/` : entry.name}`);
      }
    }

    return okResult(lines.join('\n'), info);
  },
});
