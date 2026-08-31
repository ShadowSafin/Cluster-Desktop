import path from 'node:path';
import { watch, type FSWatcher } from 'chokidar';
import { Emitter, toPosix } from '@cluster/shared';

/**
 * Workspace file watcher.
 *
 * Drives the "file activity" panel and lets the agent re-read a file that
 * changed underneath it. Watching is opt-in and always disposable: the TUI
 * closes it on exit.
 */

export type FileChangeType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

export interface FileChangeEvent {
  type: FileChangeType;
  /** Absolute path. */
  path: string;
  /** Path relative to the project root, in posix form. */
  relative: string;
  at: string;
}

export interface WatchEvents {
  change: FileChangeEvent;
  error: Error;
  ready: undefined;
}

export interface WorkspaceWatcher {
  readonly events: Emitter<WatchEvents>;
  close(): Promise<void>;
}

const WATCH_IGNORE: Array<string | RegExp> = [
  /(^|[/\\])node_modules([/\\]|$)/,
  /(^|[/\\])\.git([/\\]|$)/,
  /(^|[/\\])dist([/\\]|$)/,
  /(^|[/\\])\.cluster([/\\]|$)/,
];

export function watchWorkspace(
  root: string,
  options: { enabled?: boolean } = {},
): WorkspaceWatcher {
  const events = new Emitter<WatchEvents>((error) => events.emit('error', error as Error));

  if (options.enabled === false) {
    return { events, close: async () => undefined };
  }

  let watcher: FSWatcher | null = null;

  try {
    watcher = watch(root, {
      ignoreInitial: true,
      ignored: WATCH_IGNORE,
      // Avoid firing on half-written files, which editors produce constantly.
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
      depth: 8,
    });

    const emit = (type: FileChangeType) => (target: string): void => {
      events.emit('change', {
        type,
        path: target,
        relative: toPosix(path.relative(root, target)),
        at: new Date().toISOString(),
      });
    };

    watcher
      .on('add', emit('add'))
      .on('change', emit('change'))
      .on('unlink', emit('unlink'))
      .on('addDir', emit('addDir'))
      .on('unlinkDir', emit('unlinkDir'))
      .on('error', (error) => events.emit('error', error instanceof Error ? error : new Error(String(error))))
      .on('ready', () => events.emit('ready', undefined));
  } catch (error) {
    events.emit('error', error instanceof Error ? error : new Error(String(error)));
  }

  return {
    events,
    close: async () => {
      if (watcher) {
        const instance = watcher;
        watcher = null;
        await instance.close().catch(() => undefined);
      }
      events.clear();
    },
  };
}
