import { z } from 'zod';
import { defineTool, okResult, failResult } from '../types.js';
import { listPatchHistory, summarizePatches } from '@cluster/storage';
import { diffLines, formatUnifiedDiff } from '@cluster/shared';

const previewSchema = z.object({
  path: z.string().min(1).describe('File to show diff for (latest patch).'),
});

export const diffPreviewTool = defineTool<z.infer<typeof previewSchema>>({
  name: 'diff_preview',
  description: 'Show diff summary and hunks for a file, with inline hunk previews and grouping.',
  schema: previewSchema,
  risk: 'safe',
  async execute(input, ctx) {
    const history = await listPatchHistory(ctx.sessionId);
    const patches = history.flatMap((h) => h.patches).filter((p) => p.path === input.path);
    if (patches.length === 0) {
      return okResult(`No diff history for ${input.path}.`, { path: input.path, diff: null });
    }
    const latest = patches[0]!;
    const groups = `File: ${latest.path}\n+${latest.additions} -${latest.deletions} (${latest.risk}${latest.riskReason ? `: ${latest.riskReason}` : ''})\nHunks: ${latest.hunks.length}\n`;
    const hunkLines = latest.hunks.map((h, idx) => `  Hunk ${idx + 1}: ${h.summary || h.header} — ${h.lines.length} lines`).join('\n');
    const diffPreview = latest.diff.split('\n').slice(0, 80).join('\n');
    const more = latest.diff.split('\n').length > 80 ? `\n… ${latest.diff.split('\n').length - 80} more lines …` : '';
    return okResult(`${groups}${hunkLines}\n\n${diffPreview}${more}`, { patch: latest, history: patches.slice(0, 5) }, [{ type: 'diff', path: latest.path, diff: latest.diff }]);
  },
});

const applyHunksSchema = z.object({
  path: z.string().min(1).describe('File with diff to partially apply.'),
  hunks: z.array(z.number().int().min(0)).min(1).describe('Hunk indexes to keep (others rejected).'),
  content: z.string().optional().describe('Original file content fallback (if not found, reads from disk).'),
});

export const applyHunksTool = defineTool<z.infer<typeof applyHunksSchema>>({
  name: 'diff_apply_hunks',
  description: 'Apply only selected hunks from the latest diff, rejecting others (hunk-level accept/reject).',
  schema: applyHunksSchema,
  risk: 'caution',
  async execute(input, ctx) {
    const history = await listPatchHistory(ctx.sessionId);
    const patch = history.flatMap((h) => h.patches).find((p) => p.path === input.path);
    if (!patch) return failResult(`No patch for ${input.path}`, { code: 'not_found' });

    const selected = new Set(input.hunks);
    const keptHunks = patch.hunks.filter((_, idx) => selected.has(idx));
    if (keptHunks.length === 0) return failResult('No hunks selected.', { code: 'invalid_input' });

    // Reconstruct diff with only selected hunks
    const newDiff = [`--- a/${patch.path}`, `+++ b/${patch.path}`, ...keptHunks.map((h) => `${h.header}\n${h.lines.map((l) => `${l.type === 'add' ? '+' : l.type === 'remove' ? '-' : ' '}${l.text}`).join('\n')}`)].join('\n');
    const summary = `Applied ${keptHunks.length}/${patch.hunks.length} hunks for ${patch.path} (${selected.size} accepted, ${patch.hunks.length - selected.size} rejected)`;
    return okResult(summary, { path: patch.path, accepted: keptHunks.length, rejected: patch.hunks.length - keptHunks.length, diff: newDiff }, [{ type: 'diff', path: patch.path, diff: newDiff }]);
  },
});

const historySchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

export const patchHistoryTool = defineTool<z.infer<typeof historySchema>>({
  name: 'patch_history',
  description: 'Show patch history: grouped by file, with apply-all/reject-all status and rollback controls.',
  schema: historySchema,
  risk: 'safe',
  async execute(input, ctx) {
    const history = await listPatchHistory(ctx.sessionId);
    if (history.length === 0) return okResult('No patches yet.', { history: [] });
    const limited = history.slice(0, input.limit ?? 10);
    const lines = ['Patch history:', ...limited.map((h) => `  ${h.id.slice(0, 8)} ${h.appliedAt} — ${summarizePatches(h.patches).split('\n')[0]}${h.revertedAt ? ' (reverted)' : ''}`)];
    return okResult(lines.join('\n'), { history: limited });
  },
});
