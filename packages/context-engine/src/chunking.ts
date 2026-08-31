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

const DEFAULT_MAX_LINES = 120;
const DEFAULT_MAX_TOKENS = 3000;
const DEFAULT_OVERLAP = 8;

/** Split a file into overlapping chunks along semantic boundaries when possible. */
export function chunkFile(
  path: string,
  content: string,
  options: ChunkingOptions = {},
): CodeChunk[] {
  const maxLines = options.maxChunkLines ?? DEFAULT_MAX_LINES;
  const maxTokens = options.maxChunkTokens ?? DEFAULT_MAX_TOKENS;
  const overlap = options.overlapLines ?? DEFAULT_OVERLAP;

  const lines = content.split('\n');
  if (lines.length <= maxLines && estimateTokens(content) <= maxTokens) {
    return [
      {
        id: `${path}:1-${lines.length}`,
        path,
        startLine: 1,
        endLine: lines.length,
        content,
        tokenEstimate: estimateTokens(content),
      },
    ];
  }

  // Try to find semantic boundaries (function/class/import blocks)
  const boundaries = findSemanticBoundaries(lines);
  const chunks: CodeChunk[] = [];

  let start = 0;
  while (start < lines.length) {
    let end = Math.min(start + maxLines, lines.length);
    const tokens = estimateTokens(lines.slice(start, end).join('\n'));
    if (tokens > maxTokens) {
      // Shrink until tokens fit
      while (end > start + 20 && estimateTokens(lines.slice(start, end).join('\n')) > maxTokens) {
        end -= 10;
      }
    }

    // Snap end to nearest semantic boundary if close
    if (end < lines.length) {
      const snap = findNearestBoundary(boundaries, end, 15);
      if (snap !== null && snap > start + 20) end = snap;
    }

    const chunkContent = lines.slice(start, end).join('\n');
    chunks.push({
      id: `${path}:${start + 1}-${end}`,
      path,
      startLine: start + 1,
      endLine: end,
      content: chunkContent,
      tokenEstimate: estimateTokens(chunkContent),
    });

    if (end >= lines.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
}

export function summarizeChunk(chunk: CodeChunk): string {
  const lines = chunk.content.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  const preview = lines.slice(0, 5).join('\n').slice(0, 300);
  const symbolCount = (chunk.content.match(/\b(function|class|interface|type|const|let|export)\b/g) ?? []).length;
  return `Chunk ${chunk.path}:${chunk.startLine}-${chunk.endLine} (${chunk.tokenEstimate} tokens, ~${symbolCount} declarations) — ${firstLine.slice(0, 80)} — Preview: ${preview.slice(0, 200)}`;
}

export function selectRelevantChunks(
  chunks: CodeChunk[],
  query: string,
  maxChunks = 3,
): CodeChunk[] {
  const qTokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  const scored = chunks.map((chunk) => {
    const lower = chunk.content.toLowerCase();
    let score = 0;
    for (const tok of qTokens) {
      if (lower.includes(tok)) score += 10;
    }
    // Prefer chunks near top for entry points, but also distribute
    score += Math.max(0, 5 - (chunks.indexOf(chunk) % 5));
    return { chunk, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxChunks).map((s) => s.chunk);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function findSemanticBoundaries(lines: string[]): number[] {
  const boundaries: number[] = [0];
  const patterns = [
    /^\s*(export\s+)?(async\s+)?(function|class|interface|type|enum)\b/,
    /^\s*(import|export)\b/,
    /^\s*}\s*$/,
    /^\s*\/\*\*/,
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (patterns.some((p) => p.test(line))) boundaries.push(i);
  }
  boundaries.push(lines.length);
  return [...new Set(boundaries)].sort((a, b) => a - b);
}

function findNearestBoundary(boundaries: number[], target: number, maxDistance: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const b of boundaries) {
    const dist = Math.abs(b - target);
    if (dist <= maxDistance && dist < bestDist && b > target - maxDistance) {
      best = b;
      bestDist = dist;
    }
  }
  return best;
}
