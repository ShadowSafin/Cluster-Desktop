# Context Engine

## Overview

The Context Engine (`@cluster/context-engine`) gathers repository intelligence and selects the most relevant code context to include in LLM prompts. It prevents context overflow by ranking files, chunking large files, and extracting symbols.

## Why It Exists

LLM context windows are limited. Including an entire codebase wastes tokens on irrelevant code. The Context Engine solves this by:

1. **Understanding the repo structure** (what framework, what languages, what changed recently)
2. **Ranking files by relevance** to the current query
3. **Chunking large files** into relevant slices
4. **Extracting symbols** (classes, functions) for overview without full content

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     ContextEngine                            │
│                                                              │
│  gatherIntelligence()                                        │
│  └─► RepoIntelligence: languages, frameworks, fileGroups    │
│                                                              │
│  selectContext(query, candidates?)                           │
│  ├─► rankFiles(candidates, query) → top-N relevant files    │
│  ├─► For each ranked file:                                  │
│  │   ├─ extractSymbols(file, content) → overview            │
│  │   └─ if file > 20K chars:                                │
│  │       ├─ chunkFile(file, content)                        │
│  │       └─ selectRelevantChunks(chunks, query, topK=2)     │
│  └─► Build summary + token estimate                         │
└──────────────────────────────────────────────────────────────┘
```

## Key Components

### RepoIntelligence (`repoIntelligence.ts`)

Gathers high-level repository metadata:

```typescript
interface RepoIntelligence {
  projectKind: string;           // 'node', 'python', etc.
  packageManager: string | null; // 'npm', 'pnpm', etc.
  languages: string[];           // ['TypeScript', 'Python']
  frameworks: string[];          // ['React', 'Express', 'FastAPI']
  fileGroups: Array<{ area: string; files: string[] }>;  // Grouped by directory
  git: {
    recentChangedFiles: string[];  // Files modified in last N commits
    diffSummary: string;           // Short diff summary
  } | null;
}
```

Discovery method:
- Parses `package.json`, `Cargo.toml`, `requirements.txt`, `go.mod` for project type
- Uses `fast-glob` to find source files by language extension
- Runs `git log --name-only -20` for recent changes
- Groups files by top-level directory

---

### File Ranking (`ranking.ts`)

Ranks candidate files by relevance score:

```typescript
interface FileScore {
  path: string;
  score: number;
  size: number;
  language: string;
  preview: string;  // First 2000 chars
  area: string;     // Top-level directory
}
```

Scoring factors:
| Factor | Weight | Description |
|--------|--------|-------------|
| Query text match in file content | High | Direct relevance |
| File is in git recently changed | +0.15 | Active development area |
| File is in an important area (src/, lib/) | +0.10 | Core code vs tests/docs |
| File size (smaller = more likely to fit) | Medium | Token budget awareness |
| Framework file (known important paths) | +0.08 | e.g., config files, entry points |

Returns top-N files respecting `maxTokens` budget.

---

### Chunking (`chunking.ts`)

Splits large files into semantic chunks:

```typescript
interface CodeChunk {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  tokenEstimate: number;
  relevanceScore: number;
}
```

Algorithm:
1. Split file by blank-line-delimited blocks (functions, classes, top-level statements)
2. Score each chunk against the query using simple text overlap
3. Select top-K chunks per file (default: 2)
4. Merge adjacent chunks if combined token count is under budget

---

### Symbol Extraction (`symbols.ts`)

Extracts named declarations from source files:

```typescript
interface SymbolInfo {
  name: string;
  kind: 'class' | 'function' | 'method' | 'interface' | 'type' | 'const' | 'enum';
  line: number;
  file: string;
  signature?: string;  // e.g., "function authenticate(token: string): Promise<User>"
}
```

Language support:
- TypeScript/JavaScript: parsers AST for imports, exports, classes, functions
- Python: detects `def`, `class`, `import`
- Go: detects `func`, `type`, `import`

Symbols are included as an overview (not full content) to help the model understand file structure.

---

## Integration Points

### In AgentLoop (single-agent)

The context engine is currently used primarily in multi-agent mode by the `Coordinator`:

```typescript
// In Coordinator.createPlan()
const engine = new ContextEngine({ projectRoot });
const intel = await engine.gatherIntelligence();
const graph = planner.createGraph(goal, intel.fileGroups);
```

### In Memory Retrieval

The memory system uses the same vector search logic but doesn't directly call the context engine. Future integration could use context engine output as additional retrieval signals.

---

## Output Summary

After `selectContext()` completes, it returns:

```typescript
interface ContextSelection {
  rankedFiles: FileScore[];       // Top-N files with scores
  chunks: CodeChunk[];            // Relevant chunks from large files
  symbols: SymbolInfo[];          // File structure overview
  repo: RepoIntelligence | null;  // High-level repo metadata
  summary: string;                // Human-readable summary of selection
  tokenEstimate: number;          // Approximate token count of all context
}
```

Example summary output:
```
Context for: "Add rate limiting to auth middleware"
Selected 5 files (src/middleware/auth.ts, src/routes/api.ts...)
Project: node npm | Languages: TypeScript | Frameworks: Express, React
Recent changes: Modified src/middleware/auth.ts, Added src/middleware/rateLimit.ts
Areas: src (12 files), tests (5 files), config (3 files)
Chunked 2 large files, kept relevant slices
Symbols: authenticate, RateLimiter, createRouter...
Token estimate: ~8k for chunks + file overviews
```

---

## Current Limitations

| Limitation | Details |
|-----------|---------|
| Not used in single-agent mode | Currently only called by `Coordinator` in multi-agent mode |
| No LLM-based ranking | Ranking uses heuristic scoring, not semantic similarity |
| No incremental updates | Intelligence is recomputed from scratch each time |
| Limited language support | Best for TS/JS/Python/Go; other languages degrade gracefully |
| Chunk boundaries are heuristic | Blank-line splitting works for most code but misses some patterns |
