/** Remove ANSI escape sequences so raw command output can be rendered safely. */
export declare function stripAnsi(value: string): string;
/** Collapse control characters that would corrupt the Ink render tree. */
export declare function sanitizeForDisplay(value: string): string;
export declare function truncate(value: string, max: number, suffix?: string): string;
/**
 * Keep the head and tail of a long block, dropping the middle.
 * Long command output should never be lost entirely, but it also should not
 * bury the UI in a wall of text.
 */
export declare function truncateLines(value: string, maxLines: number, marker?: string): string;
/** Rough token estimate (4 chars per token) used for context budgeting. */
export declare function estimateTokens(value: string): number;
export declare function formatDuration(ms: number): string;
export declare function formatBytes(bytes: number): string;
export declare function pluralize(count: number, singular: string, plural?: string): string;
/** Wrap text to a width without breaking long tokens onto their own lines. */
export declare function wrapText(value: string, width: number): string[];
export declare function indent(value: string, prefix?: string): string;
//# sourceMappingURL=text.d.ts.map