import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['electron/**/*.ts', 'shared/**/*.ts'],
      exclude: ['**/*.d.ts', '**/index.ts']
    }
  }
});
