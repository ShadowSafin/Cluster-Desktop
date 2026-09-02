import { z } from 'zod';
import { defineTool, failResult, okResult } from '../types.js';
import { describeFsError, readTextFile, resolveToolPath } from '../util.js';

const MAX_BYTES = 512 * 1024;
const MAX_LINES_DEFAULT = 2000;

const schema = z.object({
  path: z.string().min(1).describe('Path to the file, relative to the project root.'),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Zero-based line index to start reading from. Defaults to 0.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .describe(`Maximum number of lines to return. Defaults to ${MAX_LINES_DEFAULT}.`),
  reason: z
    .string()
    .optional()
    .describe('Short explanation of why this file is being inspected (e.g. "checking component imports", "inspecting router setup").'),
});

export const readFileTool = defineTool<z.infer<typeof schema>>({
  name: 'read_file',
  description:
    'Read the contents of a file with line numbers. Use this before editing anything. ' +
    'Large files are truncated; use offset/limit to page through them.',
  schema,
  risk: 'safe',
  async execute(input, ctx) {
    const resolved = resolveToolPath(ctx, input.path);
    if (!resolved.ok) return resolved.result;

    try {
      const { content, truncated, size } = await readTextFile(resolved.path.absolute, MAX_BYTES);

      if (content === null) {
        return failResult(`File not found: ${resolved.path.display}`, {
          code: 'ENOENT',
          hint: 'Use list_files to discover the correct path.',
          data: { path: resolved.path.display },
        });
      }

      // Binary files would corrupt the transcript; refuse them explicitly.
      if (content.includes('\0')) {
        return failResult(`${resolved.path.display} appears to be a binary file and was not read.`, {
          code: 'binary_file',
          hint: 'Use search_text with a narrow pattern if you need to inspect it.',
          data: { path: resolved.path.display, size },
        });
      }

      const allLines = content.split('\n');
      if (allLines.length > 0 && allLines[allLines.length - 1] === '') allLines.pop();

      const offset = input.offset ?? 0;
      const limit = input.limit ?? MAX_LINES_DEFAULT;
      const slice = allLines.slice(offset, offset + limit);
      const width = String(offset + slice.length).length;

      const numbered = slice.map((line, index) => `${String(offset + index + 1).padStart(width, ' ')} | ${line}`);

      const header: string[] = [`File: ${resolved.path.display} (${allLines.length} lines total)`];
      if (input.reason) header.unshift(`Why: ${input.reason}`);
      if (truncated) header.push(`Note: file is larger than ${MAX_BYTES} bytes; only the beginning was read.`);
      if (offset > 0 || slice.length < allLines.length) {
        header.push(`Showing lines ${offset + 1}-${offset + slice.length}.`);
      }

      return okResult(
        [...header, '', ...numbered].join('\n'),
        {
          path: resolved.path.display,
          totalLines: allLines.length,
          returnedLines: slice.length,
          truncated,
          reason: input.reason,
        },
        [{ type: 'file', path: resolved.path.display, action: 'read' }],
      );
    } catch (error) {
      return describeFsError(error, resolved.path);
    }
  },
});
