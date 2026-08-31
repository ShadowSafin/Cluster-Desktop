import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { applyUnifiedDiff, diffLines, formatUnifiedDiff } from '@cluster/shared';
import { createBackup } from '@cluster/storage';
import { defineTool, failResult, okResult } from '../types.js';
import { classifyPath } from '../safety.js';
import { describeFsError, pathExists, readTextFile, resolveToolPath } from '../util.js';

const MAX_BYTES = 2 * 1024 * 1024;

const schema = z
  .object({
    path: z.string().min(1).describe('Path to the file, relative to the project root.'),
    edits: z
      .array(
        z.object({
          oldText: z.string().min(1).describe('Exact text to find, including whitespace and indentation.'),
          newText: z.string().describe('Replacement text. Use an empty string to delete.'),
          replaceAll: z
            .boolean()
            .optional()
            .describe('Replace every occurrence. Required when oldText appears more than once.'),
        }),
      )
      .min(1)
      .optional()
      .describe('One or more exact find-and-replace operations. Mutually exclusive with unifiedDiff.'),
    unifiedDiff: z
      .string()
      .min(1)
      .optional()
      .describe('A complete unified diff to apply. Mutually exclusive with edits.'),
    dryRun: z
      .boolean()
      .optional()
      .describe('Compute and return the diff without writing anything. Use this to preview a risky change.'),
  })
  .refine((value) => Boolean(value.edits) !== Boolean(value.unifiedDiff), {
    message: 'Provide exactly one of "edits" or "unifiedDiff".',
    path: ['edits'],
  });

type Input = z.infer<typeof schema>;

function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/** Small excerpt around a failed match, to make the error actionable. */
function excerpt(content: string, needle: string): string {
  const head = needle.slice(0, 40);
  const position = content.indexOf(head);
  if (position === -1) return 'The first 40 characters of oldText were not found anywhere in the file.';
  return `Nearest context: …${content.slice(Math.max(0, position - 60), position + 120).replace(/\n/g, '\\n')}…`;
}

export const patchFileTool = defineTool<Input>({
  name: 'patch_file',
  description:
    'Apply precise edits to an existing file using exact find-and-replace, or a unified diff. ' +
    'This is the preferred way to change code: it touches only the lines you specify. ' +
    'The file must already exist; use write_file to create new files.',
  schema,
  risk: (input) => {
    const pathRisk = classifyPath(input.path).risk;
    if (pathRisk !== 'safe') return pathRisk;
    return input.dryRun ? 'safe' : 'caution';
  },
  async preview(input, ctx) {
    const resolved = resolveToolPath(ctx, input.path);
    if (!resolved.ok) return input.path;
    const original = (await readTextFile(resolved.path.absolute, MAX_BYTES)).content;
    if (original === null) return `Create ${resolved.path.display}`;
    const applied = applyPatch(original, input);
    if (!applied.ok) return `Cannot preview: ${applied.error}`;
    return formatUnifiedDiff(resolved.path.display, original, applied.content);
  },
  async execute(input, ctx) {
    const resolved = resolveToolPath(ctx, input.path);
    if (!resolved.ok) return resolved.result;
    const target = resolved.path;

    const exists = await pathExists(target.absolute);
    if (!exists) {
      return failResult(`Cannot patch ${target.display}: file does not exist.`, {
        code: 'ENOENT',
        hint: 'Use write_file to create the file first, or check the path.',
        data: { path: target.display },
      });
    }

    let original: string;
    try {
      original = (await readTextFile(target.absolute, MAX_BYTES)).content ?? '';
    } catch (error) {
      return describeFsError(error, target);
    }

    const applied = applyPatch(original, input);
    if (!applied.ok) {
      return failResult(`Patch rejected for ${target.display}: ${applied.error}`, {
        code: 'invalid_patch',
        hint: 'Re-read the file and regenerate the patch against its current contents.',
        data: { path: target.display },
      });
    }

    if (applied.content === original) {
      return okResult(`No changes: the patch did not alter ${target.display}.`, {
        path: target.display,
        changed: false,
      });
    }

    const diff = formatUnifiedDiff(target.display, original, applied.content);
    const { additions, deletions } = diffLines(original, applied.content);

    if (input.dryRun) {
      return okResult(
        `Dry run for ${target.display} (+${additions} -${deletions}). Nothing was written.`,
        { path: target.display, dryRun: true, additions, deletions, diff },
        [{ type: 'diff', path: target.display, diff }],
      );
    }

    try {
      const backup = await createBackup(ctx.projectRoot, ctx.backupsDir, target.absolute, original);
      await fs.mkdir(path.dirname(target.absolute), { recursive: true });
      await fs.writeFile(target.absolute, applied.content, 'utf8');

      return okResult(
        `Patched ${target.display} (+${additions} -${deletions})`,
        {
          path: target.display,
          changed: true,
          additions,
          deletions,
          backupPath: backup.backupPath,
          diff,
        },
        [
          { type: 'diff', path: target.display, diff },
          { type: 'file', path: target.display, action: 'written' },
        ],
      );
    } catch (error) {
      return describeFsError(error, target);
    }
  },
});

function applyPatch(
  original: string,
  input: Input,
): { ok: true; content: string } | { ok: false; error: string } {
  if (input.unifiedDiff) {
    const applied = applyUnifiedDiff(original, input.unifiedDiff);
    return applied.ok ? { ok: true, content: applied.content } : { ok: false, error: applied.error ?? 'unknown error' };
  }

  let content = original;

  for (const [index, edit] of (input.edits ?? []).entries()) {
    const occurrences = countOccurrences(content, edit.oldText);

    if (occurrences === 0) {
      return {
        ok: false,
        error: `edit ${index + 1}: oldText was not found. ${excerpt(content, edit.oldText)}`,
      };
    }
    if (occurrences > 1 && !edit.replaceAll) {
      return {
        ok: false,
        error:
          `edit ${index + 1}: oldText occurs ${occurrences} times. ` +
          `Provide more surrounding context to make it unique, or set replaceAll to true.`,
      };
    }

    if (edit.replaceAll) {
      content = content.split(edit.oldText).join(edit.newText);
    } else {
      // A function replacer prevents `$&`, `$1` etc. in newText being
      // interpreted as replacement patterns.
      content = content.replace(edit.oldText, () => edit.newText);
    }
  }

  return { ok: true, content };
}
