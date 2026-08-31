type Handler<T> = (payload: T) => void | Promise<void>;

/**
 * Minimal typed event emitter.
 *
 * Handlers are invoked sequentially and errors are swallowed after being
 * reported to `onError`. A broken listener must never take down the run.
 */
export class Emitter<TEvents extends object> {
  private readonly handlers = new Map<keyof TEvents, Set<Handler<never>>>();

  constructor(private readonly onError?: (error: unknown, event: keyof TEvents) => void) {}

  on<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as Handler<never>);
    this.handlers.set(event, set);
    return () => this.off(event, handler);
  }

  once<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    const dispose = this.on(event, (payload) => {
      dispose();
      void handler(payload);
    });
    return dispose;
  }

  off<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        void (handler as Handler<TEvents[K]>)(payload);
      } catch (error) {
        this.onError?.(error, event);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }

  listenerCount(event: keyof TEvents): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}
