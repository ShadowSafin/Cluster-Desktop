export function ok(value) {
    return { ok: true, value };
}
export function err(error) {
    return { ok: false, error };
}
export function toError(value) {
    if (value instanceof Error)
        return value;
    if (typeof value === 'string')
        return new Error(value);
    try {
        return new Error(JSON.stringify(value));
    }
    catch {
        return new Error(String(value));
    }
}
export async function tryCatch(fn) {
    try {
        return ok(await fn());
    }
    catch (caught) {
        return err(toError(caught));
    }
}
//# sourceMappingURL=result.js.map