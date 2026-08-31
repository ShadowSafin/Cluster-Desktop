import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { displayPath, isWithin, PathEscapeError, relativeTo, resolveWithin, toPosix } from './paths.js';

const ROOT = path.resolve('/repo');

describe('isWithin', () => {
  it('accepts the root itself', () => {
    expect(isWithin(ROOT, ROOT)).toBe(true);
  });

  it('accepts nested paths', () => {
    expect(isWithin(ROOT, path.join(ROOT, 'src', 'index.ts'))).toBe(true);
  });

  it('rejects siblings that merely share a prefix', () => {
    // /repo-evil starts with /repo but is not inside it.
    expect(isWithin(ROOT, `${ROOT}-evil`)).toBe(false);
  });

  it('rejects parents', () => {
    expect(isWithin(ROOT, path.dirname(ROOT))).toBe(false);
  });
});

describe('resolveWithin', () => {
  it('resolves relative paths against the root', () => {
    expect(resolveWithin(ROOT, 'src/a.ts')).toBe(path.join(ROOT, 'src', 'a.ts'));
  });

  it('throws PathEscapeError for traversal', () => {
    expect(() => resolveWithin(ROOT, '../secrets')).toThrow(PathEscapeError);
  });

  it('throws for absolute paths outside the root', () => {
    expect(() => resolveWithin(ROOT, path.resolve('/etc/passwd'))).toThrow(PathEscapeError);
  });

  it('allows absolute paths that are inside the root', () => {
    const inside = path.join(ROOT, 'src', 'a.ts');
    expect(resolveWithin(ROOT, inside)).toBe(inside);
  });
});

describe('relativeTo / displayPath', () => {
  it('produces posix separators', () => {
    const relative = relativeTo(ROOT, path.join(ROOT, 'src', 'a.ts'));
    expect(relative.split(path.sep).join('/')).toBe(toPosix(relative));
  });

  it('falls back to the absolute path outside the root', () => {
    const outside = path.resolve('/elsewhere/x.ts');
    expect(displayPath(ROOT, outside)).toBe(outside);
  });
});
