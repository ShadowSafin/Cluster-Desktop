import path from 'node:path';
import os from 'node:os';
/** Root directory for all cluster state (~/.cluster by default). */
export function clusterHome() {
    const configured = process.env.CLUSTER_HOME?.trim();
    return configured && configured.length > 0 ? configured : path.join(os.homedir(), '.cluster');
}
/** Convert a path to forward-slash form for stable display and comparison. */
export function toPosix(value) {
    return value.split(path.sep).join('/');
}
export class PathEscapeError extends Error {
    candidate;
    root;
    constructor(candidate, root) {
        super(`Path "${candidate}" resolves outside the project root "${root}".`);
        this.candidate = candidate;
        this.root = root;
        this.name = 'PathEscapeError';
    }
}
/**
 * True when `target` is `root` or lives underneath it.
 * Uses `path.relative`, which is case-insensitive on win32.
 */
export function isWithin(root, target) {
    const rel = path.relative(path.resolve(root), path.resolve(target));
    if (rel === '' || rel === '.')
        return true;
    if (rel.startsWith('..'))
        return false;
    return !path.isAbsolute(rel);
}
/**
 * Resolve a user- or model-supplied path against the project root, refusing
 * anything that escapes it. This is the single gate every filesystem tool
 * must pass through.
 */
export function resolveWithin(root, candidate) {
    const rootAbs = path.resolve(root);
    const resolved = path.resolve(rootAbs, candidate);
    if (!isWithin(rootAbs, resolved)) {
        throw new PathEscapeError(candidate, rootAbs);
    }
    return resolved;
}
/** Absolute path -> path relative to root, in posix form. */
export function relativeTo(root, absolute) {
    return toPosix(path.relative(path.resolve(root), path.resolve(absolute)));
}
/** Compact, readable path for the UI: relative inside the repo, else absolute. */
export function displayPath(root, absolute) {
    if (isWithin(root, absolute)) {
        const rel = relativeTo(root, absolute);
        return rel === '' ? '.' : rel;
    }
    return absolute;
}
export function extnameOf(filePath) {
    return path.extname(filePath).toLowerCase();
}
/** Ensure a directory exists (recursive mkdir, no throw if present). */
export async function ensureDir(dir) {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(dir, { recursive: true });
}
//# sourceMappingURL=paths.js.map