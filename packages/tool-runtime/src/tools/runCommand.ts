import path from 'node:path';
import { execa } from 'execa';
import { z } from 'zod';
import { sanitizeForDisplay, truncateLines } from '@cluster/shared';
import { defineTool, failResult, okResult } from '../types.js';
import { classifyCommand } from '../safety.js';
import { capMiddle, isDirectory, resolveToolPath } from '../util.js';

const MAX_CAPTURED = 200 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;

const schema = z.object({
  command: z.string().min(1).describe('Shell command to execute, run from the project root.'),
  cwd: z.string().optional().describe('Working directory relative to the project root. Defaults to the root.'),
  timeoutMs: z
    .number()
    .int()
    .min(1000)
    .max(MAX_TIMEOUT_MS)
    .optional()
    .describe('Timeout in milliseconds. Defaults to 120000.'),
});

type Input = z.infer<typeof schema>;

/**
 * Start the subprocess, converting a synchronous spawn failure into a value.
 * Returning the promise from a helper keeps execa's precise generic type
 * without having to spell it out at the call site.
 */
function startProcess(command: string, cwd: string, timeout: number, signal: AbortSignal) {
  try {
    return {
      ok: true as const,
      subprocess: execa(command, {
        shell: true,
        cwd,
        timeout,
        cancelSignal: signal,
        reject: false,
        buffer: false,
        all: true,
        extendEnv: true,
        windowsHide: true,
        // Keep output clean so it can be rendered and stored verbatim.
        env: { FORCE_COLOR: '0', NO_COLOR: '1' },
      }),
    };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

function defaultTimeout(): number {
  const configured = Number(process.env.CLUSTER_COMMAND_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, MAX_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
}

export const runCommandTool = defineTool<Input>({
  name: 'run_command',
  description:
    'Execute a shell command in the project and return its exit code and output. ' +
    'Use this to run builds, tests, linters and formatters. Output is streamed live to the user. ' +
    'Prefer a targeted command over a broad one.',
  schema,
  risk: (input) => classifyCommand(input.command).risk,
  preview(input) {
    const { reason } = classifyCommand(input.command);
    return reason ? `$ ${input.command}\n\nFlagged: ${reason}` : `$ ${input.command}`;
  },
  async execute(input, ctx) {
    const classification = classifyCommand(input.command);
    const needsConfirmation = classification.risk !== 'safe' || ctx.alwaysConfirmCommands;
    // Paranoid mode asks about commands we would normally run unprompted, and
    // the dialog needs a non-safe risk level to render correctly.
    const risk = classification.risk === 'safe' ? 'caution' : classification.risk;

    if (needsConfirmation) {
      const approved = await ctx.confirm({
        title: risk === 'destructive' ? 'Destructive command' : 'Confirm command',
        summary: classification.reason ?? 'Run this command in the project?',
        detail: `$ ${input.command}`,
        risk,
      });
      if (!approved) {
        return failResult(`Command declined by the user: ${input.command}`, {
          code: 'rejected',
          hint: 'Ask the user what they would like to run instead.',
        });
      }
    }

    let cwd = ctx.projectRoot;
    if (input.cwd) {
      const resolved = resolveToolPath(ctx, input.cwd);
      if (!resolved.ok) return resolved.result;
      if (!(await isDirectory(resolved.path.absolute))) {
        return failResult(`Working directory does not exist: ${resolved.path.display}`, {
          code: 'ENOENT',
          hint: 'Check the path, or omit cwd to run from the project root.',
        });
      }
      cwd = resolved.path.absolute;
    }

    const timeout = input.timeoutMs ?? defaultTimeout();
    const startedAt = Date.now();

    const started = startProcess(input.command, cwd, timeout, ctx.signal);
    if (!started.ok) {
      return failResult(`Failed to start command: ${started.error.message}`, { code: 'spawn_error' });
    }
    const subprocess = started.subprocess;

    let collected = '';
    const consume = async (stream: NodeJS.ReadableStream | null): Promise<void> => {
      if (!stream) return;
      try {
        for await (const chunk of stream as AsyncIterable<Buffer | string>) {
          const text = sanitizeForDisplay(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
          if (text === '') continue;
          collected += text;
          ctx.emitOutput(text);
          if (collected.length > MAX_CAPTURED) {
            // Stop retaining, but keep draining so the child never blocks.
            collected = collected.slice(0, MAX_CAPTURED);
          }
        }
      } catch (error) {
        ctx.logger.debug({ error }, 'command output stream ended with an error');
      }
    };

    // Drain the interleaved stream when available; otherwise drain stdout and
    // stderr concurrently so neither can fill its buffer and stall the child.
    if (subprocess.all) {
      await consume(subprocess.all as unknown as NodeJS.ReadableStream);
    } else {
      await Promise.all([
        consume(subprocess.stdout as unknown as NodeJS.ReadableStream | null),
        consume(subprocess.stderr as unknown as NodeJS.ReadableStream | null),
      ]);
    }

    const result = await subprocess;
    const durationMs = Date.now() - startedAt;

    const { text: output, truncated } = capMiddle(collected, MAX_CAPTURED);
    const displayCwd = path.resolve(cwd);

    if (result.isCanceled) {
      return failResult(`Cancelled: ${input.command}`, {
        code: 'cancelled',
        hint: 'The user stopped this command.',
        data: { command: input.command, cwd: displayCwd, durationMs, cancelled: true, output },
      });
    }

    if (result.timedOut) {
      return failResult(`Timed out after ${timeout}ms: ${input.command}`, {
        code: 'timeout',
        hint: 'Increase timeoutMs, or run a narrower command.',
        data: { command: input.command, cwd: displayCwd, durationMs, timedOut: true, output },
      });
    }

    const exitCode = result.exitCode ?? null;
    const summary = [
      `$ ${input.command}`,
      `cwd: ${displayCwd}`,
      `exit code: ${exitCode} (${durationMs}ms)`,
      '',
      output.trim() === '' ? '(no output)' : truncateLines(output.trimEnd(), 400),
    ].join('\n');

    const data = {
      command: input.command,
      cwd: displayCwd,
      exitCode,
      durationMs,
      timedOut: false,
      cancelled: false,
      truncated,
      output,
    };

    if (exitCode === 0) {
      return okResult(summary, data, [{ type: 'log', lines: summary.split('\n') }]);
    }

    return failResult(summary, {
      code: 'nonzero_exit',
      hint: `The command exited with code ${exitCode}. Read the output and fix the underlying problem.`,
      data,
    });
  },
});
