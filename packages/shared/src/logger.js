import path from 'node:path';
import pino from 'pino';
import { clusterHome } from './paths.js';
/**
 * Structured logging.
 *
 * Logs always go to a file, never to stdout: the terminal belongs to Ink, and
 * interleaved JSON would corrupt the render tree.
 */
let root = null;
export function logFilePath() {
    return path.join(clusterHome(), 'logs', 'cluster.log');
}
function createRoot() {
    const level = process.env.CLUSTER_LOG_LEVEL?.trim() || 'info';
    return pino({
        level,
        base: { pid: process.pid },
        timestamp: pino.stdTimeFunctions.isoTime,
    }, pino.destination({ dest: logFilePath(), sync: false, mkdir: true }));
}
export function getLogger(component = 'cluster') {
    if (!root)
        root = createRoot();
    return root.child({ component });
}
/** Flush buffered writes; call before exiting to avoid losing the tail. */
export async function closeLogger() {
    if (!root)
        return;
    const instance = root;
    root = null;
    await new Promise((resolve) => {
        instance.flush(() => resolve());
    });
}
//# sourceMappingURL=logger.js.map