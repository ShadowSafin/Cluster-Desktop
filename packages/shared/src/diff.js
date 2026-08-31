/**
 * Line-oriented diff engine.
 *
 * Pure, dependency-free, and used by three consumers with different needs:
 *   - the patch tool, to preview and apply changes
 *   - the session store, to persist what changed
 *   - the TUI, to render readable diffs
 *
 * Implementation: trim the common prefix/suffix, then run a classic LCS
 * dynamic program on the differing middle. The DP is O(n*m) in time and
 * memory, so it is only used when the product stays under `maxCells`; beyond
 * that we degrade to a whole-block replace rather than hanging the UI.
 */
const DEFAULT_CONTEXT = 3;
const DEFAULT_MAX_CELLS = 1_000_000;
/** Split text into logical lines, normalising CRLF and dropping the trailing terminator. */
export function splitLines(text) {
    const normalised = text.replace(/\r\n/g, '\n');
    const lines = normalised.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '')
        lines.pop();
    return lines;
}
export function joinLines(lines, trailingNewline) {
    return lines.join('\n') + (trailingNewline && lines.length > 0 ? '\n' : '');
}
export function endsWithNewline(text) {
    return text.endsWith('\n');
}
export function diffLines(oldText, newText, options = {}) {
    const context = options.context ?? DEFAULT_CONTEXT;
    const maxCells = options.maxCells ?? DEFAULT_MAX_CELLS;
    const a = splitLines(oldText);
    const b = splitLines(newText);
    const ops = buildOps(a, b, maxCells);
    return { hunks: buildHunks(ops, context), ...countChanges(ops) };
}
function buildOps(a, b, maxCells) {
    // Common prefix.
    let prefix = 0;
    while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix])
        prefix += 1;
    // Common suffix (only within the region left after the prefix).
    let suffix = 0;
    while (suffix < a.length - prefix &&
        suffix < b.length - prefix &&
        a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) {
        suffix += 1;
    }
    const midA = a.slice(prefix, a.length - suffix);
    const midB = b.slice(prefix, b.length - suffix);
    const ops = [];
    const push = (type, text, oldIdx, newIdx) => {
        ops.push({ type, text, oldLineNo: oldIdx === null ? null : oldIdx + 1, newLineNo: newIdx === null ? null : newIdx + 1 });
    };
    for (let i = 0; i < prefix; i += 1)
        push('context', a[i], i, i);
    const middle = midA.length * midB.length > maxCells
        ? blockReplace(midA, midB, prefix)
        : lcsOps(midA, midB, prefix);
    for (const op of middle)
        push(op.type, op.text, op.oldLineNo === null ? null : op.oldLineNo - 1, op.newLineNo === null ? null : op.newLineNo - 1);
    for (let i = a.length - suffix; i < a.length; i += 1) {
        const j = b.length - suffix + (i - (a.length - suffix));
        push('context', a[i], i, j);
    }
    return ops;
}
function blockReplace(midA, midB, offset) {
    const ops = [];
    for (let i = 0; i < midA.length; i += 1) {
        ops.push({ type: 'remove', text: midA[i], oldLineNo: offset + i + 1, newLineNo: null });
    }
    for (let j = 0; j < midB.length; j += 1) {
        ops.push({ type: 'add', text: midB[j], oldLineNo: null, newLineNo: offset + j + 1 });
    }
    return ops;
}
/** Dynamic-programming LCS over the differing middle region. */
function lcsOps(a, b, offset) {
    const n = a.length;
    const m = b.length;
    const width = m + 1;
    const dp = new Int32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = m - 1; j >= 0; j -= 1) {
            dp[i * width + j] =
                a[i] === b[j]
                    ? dp[(i + 1) * width + (j + 1)] + 1
                    : Math.max(dp[(i + 1) * width + j], dp[i * width + (j + 1)]);
        }
    }
    const ops = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            ops.push({ type: 'context', text: a[i], oldLineNo: offset + i + 1, newLineNo: offset + j + 1 });
            i += 1;
            j += 1;
        }
        else if (dp[(i + 1) * width + j] >= dp[i * width + (j + 1)]) {
            ops.push({ type: 'remove', text: a[i], oldLineNo: offset + i + 1, newLineNo: null });
            i += 1;
        }
        else {
            ops.push({ type: 'add', text: b[j], oldLineNo: null, newLineNo: offset + j + 1 });
            j += 1;
        }
    }
    while (i < n) {
        ops.push({ type: 'remove', text: a[i], oldLineNo: offset + i + 1, newLineNo: null });
        i += 1;
    }
    while (j < m) {
        ops.push({ type: 'add', text: b[j], oldLineNo: null, newLineNo: offset + j + 1 });
        j += 1;
    }
    return ops;
}
function buildHunks(ops, context) {
    const changedIndexes = [];
    for (let i = 0; i < ops.length; i += 1) {
        if (ops[i].type !== 'context')
            changedIndexes.push(i);
    }
    if (changedIndexes.length === 0)
        return [];
    // Group changes: start a new hunk when the gap is too wide for the context
    // windows of two hunks to merge. This guarantees hunks never overlap, which
    // is what makes `applyUnifiedDiff` positional arithmetic safe.
    const groups = [];
    let first = changedIndexes[0];
    let previous = changedIndexes[0];
    for (let k = 1; k < changedIndexes.length; k += 1) {
        const index = changedIndexes[k];
        if (index - previous > context * 2) {
            groups.push({ first, last: previous });
            first = index;
        }
        previous = index;
    }
    groups.push({ first, last: previous });
    return groups.map((group) => {
        const from = Math.max(0, group.first - context);
        const to = Math.min(ops.length, group.last + context + 1);
        const slice = ops.slice(from, to);
        let oldLines = 0;
        let newLines = 0;
        let oldStart = 0;
        let newStart = 0;
        let seenStart = false;
        for (const op of slice) {
            if (op.type !== 'add')
                oldLines += 1;
            if (op.type !== 'remove')
                newLines += 1;
            if (!seenStart) {
                if (op.oldLineNo !== null)
                    oldStart = op.oldLineNo;
                if (op.newLineNo !== null)
                    newStart = op.newLineNo;
                if (op.oldLineNo !== null || op.newLineNo !== null)
                    seenStart = true;
            }
        }
        // Unified-diff convention: an empty side reports the line before the change.
        return {
            oldStart: oldLines === 0 ? Math.max(0, oldStart - 1) : oldStart,
            newStart: newLines === 0 ? Math.max(0, newStart - 1) : newStart,
            oldLines,
            newLines,
            lines: slice,
        };
    });
}
function countChanges(ops) {
    let additions = 0;
    let deletions = 0;
    for (const op of ops) {
        if (op.type === 'add')
            additions += 1;
        if (op.type === 'remove')
            deletions += 1;
    }
    return { additions, deletions };
}
/** Render a standard unified diff, suitable for storage and for display. */
export function formatUnifiedDiff(filePath, oldText, newText, options = {}) {
    const { hunks } = diffLines(oldText, newText, options);
    if (hunks.length === 0)
        return '';
    const out = [`--- a/${filePath}`, `+++ b/${filePath}`];
    for (const hunk of hunks) {
        out.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
        for (const line of hunk.lines) {
            const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
            out.push(`${prefix}${line.text}`);
        }
    }
    return out.join('\n');
}
/**
 * Lenient parser for unified diffs produced by this module or by a model.
 * Tolerates a missing/incorrect `---`/`+++` header and file paths with or
 * without the `a/`/`b/` prefix.
 */
