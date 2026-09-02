import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@cluster/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@cluster/storage': path.resolve(__dirname, '../../packages/storage/src/index.ts'),
      '@cluster/workspace': path.resolve(__dirname, '../../packages/workspace/src/index.ts'),
      '@cluster/agent-core': path.resolve(__dirname, '../../packages/agent-core/src/index.ts'),
      '@cluster/tool-runtime': path.resolve(__dirname, '../../packages/tool-runtime/src/index.ts'),
      '@cluster/task-engine': path.resolve(__dirname, '../../packages/task-engine/src/index.ts'),
      '@cluster/memory': path.resolve(__dirname, '../../packages/memory/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
