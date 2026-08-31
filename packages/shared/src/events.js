/**
 * Minimal typed event emitter.
 *
 * Handlers are invoked sequentially and errors are swallowed after being
 * reported to `onError`. A broken listener must never take down the run.
 */
export class Emitter {
    onError;
    handlers = new Map();
    constructor(onError) {
        this.onError = onError;
    }
    on(event, handler) {
        const set = this.handlers.get(event) ?? new Set();
        set.add(handler);
        this.handlers.set(event, set);
        return () => this.off(event, handler);
    }
    once(event, handler) {
        const dispose = this.on(event, (payload) => {
            dispose();
            void handler(payload);
        });
        return dispose;
    }
    off(event, handler) {
        this.handlers.get(event)?.delete(handler);
    }
    emit(event, payload) {
        const set = this.handlers.get(event);
        if (!set)
            return;
        for (const handler of [...set]) {
            try {
                void handler(payload);
            }
            catch (error) {
                this.onError?.(error, event);
            }
        }
    }
    clear() {
        this.handlers.clear();
    }
    listenerCount(event) {
        return this.handlers.get(event)?.size ?? 0;
    }
}
//# sourceMappingURL=events.js.map