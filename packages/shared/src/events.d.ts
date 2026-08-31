type Handler<T> = (payload: T) => void | Promise<void>;
/**
 * Minimal typed event emitter.
 *
 * Handlers are invoked sequentially and errors are swallowed after being
 * reported to `onError`. A broken listener must never take down the run.
 */
export declare class Emitter<TEvents extends object> {
    private readonly onError?;
    private readonly handlers;
    constructor(onError?: (error: unknown, event: keyof TEvents) => void);
    on<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void;
    once<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void;
    off<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): void;
    emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void;
    clear(): void;
    listenerCount(event: keyof TEvents): number;
}
export {};
//# sourceMappingURL=events.d.ts.map