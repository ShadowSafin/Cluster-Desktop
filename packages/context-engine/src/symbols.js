/**
 * Symbol / function extraction.
 *
 * Lightweight, regex-based extraction without tree-sitter for portability.
 * Falls back gracefully when parsing fails; used to build smarter context.
 */
// Basic patterns for several languages
const PATTERNS = [
    { regex: /^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/, kind: 'function', nameGroup: 1 },
    { regex: /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/, kind: 'function', nameGroup: 1 },
    { regex: /^\s*export\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/, kind: 'class', nameGroup: 1 },
    { regex: /^\s*class\s+([A-Za-z_$][\w$]*)/, kind: 'class', nameGroup: 1 },
    { regex: /^\s*export\s+interface\s+([A-Za-z_$][\w$]*)/, kind: 'interface', nameGroup: 1 },
    { regex: /^\s*interface\s+([A-Za-z_$][\w$]*)/, kind: 'interface', nameGroup: 1 },
    { regex: /^\s*export\s+type\s+([A-Za-z_$][\w$]*)\s*=/, kind: 'type', nameGroup: 1 },
    { regex: /^\s*type\s+([A-Za-z_$][\w$]*)\s*=/, kind: 'type', nameGroup: 1 },
    { regex: /^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/, kind: 'variable', nameGroup: 1 },
    { regex: /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/, kind: 'variable', nameGroup: 1 },
    { regex: /^\s*import\s+.*from\s+['"]/, kind: 'import', nameGroup: 0 },
    { regex: /^\s*export\s+.*from\s+['"]/, kind: 'export', nameGroup: 0 },
    // Arrow functions assigned to const
    { regex: /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/, kind: 'function', nameGroup: 1 },
    // Python-ish
    { regex: /^\s*def\s+([A-Za-z_][\w]*)\s*\(/, kind: 'function', nameGroup: 1 },
    { regex: /^\s*class\s+([A-Za-z_][\w]*)\s*[\(:]/, kind: 'class', nameGroup: 1 },
];
export function extractSymbols(file, content) {
    const lines = content.split('\n');
    const symbols = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { regex, kind, nameGroup } of PATTERNS) {
            const m = regex.exec(line);
            if (m) {
                const name = nameGroup === 0 ? line.trim().slice(0, 80) : m[nameGroup] ?? '';
                if (!name)
                    continue;
                // Avoid duplicates on same line for same name
                if (symbols.some((s) => s.line === i + 1 && s.name === name))
                    continue;
                symbols.push({
                    name,
                    kind,
                    line: i + 1,
                    signature: line.trim().slice(0, 160),
                    file,
                });
                break; // one symbol per line
            }
        }
    }
    return symbols;
}
export function symbolsToSummary(symbols, max = 30) {
    if (symbols.length === 0)
        return '(no symbols found)';
    const grouped = new Map();
    for (const s of symbols.slice(0, max)) {
        const arr = grouped.get(s.kind) ?? [];
        arr.push(s);
        grouped.set(s.kind, arr);
    }
    const parts = [];
    for (const [kind, list] of grouped) {
        parts.push(`${kind}s: ${list.map((s) => `${s.name} (L${s.line})`).join(', ')}`);
    }
    return parts.join('\n');
}
export function findSymbol(symbols, name) {
    return symbols.find((s) => s.name === name);
}
export function filterRelevantSymbols(symbols, query) {
    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
    return symbols.filter((s) => tokens.some((t) => s.name.toLowerCase().includes(t) || s.signature.toLowerCase().includes(t)));
}
//# sourceMappingURL=symbols.js.map