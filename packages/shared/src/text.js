const ANSI_PATTERN = 
// eslint-disable-next-line no-control-regex
/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;
/** Remove ANSI escape sequences so raw command output can be rendered safely. */
export function stripAnsi(value) {
    return value.replace(ANSI_PATTERN, '');
}
/** Collapse control characters that would corrupt the Ink render tree. */
export function sanitizeForDisplay(value) {
    return stripAnsi(value)
        .replace(/\u0000/g, '')
        .replace(/\r/g, '');
}
export function truncate(value, max, suffix = '…') {
    if (value.length <= max)
        return value;
    return value.slice(0, Math.max(0, max - suffix.length)) + suffix;
}
/**
 * Keep the head and tail of a long block, dropping the middle.
 * Long command output should never be lost entirely, but it also should not
 * bury the UI in a wall of text.
 */
export function truncateLines(value, maxLines, marker = '…') {
    const lines = value.split('\n');
    if (lines.length <= maxLines)
        return value;
    const head = Math.ceil((maxLines - 1) / 2);
    const tail = maxLines - 1 - head;
    return [...lines.slice(0, head), `${marker} ${lines.length - maxLines + 1} lines hidden ${marker}`, ...lines.slice(lines.length - tail)].join('\n');
}
/** Rough token estimate (4 chars per token) used for context budgeting. */
export function estimateTokens(value) {
    return Math.ceil(value.length / 4);
}
export function formatDuration(ms) {
    if (ms < 1000)
        return `${Math.round(ms)}ms`;
    if (ms < 60_000)
        return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1000);
    return `${minutes}m ${seconds}s`;
}
export function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function pluralize(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}
/** Wrap text to a width without breaking long tokens onto their own lines. */
export function wrapText(value, width) {
    if (width <= 0)
        return [value];
    const out = [];
    for (const paragraph of value.split('\n')) {
        if (paragraph.length === 0) {
            out.push('');
            continue;
        }
        let line = '';
        for (const word of paragraph.split(/\s+/)) {
            if (line.length === 0) {
                line = word;
            }
            else if (line.length + 1 + word.length <= width) {
                line += ` ${word}`;
            }
            else {
                out.push(line);
                line = word;
            }
            while (line.length > width) {
                out.push(line.slice(0, width));
                line = line.slice(width);
            }
        }
        out.push(line);
    }
    return out;
}
export function indent(value, prefix = '  ') {
    return value
        .split('\n')
        .map((line) => `${prefix}${line}`)
        .join('\n');
}
//# sourceMappingURL=text.js.map