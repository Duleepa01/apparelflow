import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  resolve: { alias: { '@': path.resolve(process.cwd(), '.') } },
  test: {
    environment: 'node',
    env: loadEnv(mode, process.cwd(), ''),
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
}));