import path from 'node:path';
import fs from 'node:fs/promises';
import { languageForPath } from '@cluster/workspace';
import { rankFiles, type FileScore } from './ranking.js';
import { chunkFile, selectRelevantChunks, type CodeChunk } from './chunking.js';
import { extractSymbols, type SymbolInfo } from './symbols.js';
import { gatherRepoIntelligence, type RepoIntelligence } from './repoIntelligence.js';

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

export class ContextEngine {
  constructor(private readonly options: ContextEngineOptions) {}

  get root(): string {
    return this.options.projectRoot;
  }

  async gatherIntelligence(): Promise<RepoIntelligence> {
    return gatherRepoIntelligence(this.options.projectRoot);
  }

  /**
   * Smart context selection for a user query.
   *
   * 1. Gather repo intelligence (frameworks, git changes, file groups)
   * 2. Rank candidate files by relevance scoring
   * 3. Chunk large files, pick relevant chunks
   * 4. Extract symbols for overview
   */
  async selectContext(query: string, candidates?: string[]): Promise<ContextSelection> {
    const repo = await this.gatherIntelligence().catch(() => null);
    const root = this.options.projectRoot;

    // Discover candidates if not provided
    let fileList: string[] = candidates ?? [];
    if (fileList.length === 0) {
      // Use fileGroups from repo intelligence as candidates
      if (repo?.fileGroups) {
        fileList = repo.fileGroups.flatMap((g) => g.files).slice(0, 100);
      }
      if (fileList.length === 0) {
        // Fallback: list src files directly
        const fg = (await import('fast-glob')).default;
        fileList = await fg(['**/*.{ts,tsx,js,jsx,py,go,rs,md,json}'], {
          cwd: root,
          ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
          onlyFiles: true,
        }).then((files) => files.slice(0, 80));
      }
    }

    // Build candidate metadata with preview
    const candidatesWithMeta = await Promise.all(
      fileList.slice(0, 80).map(async (file) => {
        const abs = path.join(root, file);
        try {
          const stat = await fs.stat(abs);
          const preview = await fs.readFile(abs, 'utf8').then((c) => c.slice(0, (this.options.previewChars ?? 2000))).catch(() => '');
          return {
            path: file,
            size: stat.size,
            language: languageForPath(file) ?? undefined,
            contentPreview: preview,
            area: file.split('/')[0] ?? 'root',
          };
        } catch {
          return { path: file, size: 0, language: undefined, contentPreview: '', area: 'root' };
        }
      }),
    );

    const ranked = rankFiles(candidatesWithMeta, {
      query,
      maxFiles: this.options.maxFiles ?? 12,
      maxTokens: this.options.maxTokens ?? 30_000,
      gitChangedFiles: repo?.git?.recentChangedFiles,
      frameworks: repo?.frameworks,
      importantFiles: repo?.fileGroups?.flatMap((g) => g.files).slice(0, 5),
    });

    // Chunk largest files among top-ranked
    const chunks: CodeChunk[] = [];
    const symbols: SymbolInfo[] = [];
    let tokenEstimate = 0;

    for (const rankedFile of ranked.slice(0, 8)) {
      const abs = path.join(root, rankedFile.path);
      try {
        const content = await fs.readFile(abs, 'utf8');
        const fileSymbols = extractSymbols(rankedFile.path, content);
        symbols.push(...fileSymbols.slice(0, 15));

        if (content.length > 20_000 || content.split('\n').length > 250) {
          const fileChunks = chunkFile(rankedFile.path, content);
          const relevant = selectRelevantChunks(fileChunks, query, 2);
          chunks.push(...relevant);
          tokenEstimate += relevant.reduce((sum, c) => sum + c.tokenEstimate, 0);
        } else {
          tokenEstimate += Math.ceil(content.length / 4);
        }
      } catch {
        // ignore unreadable
      }
    }

    const summary = this.buildSummary(query, ranked, repo, chunks, symbols);

    return { rankedFiles: ranked, chunks, symbols: symbols.slice(0, 40), repo, summary, tokenEstimate };
  }

  private buildSummary(query: string, ranked: FileScore[], repo: RepoIntelligence | null, chunks: CodeChunk[], symbols: SymbolInfo[]): string {
    const lines: string[] = [];
    lines.push(`Context for: "${query.slice(0, 120)}"`);
    lines.push(`Selected ${ranked.length} files (${ranked.slice(0, 3).map((f) => f.path).join(', ')}${ranked.length > 3 ? '…' : ''})`);
    if (repo) {
      lines.push(`Project: ${repo.projectKind} ${repo.packageManager ?? ''} | Languages: ${repo.languages.join(', ')} | Frameworks: ${repo.frameworks.join(', ') || 'none'}`);
      if (repo.git?.recentChangedFiles.length) lines.push(`Recent changes: ${repo.git.diffSummary}`);
      lines.push(`Areas: ${repo.fileGroups.map((g) => `${g.area} (${g.files.length})`).join(', ')}`);
    }
    if (chunks.length > 0) lines.push(`Chunked ${chunks.length} large files, kept relevant slices`);
    if (symbols.length > 0) lines.push(`Symbols: ${symbols.slice(0, 6).map((s) => s.name).join(', ')}${symbols.length > 6 ? '…' : ''}`);
    lines.push(`Token estimate: ~${Math.round(chunks.reduce((a, c) => a + c.tokenEstimate, 0) / 1000)}k for chunks + file overviews`);
    return lines.join('\n');
  }

  /** File relevance scoring exposed for tool use */
  async rank(query: string, files: string[]): Promise<FileScore[]> {
    const meta = await Promise.all(
      files.map(async (file) => ({
        path: file,
        size: await fs.stat(path.join(this.options.projectRoot, file)).then((s) => s.size).catch(() => 0),
        language: languageForPath(file) ?? undefined,
        contentPreview: await fs.readFile(path.join(this.options.projectRoot, file), 'utf8').then((c) => c.slice(0, 2000)).catch(() => ''),
        area: file.split('/')[0] ?? 'root',
      })),
    );
    return rankFiles(meta, { query, maxFiles: 20, maxTokens: 40_000 });
  }
}
