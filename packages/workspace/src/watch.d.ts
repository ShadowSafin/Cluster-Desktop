import { Emitter } from '@cluster/shared';
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
export declare function watchWorkspace(root: string, options?: {
    enabled?: boolean;
}): WorkspaceWatcher;
//# sourceMappingURL=watch.d.ts.map