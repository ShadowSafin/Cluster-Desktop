/**
 * File discovery.
 *
 * Everything here is scoped to the project root and filtered by a default
 * ignore set merged with the repository's own `.gitignore`, so listing a large
 * monorepo stays fast and useful.
 */
export declare const DEFAULT_IGNORE: string[];
/** Translate .gitignore entries into fast-glob patterns. */
export declare function gitignoreToGlobPatterns(gitignore: string): string[];
export declare function loadIgnorePatterns(root: string): Promise<string[]>;
export interface ListFilesOptions {
    /** fast-glob pattern, defaults to every tracked-looking file. */
    pattern?: string;
    maxFiles?: number;
    ignore?: string[];
}
export interface ListFilesResult {
    files: string[];
    truncated: boolean;
    total: number;
}
export declare function listFiles(root: string, options?: ListFilesOptions): Promise<ListFilesResult>;
export interface DirectoryEntry {
    name: string;
    relativePath: string;
    type: 'file' | 'directory' | 'symlink' | 'other';
    size: number | null;
}
export interface ListDirectoryResult {
    entries: DirectoryEntry[];
}
export declare function listDirectory(root: string, relativePath?: string, options?: {
    maxEntries?: number;
}): Promise<ListDirectoryResult>;
//# sourceMappingURL=files.d.ts.map