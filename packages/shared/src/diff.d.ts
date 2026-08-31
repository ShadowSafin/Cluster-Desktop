/**
 * Line-oriented diff engine.
 *
 * Pure, dependency-free, and used by three consumers with different needs:
 *   - the patch tool, to preview and apply changes
 *   - the session store, to persist what changed
 *   - the TUI, to render readable diffs
 *
 * Implementation: trim the common prefix/suffix, then run a classic LCS
 * dynamic program on the differing middle. The DP is O(n*m) in time and
 * memory, so it is only used when the product stays under `maxCells`; beyond
 * that we degrade to a whole-block replace rather than hanging the UI.
 */
export type DiffLineType = 'context' | 'add' | 'remove';
export interface DiffLine {
    type: DiffLineType;
    text: string;
    oldLineNo: number | null;
    newLineNo: number | null;
}
export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: DiffLine[];
}
export interface DiffResult {
    hunks: DiffHunk[];
    additions: number;
    deletions: number;
}
export interface DiffOptions {
    /** Lines of surrounding context in each hunk. Default 3. */
    context?: number;
    /** Above this many DP cells, skip the exact diff. Default 1_000_000. */
    maxCells?: number;
}
/** Split text into logical lines, normalising CRLF and dropping the trailing terminator. */
export declare function splitLines(text: string): string[];
export declare function joinLines(lines: string[], trailingNewline: boolean): string;
export declare function endsWithNewline(text: string): boolean;
export declare function diffLines(oldText: string, newText: string, options?: DiffOptions): DiffResult;
/** Render a standard unified diff, suitable for storage and for display. */
export declare function formatUnifiedDiff(filePath: string, oldText: string, newText: string, options?: DiffOptions): string;
export interface ParsedHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: Array<{
        type: DiffLineType;
        text: string;
    }>;
}
export interface ParsedDiff {
    filePath: string | null;
    hunks: ParsedHunk[];
}
/**
 * Lenient parser for unified diffs produced by this module or by a model.
 * Tolerates a missing/incorrect `---`/`+++` header and file paths with or
 * without the `a/`/`b/` prefix.
 */
export declare function parseUnifiedDiff(diff: string): ParsedDiff;
export interface ApplyDiffResult {
    ok: boolean;
    content: string;
    error?: string;
}
/**
 * Apply a unified diff to `original`.
 *
 * Hunks are applied in order. Each hunk is matched at its recorded position
 * and, if that fails, within a bounded search window (`fuzz`) so that small
 * line drift does not reject an otherwise valid patch.
 */
export declare function applyUnifiedDiff(original: string, diff: string, options?: {
    fuzz?: number;
}): ApplyDiffResult;
//# sourceMappingURL=diff.d.ts.map