import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const core = fileURLToPath(new URL('./packages/core/src', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      // jsx-dev-runtime too: vitest transforms in dev mode, and without this the
      // suite silently resolves through dist/ — which passes locally after a
      // build and fails on a clean checkout.
      {
        find: /^@open-sheet\/core\/jsx-dev-runtime$/,
        replacement: `${core}/jsx-runtime.ts`,
      },
      { find: /^@open-sheet\/core\/jsx-runtime$/, replacement: `${core}/jsx-runtime.ts` },
      { find: /^@open-sheet\/core\/node$/, replacement: `${core}/node.ts` },
      { find: /^@open-sheet\/core$/, replacement: `${core}/index.ts` },
      {
        find: /^virtual:open-sheet\/manifest$/,
        replacement: `${core}/app/__fixtures__/manifest-stub.ts`,
      },
    ],
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@open-sheet/core',
  },
  test: {
    globals: true,
    include: ['packages/*/src/**/*.{test,spec}.{ts,tsx}'],
    // The published-install test packs, installs, and drives a browser. It is
    // slow and opt-in; CI runs it as its own job.
    exclude: ['**/node_modules/**', '**/dist/**', 'packages/*/e2e/**'],
    // The viewer needs a DOM; the compiler deliberately does not.
    environment: 'node',
    projects: undefined,
  },
})
