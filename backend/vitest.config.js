import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup/env.js', 'tests/setup/global.js'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
    },
  },
});
