import path from 'node:path';
import { watch } from 'chokidar';
import { Emitter, toPosix } from '@cluster/shared';
const WATCH_IGNORE = [
    /(^|[/\\])node_modules([/\\]|$)/,
    /(^|[/\\])\.git([/\\]|$)/,
    /(^|[/\\])dist([/\\]|$)/,
    /(^|[/\\])\.cluster([/\\]|$)/,
];
export function watchWorkspace(root, options = {}) {
    const events = new Emitter((error) => events.emit('error', error));
    if (options.enabled === false) {
        return { events, close: async () => undefined };
    }
    let watcher = null;
    try {
        watcher = watch(root, {
            ignoreInitial: true,
            ignored: WATCH_IGNORE,
            // Avoid firing on half-written files, which editors produce constantly.
            awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
            depth: 8,
        });
        const emit = (type) => (target) => {
            events.emit('change', {
                type,
                path: target,
                relative: toPosix(path.relative(root, target)),
                at: new Date().toISOString(),
            });
        };
        watcher
            .on('add', emit('add'))
            .on('change', emit('change'))
            .on('unlink', emit('unlink'))
            .on('addDir', emit('addDir'))
            .on('unlinkDir', emit('unlinkDir'))
            .on('error', (error) => events.emit('error', error instanceof Error ? error : new Error(String(error))))
            .on('ready', () => events.emit('ready', undefined));
    }
    catch (error) {
        events.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
    return {
        events,
        close: async () => {
            if (watcher) {
                const instance = watcher;
                watcher = null;
                await instance.close().catch(() => undefined);
            }
            events.clear();
        },
    };
}
//# sourceMappingURL=watch.js.map