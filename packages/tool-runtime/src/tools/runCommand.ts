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

function killProcessTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execa(`taskkill /pid ${pid} /T /F`, { shell: true }).catch(() => {});
    } else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        process.kill(pid, 'SIGKILL');
      }
    }
  } catch {}
}

const DEV_SERVER_REGEX = /\b(npm\s+run\s+dev|vite\b|npm\s+start|next\s+dev|nodemon|webpack\s+serve|gatsby\s+develop)\b/i;

const DEV_ERROR_PATTERNS = [
  /SyntaxError/i,
  /JSXParserMixin/i,
  /Unexpected token/i,
  /\[plugin:vite:[^\]]+\]/i,
  /\[vite\] Internal server error/i,
  /Failed to compile/i,
  /Module not found/i,
  /Cannot find module/i,
  /Transform failed with \d+ error/i,
  /error when starting dev server/i,
  /ELIFECYCLE/i,
  /UnhandledPromiseRejection/i,
  /Failed to resolve import/i,
  /RollupError/i,
  /Parse error/i,
  /at constructor \(/i,
];

const DEV_READY_PATTERNS = [
  /Local:\s+https?:\/\//i,
  /Network:\s+https?:\/\//i,
  /ready in \d+\s*m?s/i,
  /Server running at https?:\/\//i,
  /listening on https?:\/\//i,
  /compiled successfully/i,
  /App running at:/i,
];

function defaultTimeout(): number {
  const configured = Number(process.env.CLUSTER_COMMAND_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, MAX_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
}

export const runCommandTool = defineTool<Input>({
  name: 'run_command',
  description:
    'Execute a shell command in the project and return its exit code and output. ' +
    'Use this to run builds, tests, linters, and formatters. Output is streamed live to the user. ' +
    'Dev servers (e.g. npm run dev) are automatically monitored: if compilation or syntax errors occur, ' +
    'the process is closed and the error trace is returned so you can fix it and rerun.',
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

    const isDevServerCommand = DEV_SERVER_REGEX.test(input.command);
    let devServerErrorDetected = false;
    let devServerReadyDetected = false;
    let devServerVerifiedHealthy = false;
    let stopWatching = false;

    let resolveDevCheck: (() => void) | null = null;
    const devServerCheckPromise = new Promise<void>((resolve) => {
      resolveDevCheck = resolve;
    });

    let collected = '';
    const consume = async (stream: NodeJS.ReadableStream | null): Promise<void> => {
      if (!stream) return;
      try {
        for await (const chunk of stream as AsyncIterable<Buffer | string>) {
          if (stopWatching) break;
          const text = sanitizeForDisplay(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
          if (text === '') continue;
          collected += text;
          ctx.emitOutput(text);
          if (collected.length > MAX_CAPTURED) {
            collected = collected.slice(0, MAX_CAPTURED);
          }

          if (isDevServerCommand) {
            // Check for syntax/runtime compilation errors in log
            const hasError = DEV_ERROR_PATTERNS.some((p) => p.test(collected));
            if (hasError && !devServerErrorDetected) {
              devServerErrorDetected = true;
              // Give 1000ms to finish streaming the stack trace
              setTimeout(() => {
                killProcessTree(subprocess.pid);
                resolveDevCheck?.();
              }, 1000);
            }

            // Check if server is ready
            const isReady = DEV_READY_PATTERNS.some((p) => p.test(collected));
            if (isReady && !devServerReadyDetected && !devServerErrorDetected) {
              devServerReadyDetected = true;
              // Keep monitoring for 3s to be sure no errors happen right after start
              setTimeout(() => {
                if (DEV_ERROR_PATTERNS.some((p) => p.test(collected))) {
                  devServerErrorDetected = true;
                  killProcessTree(subprocess.pid);
                  resolveDevCheck?.();
                } else if (!devServerErrorDetected) {
                  devServerVerifiedHealthy = true;
                  stopWatching = true;
                  resolveDevCheck?.();
                }
              }, 3000);
            }
          }
        }
      } catch (error) {
        ctx.logger.debug({ error }, 'command output stream ended with an error');
      }
    };

    // Drain streams
    const streamPromise = subprocess.all
      ? consume(subprocess.all as unknown as NodeJS.ReadableStream)
      : Promise.all([
          consume(subprocess.stdout as unknown as NodeJS.ReadableStream | null),
          consume(subprocess.stderr as unknown as NodeJS.ReadableStream | null),
        ]);

    let result: any = null;
    if (isDevServerCommand) {
      result = await Promise.race([subprocess, devServerCheckPromise]);
    } else {
      await streamPromise;
      result = await subprocess;
    }

    const durationMs = Date.now() - startedAt;
    const { text: output, truncated } = capMiddle(collected, MAX_CAPTURED);
    const displayCwd = path.resolve(cwd);

    // If an error was detected in the dev server log:
    if (devServerErrorDetected) {
      killProcessTree(subprocess.pid);
      return failResult(
        `Dev server encountered compilation / syntax error:\n\n${output}\n\n[Dev server closed. Inspect the error trace above, identify the file and line number, fix the code using patch_file or write_file, and re-run the server.]`,
        {
          code: 'dev_server_error',
          hint: 'Fix the syntax or module error in the file shown in the trace and re-run.',
          data: { command: input.command, cwd: displayCwd, durationMs, exitCode: 1, output },
        },
      );
    }

    // If dev server verified healthy and ready:
    if (devServerVerifiedHealthy || (isDevServerCommand && devServerReadyDetected)) {
      return okResult(
        `Dev server verified running with no errors:\n\n${output}\n\n[Dev server is active and listening in background]`,
        {
          data: {
            command: input.command,
            cwd: displayCwd,
            durationMs,
            exitCode: 0,
            output,
          },
        },
      );
    }

    if (result?.isCanceled) {
      return failResult(`Cancelled: ${input.command}`, {
        code: 'cancelled',
        hint: 'The user stopped this command.',
        data: { command: input.command, cwd: displayCwd, durationMs, cancelled: true, output },
      });
    }

    if (result?.timedOut) {
      return failResult(`Timed out after ${timeout}ms: ${input.command}`, {
        code: 'timeout',
        hint: 'Increase timeoutMs, or run a narrower command.',
        data: { command: input.command, cwd: displayCwd, durationMs, timedOut: true, output },
      });
    }

    const exitCode = result?.exitCode ?? null;
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
