import { type FileScore } from './ranking.js';
import { type CodeChunk } from './chunking.js';
import { type SymbolInfo } from './symbols.js';
import { type RepoIntelligence } from './repoIntelligence.js';
export interface ContextSelection {
    rankedFiles: FileScore[];
    chunks: CodeChunk[];
    symbols: SymbolInfo[];
    repo: RepoIntelligence | null;
    summary: string;
    tokenEstimate: number;
}
export interface ContextEngineOptions {
    projectRoot: string;
    maxFiles?: number;
    maxTokens?: number;
    previewChars?: number;
}
export declare class ContextEngine {
    private readonly options;
    constructor(options: ContextEngineOptions);
    get root(): string;
    gatherIntelligence(): Promise<RepoIntelligence>;
    /**
     * Smart context selection for a user query.
     *
     * 1. Gather repo intelligence (frameworks, git changes, file groups)
     * 2. Rank candidate files by relevance scoring
     * 3. Chunk large files, pick relevant chunks
     * 4. Extract symbols for overview
     */
    selectContext(query: string, candidates?: string[]): Promise<ContextSelection>;
    private buildSummary;
    /** File relevance scoring exposed for tool use */
    rank(query: string, files: string[]): Promise<FileScore[]>;
}
//# sourceMappingURL=engine.d.ts.map