import { existsSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface ResolvedConfig {
  root: string
  sheetsDir: string
  themesDir: string
  port: number
}

export const DEFAULT_PORT = 5373

/**
 * `open-sheet.config.ts` is loaded through Vite when the dev server starts, so
 * this only fills in the defaults and normalises paths.
 *
 * The root is resolved to its real path here, once. Vite reports module ids as
 * real paths, so anything comparing against an unresolved root silently fails
 * for a workspace behind a symlink — which is every workspace under /tmp on
 * macOS. That mismatch cost a 403 from fs.allow, a skipped JSX pragma, and an
 * SSR failure before it was traced to one line.
 */
export function resolveConfig(
  root: string,
  overrides: Partial<ResolvedConfig> = {},
): ResolvedConfig {
  return {
    root: realPath(resolve(root)),
    sheetsDir: overrides.sheetsDir ?? 'sheets',
    themesDir: overrides.themesDir ?? 'themes',
    port: overrides.port ?? DEFAULT_PORT,
  }
}

function realPath(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

export function configPath(root: string): string | undefined {
  for (const name of ['open-sheet.config.ts', 'open-sheet.config.js', 'open-sheet.config.mjs']) {
    const path = join(root, name)
    if (existsSync(path)) return path
  }
  return undefined
}
