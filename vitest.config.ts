import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/**
 * Tests import packages by their workspace name (`@cluster/shared`) and resolve
 * directly to TypeScript sources, so `npm test` works without a prior build.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@cluster/shared': r('./packages/shared/src/index.ts'),
      '@cluster/workspace': r('./packages/workspace/src/index.ts'),
      '@cluster/storage': r('./packages/storage/src/index.ts'),
      '@cluster/tool-runtime': r('./packages/tool-runtime/src/index.ts'),
      '@cluster/task-engine': r('./packages/task-engine/src/index.ts'),
      '@cluster/context-engine': r('./packages/context-engine/src/index.ts'),
      '@cluster/memory': r('./packages/memory/src/index.ts'),
      '@cluster/ui-kit': r('./packages/ui-kit/src/index.ts'),
      '@cluster/agent-core': r('./packages/agent-core/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 20_000,
    pool: 'forks',
  },
});
