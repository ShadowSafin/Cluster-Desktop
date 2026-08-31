import type { GitState } from '@cluster/shared';
export declare function isGitRepository(cwd: string): Promise<boolean>;
export declare function readGitState(cwd: string): Promise<GitState | null>;
/** Raw `git status --porcelain` output, for tools that need the file list. */
export declare function readGitPorcelain(cwd: string): Promise<string | null>;
/**
 * Short, one-line description of the working tree, shown in the status bar.
 * e.g. `main* +3 ~2 ?1`
 */
export declare function formatGitState(git: GitState | null): string;
//# sourceMappingURL=git.d.ts.map