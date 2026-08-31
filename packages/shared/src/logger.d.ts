import type { Logger } from 'pino';
export declare function logFilePath(): string;
export declare function getLogger(component?: string): Logger;
/** Flush buffered writes; call before exiting to avoid losing the tail. */
export declare function closeLogger(): Promise<void>;
//# sourceMappingURL=logger.d.ts.map