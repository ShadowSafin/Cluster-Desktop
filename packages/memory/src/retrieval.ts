import { createId, type MemoryEntry, type ContextualRetrievalOptions } from '@cluster/shared';
import { type MemoryDatabase, type VectorSearchResult } from './database.js';

export type { ContextualRetrievalOptions, ContextualRetrievalOptions as RetrievalOptions };

export class MemoryRetriever {
  constructor(private db: MemoryDatabase) {}

  /**
   * Context-aware hybrid retrieval combining project metadata, task classification,
   * active files, pinned directives, and semantic vector similarity.
   */
  async retrieve(options: ContextualRetrievalOptions): Promise<VectorSearchResult[]> {
    const limit = options.limit ?? 6;
    const minScore = options.minScore ?? 0.3;

    // Search candidate memories using semantic vector matching
    const candidates = await this.db.searchVector(
      options.queryText,
      {
        projectRoot: options.projectRoot,
        archived: false,
      },
      limit * 3,
    );

    // Score candidates with context-weighted hybrid ranking
    const scored = candidates.map((r) => {
      let contextBonus = 0;

      // 1. Task category match
      if (options.taskCategory && (r.category === options.taskCategory || (r.tags || []).includes(options.taskCategory))) {
        contextBonus += 0.12;
      }

      // 2. Active file match
      if (options.activeFiles && options.activeFiles.length > 0) {
        const memPath = (r.metadata as any)?.path || '';
        if (memPath && options.activeFiles.some((f) => f.includes(memPath) || memPath.includes(f))) {
          contextBonus += 0.15;
        }
      }

      // 3. High-priority category boost (preferences and bug fixes)
      if (r.category === 'user_preference' || r.category === 'ui_style' || r.category === 'bug') {
        contextBonus += 0.08;
      }

      // Hybrid score: 0.5 * similarity + 0.2 * importance + pinned + context
      const pinnedBonus = r.pinned ? 0.15 : 0;
      const compositeScore = Math.min(1.0, r.similarity * 0.5 + r.importance * 0.2 + pinnedBonus + contextBonus);

      return {
        ...r,
        compositeScore,
      };
    });

    // Filter by minScore and sort descending
    const filtered = scored
      .filter((r) => r.compositeScore >= minScore)
      .sort((a, b) => b.compositeScore - a.compositeScore);

    const topMemories = filtered.slice(0, limit);

    // Audit logs & hit counters
    if (options.sessionId && topMemories.length > 0) {
      for (const mem of topMemories) {
        await this.db.logRetrieval({
          id: createId('log'),
          sessionId: options.sessionId,
          taskGoal: options.queryText.slice(0, 100),
          memoryId: mem.id,
          similarityScore: mem.similarity,
          category: mem.category,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return topMemories;
  }

  /**
   * Formats retrieved memories into a structured, high-signal Markdown block
   * for prompt injection into the agent's system prompt or planning context.
   */
  formatForPrompt(memories: VectorSearchResult[]): string {
    if (!memories || memories.length === 0) return '';

    const lines: string[] = [
      '## Recalled Project & User Memory (Active Context)',
      'The following durable project memories and guidelines were retrieved for this task and must be respected:',
    ];

    // Group by category
    const byCategory: Record<string, VectorSearchResult[]> = {};
    for (const mem of memories) {
      if (!byCategory[mem.category]) byCategory[mem.category] = [];
      byCategory[mem.category].push(mem);
    }

    for (const [category, items] of Object.entries(byCategory)) {
      const header = category.replace(/_/g, ' ').toUpperCase();
      lines.push(`\n### ${header}`);
      for (const item of items) {
        const cleanVal = item.value.replace(/\n+/g, ' ').slice(0, 240);
        lines.push(`- [${header}] **${item.title}**: ${cleanVal}`);
      }
    }

    lines.push(
      '\nDirective: Incorporate the recalled architectural decisions, UI rules, and bug-fix lessons into your plan and implementation.',
    );

    return lines.join('\n');
  }
}
