import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/server.ts', 'src/vendor/**'],
      // Piso común; el mínimo por riesgo (50/70/80 % de líneas) lo exige policy-check (COD-05).
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 50, functions: 50, branches: 50, statements: 50 },
    },
  },
});
