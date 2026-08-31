import { z } from 'zod';
import { listDirectory, listFiles } from '@cluster/workspace';
import { defineTool, failResult, okResult } from '../types.js';
import { isDirectory, resolveToolPath } from '../util.js';

const schema = z.object({
  path: z
    .string()
    .optional()
    .describe('Directory to list, relative to the project root. Defaults to the project root.'),
  pattern: z
    .string()
    .optional()
    .describe('Glob pattern to match instead of listing one directory, e.g. "src/**/*.ts".'),
  maxEntries: z
    .number()
    .int()
    .min(1)
    .max(2000)
    .optional()
    .describe('Maximum number of entries to return. Defaults to 200.'),
});

export const listFilesTool = defineTool<z.infer<typeof schema>>({
  name: 'list_files',
  description:
    'List the contents of a directory, or find files matching a glob pattern. ' +
    'Use this to explore an unfamiliar part of the codebase before reading files.',
  schema,
  risk: 'safe',
  async execute(input, ctx) {
    const maxEntries = input.maxEntries ?? 200;

    // Glob mode: the pattern already implies a recursive search.
    if (input.pattern) {
      const result = await listFiles(ctx.projectRoot, {
        pattern: input.pattern,
        maxFiles: maxEntries,
      });

      if (result.files.length === 0) {
        return okResult(
          `No files matched "${input.pattern}".`,
          { pattern: input.pattern, count: 0 },
          [{ type: 'log', lines: [`no match: ${input.pattern}`] }],
        );
      }

      const shown = result.files.slice(0, maxEntries);
      const lines = [
        `Pattern: ${input.pattern} — ${result.total} match${result.total === 1 ? '' : 'es'}`,
        '',
        ...shown,
      ];
      if (result.total > shown.length) lines.push(`… ${result.total - shown.length} more`);

      return okResult(lines.join('\n'), { pattern: input.pattern, files: shown, total: result.total });
    }

    // Directory mode.
    const target = input.path ?? '.';
    const resolved = resolveToolPath(ctx, target);
    if (!resolved.ok) return resolved.result;

    if (!(await isDirectory(resolved.path.absolute))) {
      return failResult(`Not a directory: ${resolved.path.display}`, {
        code: 'ENOTDIR',
        hint: 'Pass a directory path, or use the "pattern" argument to glob.',
      });
    }

    const { entries } = await listDirectory(ctx.projectRoot, resolved.path.relative, {
      maxEntries,
    });

    if (entries.length === 0) {
      return okResult(`Directory is empty: ${resolved.path.display}`, { path: resolved.path.display, entries: [] });
    }

    const lines = [`Directory: ${resolved.path.display}`, ''];
    for (const entry of entries) {
      if (entry.type === 'directory') {
        lines.push(`  ${entry.relativePath}/`);
      } else {
        const size = entry.size === null ? '' : `  (${entry.size} B)`;
        lines.push(`  ${entry.relativePath}${size}`);
      }
    }

    return okResult(lines.join('\n'), { path: resolved.path.display, entries });
  },
});
