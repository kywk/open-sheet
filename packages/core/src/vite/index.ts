import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import react from '@vitejs/plugin-react'
import type { InlineConfig, PluginOption } from 'vite'
import { apiPlugin } from './api-plugin.js'
import { appPlugin, packageRoot } from './app-plugin.js'
import type { ResolvedConfig } from './config.js'
import { jsxPlugin } from './jsx-plugin.js'
import { manifestPlugin } from './manifest-plugin.js'

const require = createRequire(import.meta.url)

const REACT_SPECIFIERS = [
  'react-dom/client',
  'react-dom',
  'react/jsx-dev-runtime',
  'react/jsx-runtime',
  'react',
] as const

/**
 * The viewer ships inside this package, so its React must resolve from here —
 * the user's workspace has no reason to depend on React to author a spreadsheet.
 *
 * Anchored regexes, not the object form: object aliases match by prefix, so a
 * `react-dom` entry rewrites `react-dom/client` into `.../react-dom/index.js/client`.
 */
function reactAliases(): { find: RegExp; replacement: string }[] {
  const out: { find: RegExp; replacement: string }[] = []
  for (const specifier of REACT_SPECIFIERS) {
    try {
      out.push({
        find: new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`),
        replacement: require.resolve(specifier),
      })
    } catch {
      // leave it to the workspace; a clear resolve error beats a wrong alias
    }
  }
  return out
}

/** The workspace root is already real (see resolveConfig); this is for our own package. */
function realPath(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/**
 * One instance of the compiler. The viewer imports it from this package while
 * workbooks import it by name; without an alias those can be two copies, and two
 * copies means a workbook compiled by one and rendered by the other.
 */
function coreAliases(): { find: RegExp; replacement: string }[] {
  const out: { find: RegExp; replacement: string }[] = []
  const entries: [RegExp, string][] = [
    [/^@open-sheet\/core\/jsx-dev-runtime$/, '@open-sheet/core/jsx-runtime'],
    [/^@open-sheet\/core\/jsx-runtime$/, '@open-sheet/core/jsx-runtime'],
    [/^@open-sheet\/core$/, '@open-sheet/core'],
  ]
  for (const [find, specifier] of entries) {
    try {
      out.push({ find, replacement: require.resolve(specifier) })
    } catch {
      // not self-resolvable: leave it to the workspace's own install
    }
  }
  return out
}

export function openSheetPlugins(config: ResolvedConfig): PluginOption[] {
  return [
    jsxPlugin(config),
    react({ include: /\/src\/app\/.*\.[jt]sx?$/ }),
    manifestPlugin(config),
    apiPlugin(config),
    appPlugin(config),
  ]
}

export function viteConfigFor(
  config: ResolvedConfig,
  extra: Partial<InlineConfig> = {},
): InlineConfig {
  const root = config.root
  return {
    root,
    configFile: false,
    logLevel: 'warn',
    appType: 'custom',
    plugins: openSheetPlugins(config),
    resolve: {
      alias: [...coreAliases(), ...reactAliases()],
      dedupe: ['react', 'react-dom'],
    },
    // Aliased straight to files, so there is nothing for the pre-bundler to do.
    optimizeDeps: { exclude: [...REACT_SPECIFIERS] },
    server: {
      port: config.port,
      fs: { allow: [root, realPath(packageRoot())] },
    },
    ...extra,
  }
}

export type { ResolvedConfig } from './config.js'
export { DEFAULT_PORT, resolveConfig } from './config.js'
