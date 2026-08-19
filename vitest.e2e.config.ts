import { defineConfig } from 'vitest/config'

/**
 * The published-install check: packs the packages, installs them into a clean
 * directory, and drives a browser. Slow by nature, and the only thing that
 * catches faults which exist solely in the packaged shape.
 */
export default defineConfig({
  test: {
    include: ['packages/*/e2e/**/*.test.ts'],
    testTimeout: 600_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
})
