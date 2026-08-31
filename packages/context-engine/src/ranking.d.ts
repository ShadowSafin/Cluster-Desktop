/**
 * Smarter context ranking and file relevance scoring.
 *
 * Reduces token waste by selecting only the most relevant files
 * instead of dumping too much context.
 */
export interface FileScore {
    path: string;
    score: number;
    reasons: string[];
    language?: string;
    size: number;
    /** Subsystem/area grouping. */
    area?: string;
}
export interface RankingOptions {
    query: string;
    maxFiles?: number;
    maxTokens?: number;
    /** Boost recent git changes. */
    gitChangedFiles?: string[];
    /** Boost important files from memory. */
    importantFiles?: string[];
    /** Framework detection hints. */
    frameworks?: string[];
}
export declare function rankFiles(candidates: Array<{
    path: string;
    size: number;
    language?: string;
    contentPreview?: string;
    area?: string;
}>, options: RankingOptions): FileScore[];
export declare function groupByArea(files: FileScore[]): Map<string, FileScore[]>;
//# sourceMappingURL=ranking.d.ts.map