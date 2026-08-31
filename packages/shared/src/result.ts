export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

export async function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T, Error>>;
export async function tryCatch<T>(fn: () => T): Promise<Result<T, Error>>;
export async function tryCatch<T>(fn: () => T | Promise<T>): Promise<Result<T, Error>> {
  try {
    return ok(await fn());
  } catch (caught) {
    return err(toError(caught));
  }
}
