import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { diffLines, formatUnifiedDiff } from '@cluster/shared';
import { createBackup } from '@cluster/storage';
import { defineTool, failResult, okResult } from '../types.js';
import { classifyPath } from '../safety.js';
import { describeFsError, pathExists, readTextFile, resolveToolPath } from '../util.js';

const MAX_BYTES = 2 * 1024 * 1024;

const schema = z.object({
  path: z.string().min(1).describe('Path to write, relative to the project root.'),
  content: z.string().describe('Full file contents.'),
  createOnly: z
    .boolean()
    .optional()
    .describe('Fail if the file already exists. Use this to avoid clobbering existing code.'),
});

type Input = z.infer<typeof schema>;

export const writeFileTool = defineTool<Input>({
  name: 'write_file',
  description:
    'Create a new file or replace the entire contents of an existing one. ' +
    'Prefer patch_file for changing part of an existing file.',
  schema,
  // Overwriting is recoverable (we back it up) but never silent.
  risk: (input) => {
    const pathRisk = classifyPath(input.path).risk;
    return pathRisk === 'safe' ? 'caution' : pathRisk;
  },
  async preview(input, ctx) {
    const resolved = resolveToolPath(ctx, input.path);
    if (!resolved.ok) return input.path;
    const previous = (await readTextFile(resolved.path.absolute, MAX_BYTES)).content ?? '';
    if (previous === '') return `Create ${resolved.path.display} (${input.content.split('\n').length} lines)`;
    return formatUnifiedDiff(resolved.path.display, previous, input.content);
  },
  async execute(input, ctx) {
    const resolved = resolveToolPath(ctx, input.path);
    if (!resolved.ok) return resolved.result;
    const target = resolved.path;

    if (Buffer.byteLength(input.content, 'utf8') > MAX_BYTES) {
      return failResult(`Content exceeds the ${MAX_BYTES} byte limit for a single write.`, {
        code: 'too_large',
        hint: 'Write the file in smaller pieces, or use patch_file to append.',
      });
    }

    const exists = await pathExists(target.absolute);

    if (exists && input.createOnly) {
      return failResult(`${target.display} already exists and createOnly was requested.`, {
        code: 'already_exists',
        hint: 'Read the file and use patch_file to modify it instead.',
        data: { path: target.display },
      });
    }

    const previous = exists ? (await readTextFile(target.absolute, MAX_BYTES)).content ?? '' : '';

    try {
      let backupPath: string | undefined;
      if (exists) {
        const backup = await createBackup(ctx.projectRoot, ctx.backupsDir, target.absolute, previous);
        backupPath = backup.backupPath;
      }

      await fs.mkdir(path.dirname(target.absolute), { recursive: true });
      await fs.writeFile(target.absolute, input.content, 'utf8');

      const diff = formatUnifiedDiff(target.display, previous, input.content);
      const { additions, deletions } = diffLines(previous, input.content);

      const summary = exists
        ? `Updated ${target.display} (+${additions} -${deletions})`
        : `Created ${target.display} (+${additions} lines)`;

      return okResult(
        summary,
        {
          path: target.display,
          created: !exists,
          additions,
          deletions,
          backupPath,
          diff,
        },
        [
          { type: 'diff', path: target.display, diff },
          { type: 'file', path: target.display, action: exists ? 'written' : 'created' },
        ],
      );
    } catch (error) {
      return describeFsError(error, target);
    }
  },
});

