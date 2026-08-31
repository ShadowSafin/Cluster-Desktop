/**
 * Code chunking for large files.
 *
 * Large files are summarized or chunked instead of dumped wholly,
 * which reduces token waste and improves accuracy.
 */
export interface CodeChunk {
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    tokenEstimate: number;
    summary?: string;
    symbols?: string[];
}
export interface ChunkingOptions {
    maxChunkLines?: number;
    maxChunkTokens?: number;
    overlapLines?: number;
}
/** Split a file into overlapping chunks along semantic boundaries when possible. */
export declare function chunkFile(path: string, content: string, options?: ChunkingOptions): CodeChunk[];
export declare function summarizeChunk(chunk: CodeChunk): string;
export declare function selectRelevantChunks(chunks: CodeChunk[], query: string, maxChunks?: number): CodeChunk[];
//# sourceMappingURL=chunking.d.ts.map