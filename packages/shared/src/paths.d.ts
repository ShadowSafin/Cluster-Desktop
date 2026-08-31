/** Root directory for all cluster state (~/.cluster by default). */
export declare function clusterHome(): string;
/** Convert a path to forward-slash form for stable display and comparison. */
export declare function toPosix(value: string): string;
export declare class PathEscapeError extends Error {
    readonly candidate: string;
    readonly root: string;
    constructor(candidate: string, root: string);
}
/**
 * True when `target` is `root` or lives underneath it.
 * Uses `path.relative`, which is case-insensitive on win32.
 */
export declare function isWithin(root: string, target: string): boolean;
/**
 * Resolve a user- or model-supplied path against the project root, refusing
 * anything that escapes it. This is the single gate every filesystem tool
 * must pass through.
 */
export declare function resolveWithin(root: string, candidate: string): string;
/** Absolute path -> path relative to root, in posix form. */
export declare function relativeTo(root: string, absolute: string): string;
/** Compact, readable path for the UI: relative inside the repo, else absolute. */
export declare function displayPath(root: string, absolute: string): string;
export declare function extnameOf(filePath: string): string;
/** Ensure a directory exists (recursive mkdir, no throw if present). */
export declare function ensureDir(dir: string): Promise<void>;
//# sourceMappingURL=paths.d.ts.map