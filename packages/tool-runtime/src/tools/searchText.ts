import path from 'node:path';
import { z } from 'zod';
import { listFiles } from '@cluster/workspace';
import { defineTool, failResult, okResult } from '../types.js';
import { mapWithConcurrency, readTextFile, resolveToolPath } from '../util.js';

/**
 * Text search.
 *
 * Implemented in-process rather than shelling out to ripgrep so the tool works
 * identically on every platform and needs no external binary. Files are read
 * with a concurrency limit and a size ceiling, which keeps large repositories
 * responsive. A future phase can swap in ripgrep behind this same interface.
 */

const MAX_FILE_BYTES = 1024 * 1024;
const CONCURRENCY = 24;
const PROGRESS_INTERVAL = 250;

const schema = z.object({
  query: z.string().min(1).describe('Text or regular expression to search for.'),
  path: z
    .string()
    .optional()
    .describe('Restrict the search to this directory, or to a glob pattern.'),
  caseSensitive: z.boolean().optional().describe('Case-sensitive search. Defaults to false.'),
  regex: z.boolean().optional().describe('Treat the query as a regular expression. Defaults to false.'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe('Stop after this many matches. Defaults to 50.'),
});

interface Match {
  file: string;
  line: number;
  text: string;
}

function buildMatcher(query: string, useRegex: boolean, caseSensitive: boolean): RegExp | null {
  try {
    const source = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(source, caseSensitive ? '' : 'i');
  } catch {
    return null;
  }
}

export const searchTextTool = defineTool<z.infer<typeof schema>>({
  name: 'search_text',
  description:
    'Search the workspace for text or a regular expression and return matching lines with ' +
    'file paths and line numbers. Prefer this over reading many files when locating code.',
  schema,
  risk: 'safe',
  async execute(input, ctx) {
    const maxResults = input.maxResults ?? 50;
    const matcher = buildMatcher(input.query, input.regex ?? false, input.caseSensitive ?? false);

    if (!matcher) {
      return failResult(`"${input.query}" is not a valid regular expression.`, {
        code: 'invalid_regex',
        hint: 'Escape special characters, or set regex to false to search literally.',
      });
    }

    let pattern: string;
    if (input.path) {
      const resolved = resolveToolPath(ctx, input.path);
      if (!resolved.ok) return resolved.result;
      // A path containing glob metacharacters is used verbatim as a pattern.
      pattern = /[*?[\]{}]/.test(input.path)
        ? input.path
        : `${resolved.path.relative || '.'}/**/*`;
    } else {
      pattern = '**/*';
    }

    ctx.emitProgress(`Searching ${pattern}`);

    const listing = await listFiles(ctx.projectRoot, { pattern, maxFiles: 20_000 });
    const candidates = listing.files;
    const matches: Match[] = [];
    let scanned = 0;
    let stopped = false;

    await mapWithConcurrency(candidates, CONCURRENCY, async (relative) => {
      if (stopped) return;
      scanned += 1;
      if (scanned % PROGRESS_INTERVAL === 0) {
        ctx.emitProgress(`Searched ${scanned}/${candidates.length} files, ${matches.length} matches`);
      }

      const absolute = path.join(ctx.projectRoot, relative);
      try {
        const { content } = await readTextFile(absolute, MAX_FILE_BYTES);
        if (content === null || content.includes('\0')) return;

        const lines = content.split('\n');
        for (let index = 0; index < lines.length; index += 1) {
          if (matcher.test(lines[index]!)) {
            matches.push({ file: relative, line: index + 1, text: (lines[index] ?? '').trimEnd() });
            if (matches.length >= maxResults) {
              stopped = true;
              break;
            }
          }
        }
      } catch {
        // Unreadable files are skipped, not fatal.
      }

      if (matches.length >= maxResults) stopped = true;
    });

    if (matches.length === 0) {
      return okResult(
        `No matches for "${input.query}" (searched ${scanned} files).`,
        { query: input.query, matches: [], scanned },
      );
    }

    const lines = [
      `${matches.length} match${matches.length === 1 ? '' : 'es'} for "${input.query}" in ${scanned} files`,
      '',
      ...matches.map((match) => `${match.file}:${match.line}: ${match.text}`),
    ];
    if (stopped) lines.push('', `Results capped at ${maxResults}. Narrow the search to see more.`);

    return okResult(lines.join('\n'), { query: input.query, matches, scanned });
  },
});
