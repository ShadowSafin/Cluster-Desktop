import { z } from 'zod';
import { defineTool, okResult, failResult } from '../types.js';
import { createCheckpoint, listCheckpoints, rollbackToCheckpoint } from '@cluster/storage';

const createSchema = z.object({
  message: z.string().optional().describe('Checkpoint description.'),
  files: z.array(z.string()).optional().describe('Specific files to checkpoint. Defaults to git-tracked files.'),
});

export const createCheckpointTool = defineTool<z.infer<typeof createSchema>>({
  name: 'checkpoint_create',
  description: 'Create a checkpoint snapshot for rollback. Call before risky edits.',
  schema: createSchema,
  risk: 'safe',
  async execute(input, ctx) {
    try {
      const checkpoint = await createCheckpoint({
        sessionId: ctx.sessionId,
        projectRoot: ctx.projectRoot,
        message: input.message,
        files: input.files,
      });
      const summary = `Checkpoint ${checkpoint.id.slice(0, 8)} created: ${checkpoint.message} (${checkpoint.files.length} files, head ${checkpoint.gitHead ?? 'no git'})`;
      return okResult(summary, { checkpoint }, [{ type: 'log', lines: [summary] }]);
    } catch (error) {
      return failResult(`Failed to create checkpoint: ${(error as Error).message}`, { code: 'checkpoint_error' });
    }
  },
});

const listSchema = z.object({});

export const listCheckpointsTool = defineTool<z.infer<typeof listSchema>>({
  name: 'checkpoint_list',
  description: 'List available checkpoints for this session.',
  schema: listSchema,
  risk: 'safe',
  async execute(_input, ctx) {
    const checkpoints = await listCheckpoints(ctx.sessionId);
    if (checkpoints.length === 0) return okResult('No checkpoints yet.', { checkpoints: [] });
    const lines = ['Checkpoints:', ...checkpoints.map((c) => `  ${c.id.slice(0, 8)} ${c.createdAt} — ${c.message} (${c.files.length} files)`)];
    return okResult(lines.join('\n'), { checkpoints });
  },
});

const rollbackSchema = z.object({
  checkpointId: z.string().min(1).describe('Checkpoint ID to restore.'),
});

export const rollbackCheckpointTool = defineTool<z.infer<typeof rollbackSchema>>({
  name: 'checkpoint_restore',
  description: 'Rollback files to a previous checkpoint. Use to undo bad edits safely.',
  schema: rollbackSchema,
  risk: 'caution',
  async preview(input) {
    return `Restore checkpoint ${input.checkpointId.slice(0, 8)} — this will overwrite current files with snapshot.`;
  },
  async execute(input, ctx) {
    const approved = await ctx.confirm({
      title: 'Restore checkpoint',
      summary: `Restore to ${input.checkpointId.slice(0, 8)}? This will overwrite files.`,
      detail: `Checkpoint: ${input.checkpointId}`,
      risk: 'caution',
    });
    if (!approved) return failResult('Checkpoint restore declined by user.', { code: 'rejected' });

    try {
      const result = await rollbackToCheckpoint({
        sessionId: ctx.sessionId,
        checkpointId: input.checkpointId,
        projectRoot: ctx.projectRoot,
      });
      const summary = `Restored ${result.restored.length} files from checkpoint ${input.checkpointId.slice(0, 8)}${result.errors.length ? `, ${result.errors.length} errors` : ''}`;
      const lines = [summary, ...result.restored.map((f) => `  ✓ ${f}`), ...result.errors.map((e) => `  ✗ ${e.path}: ${e.error}`)];
      return okResult(lines.join('\n'), { restored: result.restored, errors: result.errors }, [{ type: 'log', lines }]);
    } catch (error) {
      return failResult(`Rollback failed: ${(error as Error).message}`, { code: 'rollback_error' });
    }
  },
});
