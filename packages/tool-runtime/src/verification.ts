import path from 'node:path';
import fs from 'node:fs/promises';
import { execa } from 'execa';
import { createId, nowIso, type VerificationResult, type VerificationKind } from '@cluster/shared';
import { sanitizeForDisplay } from '@cluster/shared';

/**
 * Automatic verification loop: test discovery, relevant test selection,
 * lint/format/build checks, parse output, auto-fix.
 */

export interface VerificationOptions {
  projectRoot: string;
  sessionId: string;
  taskId?: string;
  kind?: VerificationKind;
  command?: string;
  cwd?: string;
  timeoutMs?: number;
  autoFix?: boolean;
  emitOutput?: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface VerificationRun {
  result: VerificationResult;
  summary: string;
  shouldAutoFix: boolean;
}

function inferKind(command: string): VerificationKind {
  const lower = command.toLowerCase();
  if (lower.includes('test') || lower.includes('jest') || lower.includes('vitest') || lower.includes('pytest') || lower.includes('cargo test')) return 'test';
  if (lower.includes('lint') || lower.includes('eslint') || lower.includes('clippy')) return 'lint';
  if (lower.includes('format') || lower.includes('prettier') || lower.includes('fmt')) return 'format';
  if (lower.includes('build') || lower.includes('tsc') || lower.includes('compile')) return 'build';
  if (lower.includes('typecheck') || lower.includes('tsc --noemit')) return 'typecheck';
  return 'custom';
}

function parseFailures(output: string): Array<{ file?: string; line?: number; message: string }> {
  const failures: Array<{ file?: string; line?: number; message: string }> = [];
  const lines = output.split('\n');
  for (const line of lines) {
    // Common patterns: "FAIL src/foo.test.ts", "at src/file.ts:10:5", "error TS2307:"
    const failMatch = /(?:FAIL|Error|failed|✗|×)\s+([^\s:]+\.(?:ts|js|py|go|rs)):?(\d+)?:?\d*.*?:\s*(.+)/i.exec(line);
    if (failMatch) {
      failures.push({ file: failMatch[1], line: failMatch[2] ? Number(failMatch[2]) : undefined, message: failMatch[3]!.trim().slice(0, 200) });
      if (failures.length >= 20) break;
    }
  }
  // If no structured failures but exit non-zero, treat first error-looking lines as failures
  if (failures.length === 0 && /(error|failed)/i.test(output)) {
    for (const line of lines.slice(0, 20)) {
      if (/error/i.test(line) && line.trim().length > 10) {
        failures.push({ message: line.trim().slice(0, 200) });
        if (failures.length >= 5) break;
      }
    }
  }
  return failures;
}

function buildSummary(kind: VerificationKind, passed: boolean, exitCode: number | null, failures: Array<{ message: string }>, durationMs: number): string {
  if (passed) return `${kind} passed in ${durationMs}ms`;
  if (failures.length === 0) return `${kind} failed (exit ${exitCode}) in ${durationMs}ms — no specific failures parsed`;
  const top = failures.slice(0, 3).map((f) => f.message).join(' | ');
  return `${kind} failed (${failures.length} issues) in ${durationMs}ms: ${top}`;
}

export async function runVerification(options: VerificationOptions): Promise<VerificationRun> {
  const kind = options.kind ?? (options.command ? inferKind(options.command) : 'test');
  const command = options.command ?? (kind === 'test' ? 'npm test --silent' : kind === 'build' ? 'npm run build' : 'npm run lint');
  const cwd = options.cwd ? path.resolve(options.projectRoot, options.cwd) : options.projectRoot;
  const timeout = options.timeoutMs ?? 120_000;
  const started = Date.now();

  let stdout = '';
  let stderr = '';
  let exitCode: number | null = null;
  let timedOut = false;

  try {
    const subprocess = execa(command, {
      shell: true,
      cwd,
      timeout,
      cancelSignal: options.signal,
      reject: false,
      all: true,
      env: { FORCE_COLOR: '0', NO_COLOR: '1' },
    });

    if (subprocess.all && options.emitOutput) {
      const stream = subprocess.all as unknown as NodeJS.ReadableStream;
      for await (const chunk of stream as AsyncIterable<Buffer | string>) {
        const text = sanitizeForDisplay(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
        stdout += text;
        options.emitOutput?.(text);
      }
    }

    const result = await subprocess;
    exitCode = result.exitCode ?? null;
    timedOut = Boolean(result.timedOut);
    if (!subprocess.all) {
      stdout = sanitizeForDisplay(result.stdout ?? '');
      stderr = sanitizeForDisplay(result.stderr ?? '');
    }
  } catch (error) {
    stderr = (error as Error).message;
    exitCode = 1;
  }

  const durationMs = Date.now() - started;
  const combined = `${stdout}\n${stderr}`;
  const failures = parseFailures(combined);
  const passed = exitCode === 0 && !timedOut;
  const summary = buildSummary(kind, passed, exitCode, failures, durationMs);

  const result: VerificationResult = {
    id: createId('ver'),
    sessionId: options.sessionId,
    taskId: options.taskId,
    kind,
    command,
    exitCode,
    stdout: stdout.slice(0, 64 * 1024),
    stderr: stderr.slice(0, 16 * 1024),
    durationMs,
    passed,
    failures,
    summary,
    attemptedFixes: 0,
    autoFixed: false,
    createdAt: nowIso(),
  };

  const shouldAutoFix = !passed && options.autoFix !== false && (kind === 'lint' || kind === 'format') && failures.length < 10;

  return { result, summary, shouldAutoFix };
}

export async function discoverTests(projectRoot: string): Promise<string[]> {
  // Look for package.json scripts and test file globs
  const tests: string[] = [];
  try {
    const pkgRaw = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    for (const name of ['test', 'test:unit', 'check', 'verify']) {
      if (scripts[name]) tests.push(scripts[name]);
    }
  } catch {
    // ignore
  }
  // Filter to only include commands that likely exist; fallback
  if (tests.length === 0) tests.push('npm test --silent');
  return tests;
}

export function selectRelevantTests(changedFiles: string[], availableCommands: string[]): string[] {
  if (changedFiles.length === 0) return availableCommands.slice(0, 1);
  // If only docs changed, no need to run heavy tests
  const codeChanged = changedFiles.some((f) => /\.(ts|tsx|js|jsx|py|go|rs)$/.test(f));
  if (!codeChanged) return [];
  // For small changes, run only unit tests
  if (changedFiles.length <= 3 && availableCommands.some((c) => c.includes('test:unit'))) {
    return availableCommands.filter((c) => c.includes('unit')).slice(0, 1);
  }
  return availableCommands.slice(0, 2);
}

export async function autoFixLoop(options: VerificationOptions & { maxAttempts?: number }): Promise<VerificationRun> {
  const maxAttempts = options.maxAttempts ?? 2;
  let last = await runVerification({ ...options, autoFix: true });
  if (last.result.passed || !last.shouldAutoFix) return last;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Try format fix
    const fixCommand = inferFixCommand(last.result.command);
    if (!fixCommand) break;
    await runVerification({ ...options, command: fixCommand, kind: 'format' as const }).catch(() => null);
    last = await runVerification({ ...options, autoFix: false });
    last.result.attemptedFixes = attempt;
    if (last.result.passed) {
      last.result.autoFixed = true;
      break;
    }
  }
  return last;
}

function inferFixCommand(command: string): string | null {
  if (command.includes('eslint')) return command.replace('eslint', 'eslint --fix');
  if (command.includes('prettier')) return command.replace('prettier', 'prettier --write');
  if (command.includes('ruff check')) return 'ruff check --fix .';
  if (command.includes('cargo clippy')) return null;
  return null;
}
