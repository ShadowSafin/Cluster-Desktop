export type Ok<T> = {
    ok: true;
    value: T;
};
export type Err<E> = {
    ok: false;
    error: E;
};
export type Result<T, E = Error> = Ok<T> | Err<E>;
export declare function ok<T>(value: T): Ok<T>;
export declare function err<E>(error: E): Err<E>;
export declare function toError(value: unknown): Error;
export declare function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T, Error>>;
export declare function tryCatch<T>(fn: () => T): Promise<Result<T, Error>>;
//# sourceMappingURL=result.d.ts.map