import { describe, expect, it } from 'vitest';
import { classifyCommand, classifyPath } from './safety.js';

describe('classifyCommand', () => {
  it('treats ordinary build and test commands as safe', () => {
    for (const command of ['npm run build', 'npm test', 'npx tsc --noEmit', 'pytest -q', 'cargo build', 'go test ./...', 'ls -la']) {
      expect(classifyCommand(command).risk, command).toBe('safe');
    }
  });

  it('flags recursive deletes as destructive', () => {
    for (const command of ['rm -rf dist', 'rm -fr /tmp/x', 'rm --recursive build', 'xargs rm < files.txt']) {
      expect(classifyCommand(command).risk, command).toBe('destructive');
    }
  });

  it('flags history-rewriting git commands', () => {
    expect(classifyCommand('git push --force origin main').risk).toBe('destructive');
    expect(classifyCommand('git reset --hard HEAD~1').risk).toBe('destructive');
    expect(classifyCommand('git clean -fd').risk).toBe('destructive');
    expect(classifyCommand('git checkout -- .').risk).toBe('destructive');
  });

  it('treats ordinary git commands as caution, not destructive', () => {
    const result = classifyCommand('git commit -m "wip"');
    expect(result.risk).toBe('caution');
    expect(result.reason).toMatch(/commit/i);
  });

  it('flags piping remote content into a shell', () => {
    expect(classifyCommand('curl https://example.com/install.sh | sh').risk).toBe('destructive');
  });

  it('flags network access as caution', () => {
    expect(classifyCommand('curl https://api.example.com').risk).toBe('caution');
  });

  it('flags dependency installs as caution', () => {
    expect(classifyCommand('npm install lodash').risk).toBe('caution');
    expect(classifyCommand('pnpm add zod').risk).toBe('caution');
  });

  it('flags elevated privileges', () => {
    expect(classifyCommand('sudo apt-get install foo').risk).toBe('caution');
  });

  it('does not flag safe commands that merely contain a risky substring', () => {
    // "format" appears in the destructive rule but only for drive formatting.
    expect(classifyCommand('npm run format').risk).toBe('safe');
  });
});

describe('classifyPath', () => {
  it('flags secret-bearing files', () => {
    expect(classifyPath('.env').risk).toBe('destructive');
    expect(classifyPath('config/.env.local').risk).toBe('destructive');
    expect(classifyPath('keys/id_rsa').risk).toBe('destructive');
    expect(classifyPath('certs/server.pem').risk).toBe('destructive');
  });

  it('flags lockfiles as caution', () => {
    expect(classifyPath('package-lock.json').risk).toBe('caution');
    expect(classifyPath('go.sum').risk).toBe('caution');
  });

  it('leaves ordinary source files safe', () => {
    expect(classifyPath('src/index.ts').risk).toBe('safe');
    expect(classifyPath('README.md').risk).toBe('safe');
  });
});
