import path from 'node:path';
import fs from 'node:fs/promises';
import { PathEscapeError, displayPath, relativeTo, resolveWithin, toPosix } from '@cluster/shared';
import type { ToolContext, ToolResult } from './types.js';
import { failResult } from './types.js';

export interface ResolvedPath {
  absolute: string;
  relative: string;
  display: string;
}

/**
 * Resolve a model-supplied path against the project root.
 *
 * Returns a failed `ToolResult` rather than throwing so that every tool can
 * handle traversal attempts uniformly and the run survives a bad argument.
 */
export function resolveToolPath(
  ctx: ToolContext,
  candidate: string,
): { ok: true; path: ResolvedPath } | { ok: false; result: ToolResult } {
  if (candidate.trim() === '') {
    return { ok: false, result: failResult('Path must not be empty.', { code: 'empty_path' }) };
  }
  try {
    const absolute = resolveWithin(ctx.projectRoot, candidate);
    const relative = toPosix(path.relative(ctx.projectRoot, absolute));
    return {
      ok: true,
      path: { absolute, relative, display: displayPath(ctx.projectRoot, absolute) },
    };
  } catch (error) {
    if (error instanceof PathEscapeError) {
      return {
        ok: false,
        result: failResult(
          `Refused to access "${candidate}": it resolves outside the project root.`,
          { code: 'path_escape', hint: 'Use a path relative to the project root, e.g. "src/index.ts".' },
        ),
      };
    }
    return {
      ok: false,
      result: failResult(`Invalid path "${candidate}": ${(error as Error).message}`, { code: 'invalid_path' }),
    };
  }
}

/** Uniform handling of filesystem errors, with hints the model can act on. */
export function describeFsError(error: unknown, target: ResolvedPath): ToolResult {
  const code = (error as NodeJS.ErrnoException)?.code;

  if (code === 'ENOENT') {
    return failResult(`File not found: ${target.display}`, {
      code: 'ENOENT',
      hint: 'Check the path, or list the directory to find the correct name.',
    });
  }
  if (code === 'EISDIR') {
    return failResult(`${target.display} is a directory, not a file.`, {
      code: 'EISDIR',
      hint: 'Use list_files for directories.',
    });
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return failResult(`Permission denied: ${target.display}`, {
      code,
      hint: 'The file may be locked by another process or require elevated permissions.',
    });
  }
  if (code === 'ENOTDIR') {
    return failResult(`Not a directory: ${target.display}`, { code, hint: 'A parent path component is a file.' });
  }

  return failResult(`Failed to access ${target.display}: ${(error as Error).message}`, { code });
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Keep the head and tail of large output while bounding memory.
 * The tail matters because that is where build errors end up.
 */
export function capMiddle(value: string, max: number): { text: string; truncated: boolean } {
  if (value.length <= max) return { text: value, truncated: false };
  const headSize = Math.floor(max * 0.7);
  const tailSize = max - headSize;
  const hidden = value.length - max;
  return {
    text: `${value.slice(0, headSize)}\n… ${hidden} characters omitted …\n${value.slice(value.length - tailSize)}`,
    truncated: true,
  };
}

/**
 * Read a text file with a size ceiling.
 * Returns `null` when the path does not exist, which callers distinguish from
 * a read failure. Throws an `EISDIR` error when the path is a directory so the
 * caller can surface a specific message instead of treating it as a missing file.
 */
export async function readTextFile(
  absolute: string,
  maxBytes: number,
): Promise<{ content: string | null; truncated: boolean; size: number }> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(absolute, 'r');
    const stat = await handle.stat();
    if (stat.isDirectory()) {
      const error = new Error(`EISDIR: illegal operation on a directory, read '${absolute}'`) as NodeJS.ErrnoException;
      error.code = 'EISDIR';
      throw error;
    }
    const bytesToRead = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    await handle.read(buffer, 0, bytesToRead, 0);
    return { content: buffer.toString('utf8'), truncated: stat.size > maxBytes, size: stat.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { content: null, truncated: false, size: 0 };
    }
    throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

export function relativeDisplay(ctx: ToolContext, absolute: string): string {
  return displayPath(ctx.projectRoot, absolute);
}

export function relativeOf(ctx: ToolContext, absolute: string): string {
  return toPosix(relativeTo(ctx.projectRoot, absolute));
}

/** Run tasks with bounded concurrency. */
export async function mapWithConcurrency<TIn, TOut>(
  items: readonly TIn[],
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const results: TOut[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  });

  await Promise.all(runners);
  return results;
}
