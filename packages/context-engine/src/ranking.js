/**
 * Smarter context ranking and file relevance scoring.
 *
 * Reduces token waste by selecting only the most relevant files
 * instead of dumping too much context.
 */
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'to', 'of', 'in', 'for', 'on', 'with', 'as', 'by', 'at']);
function tokenize(query) {
    return query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}
function scorePath(path, tokens) {
    const lower = path.toLowerCase();
    let score = 0;
    const reasons = [];
    for (const token of tokens) {
        if (lower.includes(token)) {
            // Filename vs directory distinction
            const filename = lower.split('/').pop() ?? '';
            if (filename.includes(token)) {
                score += 10;
                reasons.push(`filename matches "${token}"`);
            }
            else {
                score += 4;
                reasons.push(`path contains "${token}"`);
            }
        }
    }
    // Prefer shorter paths for highly relevant matches (avoid deep node_modules but those are ignored)
    // Boost source directories
    if (lower.startsWith('src/') || lower.startsWith('packages/') || lower.startsWith('apps/')) {
        score += 2;
        reasons.push('in source directory');
    }
    if (lower.endsWith('.test.ts') || lower.endsWith('.spec.ts')) {
        score += 1;
        reasons.push('test file');
    }
    // Penalize very large files (will be chunked)
    if (lower.includes('generated') || lower.includes('dist') || lower.includes('build')) {
        score -= 5;
        reasons.push('likely generated');
    }
    return { score, reasons };
}
export function rankFiles(candidates, options) {
    const tokens = tokenize(options.query);
    const importantSet = new Set((options.importantFiles ?? []).map((p) => p.toLowerCase()));
    const changedSet = new Set((options.gitChangedFiles ?? []).map((p) => p.toLowerCase()));
    const frameworkSet = new Set(options.frameworks ?? []);
    const scores = candidates.map((file) => {
        const base = scorePath(file.path, tokens);
        let score = base.score;
        const reasons = [...base.reasons];
        // Content preview scoring: if file content contains query terms
        if (file.contentPreview) {
            const lowerPreview = file.contentPreview.toLowerCase();
            for (const token of tokens) {
                if (lowerPreview.includes(token)) {
                    score += 6;
                    reasons.push(`content mentions "${token}"`);
                    break;
                }
            }
        }
        if (importantSet.has(file.path.toLowerCase())) {
            score += 15;
            reasons.push('marked important');
        }
        if (changedSet.has(file.path.toLowerCase())) {
            score += 12;
            reasons.push('recently changed');
        }
        // Language boost based on query hint
        if (file.language) {
            if (frameworkSet.has(file.language.toLowerCase())) {
                score += 3;
                reasons.push(`framework: ${file.language}`);
            }
        }
        // Size penalty for very large files
        if (file.size > 100 * 1024) {
            score -= 3;
            reasons.push('large file (will be chunked)');
        }
        // Area grouping bonus if multiple files in same area as query
        if (file.area) {
            const areaTokens = tokenize(file.area);
            for (const t of tokens) {
                if (areaTokens.includes(t)) {
                    score += 5;
                    reasons.push(`area "${file.area}" matches query`);
                }
            }
        }
        return {
            path: file.path,
            score,
            reasons: reasons.slice(0, 3),
            language: file.language,
            size: file.size,
            area: file.area,
        };
    });
    scores.sort((a, b) => b.score - a.score);
    // Select top files under token budget
    const maxFiles = options.maxFiles ?? 12;
    const maxTokens = options.maxTokens ?? 32_000;
    const selected = [];
    let tokensUsed = 0;
    for (const scored of scores) {
        if (selected.length >= maxFiles)
            break;
        // Rough token estimate: size / 4, capped, but we use score to filter low relevance
        if (scored.score <= 0 && selected.length >= 3)
            continue;
        const estTokens = Math.min(scored.size / 4, 4000);
        if (tokensUsed + estTokens > maxTokens && selected.length >= 5)
            break;
        selected.push(scored);
        tokensUsed += estTokens;
    }
    // Always include at least top 3 if scores positive, else top 3 anyway for context
    if (selected.length === 0 && scores.length > 0) {
        selected.push(...scores.slice(0, 3));
    }
    return selected;
}
export function groupByArea(files) {
    const groups = new Map();
    for (const file of files) {
        const area = file.area ?? file.path.split('/')[0] ?? 'root';
        const arr = groups.get(area) ?? [];
        arr.push(file);
        groups.set(area, arr);
    }
    return groups;
}
//# sourceMappingURL=ranking.js.map