export function parseUnifiedDiff(diff) {
    const raw = diff.replace(/\r\n/g, '\n').split('\n');
    // A diff almost always ends with a newline. That terminator is not a blank
    // context line, and counting it as one would corrupt hunk matching.
    if (raw.length > 0 && raw[raw.length - 1] === '')
        raw.pop();
    let filePath = null;
    const hunks = [];
    let current = null;
    for (const rawLine of raw) {
        const line = rawLine;
        if (line.startsWith('@@')) {
            const match = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line);
            if (!match)
                continue;
            current = {
                oldStart: Number(match[1]),
                oldLines: match[2] === undefined ? 1 : Number(match[2]),
                newStart: Number(match[3]),
                newLines: match[4] === undefined ? 1 : Number(match[4]),
                lines: [],
            };
            hunks.push(current);
            continue;
        }
        if (current) {
            if (line.startsWith('\\'))
                continue; // "\ No newline at end of file"
            if (line.startsWith('+')) {
                current.lines.push({ type: 'add', text: line.slice(1) });
            }
            else if (line.startsWith('-')) {
                current.lines.push({ type: 'remove', text: line.slice(1) });
            }
            else if (line.startsWith(' ') || line === '') {
                current.lines.push({ type: 'context', text: line === '' ? '' : line.slice(1) });
            }
            else {
                // Unrecognised content while inside a hunk: treat as context so we do
                // not silently drop data.
                current.lines.push({ type: 'context', text: line });
            }
            continue;
        }
        if (line.startsWith('+++')) {
            const candidate = line.slice(4).trim();
            if (candidate && candidate !== '/dev/null' && filePath === null) {
                filePath = candidate.replace(/^b\//, '');
            }
        }
        else if (line.startsWith('---')) {
            const candidate = line.slice(4).trim();
            if (candidate && candidate !== '/dev/null' && filePath === null) {
                filePath = candidate.replace(/^a\//, '');
            }
        }
    }
    return { filePath, hunks };
}
/**
 * Apply a unified diff to `original`.
 *
 * Hunks are applied in order. Each hunk is matched at its recorded position
 * and, if that fails, within a bounded search window (`fuzz`) so that small
 * line drift does not reject an otherwise valid patch.
 */
export function applyUnifiedDiff(original, diff, options = {}) {
    const fuzz = options.fuzz ?? 40;
    const { hunks } = parseUnifiedDiff(diff);
    if (hunks.length === 0) {
        return { ok: false, content: original, error: 'No hunks found in the provided diff.' };
    }
    const lines = splitLines(original);
    let cursor = 0; // cumulative offset applied to recorded hunk positions
    for (const [index, hunk] of hunks.entries()) {
        const oldBlock = hunk.lines.filter((l) => l.type !== 'add').map((l) => l.text);
        const newBlock = hunk.lines.filter((l) => l.type !== 'remove').map((l) => l.text);
        const expected = Math.max(0, hunk.oldStart - 1 + cursor);
        const found = findBlock(lines, oldBlock, expected, fuzz);
        if (found === -1) {
            return {
                ok: false,
                content: original,
                error: `Hunk ${index + 1} could not be applied: the target lines were not found ` +
                    `near line ${hunk.oldStart}. The file may have changed since the diff was generated.`,
            };
        }
        lines.splice(found, oldBlock.length, ...newBlock);
        cursor += found - expected + (newBlock.length - oldBlock.length);
    }
    return { ok: true, content: joinLines(lines, endsWithNewline(original) || original === '') };
}
function findBlock(lines, block, expected, fuzz) {
    if (block.length === 0) {
        return Math.min(Math.max(expected, 0), lines.length);
    }
    const from = Math.max(0, expected - fuzz);
    const to = Math.min(lines.length - block.length, expected + fuzz);
    for (let i = from; i <= to; i += 1) {
        let match = true;
        for (let j = 0; j < block.length; j += 1) {
            if (lines[i + j] !== block[j]) {
                match = false;
                break;
            }
        }
        if (match)
            return i;
    }
    return -1;
}
//# sourceMappingURL=diff.js.map