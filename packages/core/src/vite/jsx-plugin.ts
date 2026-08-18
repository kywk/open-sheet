import { join } from 'node:path'
import type { Plugin } from 'vite'
import type { ResolvedConfig } from './config.js'

const PRAGMA = '/** @jsxImportSource @open-sheet/core */\n'

/**
 * Workbooks are JSX but not React, and the bundler's default import source is
 * React. Rather than depend on a build-tool-specific option name — which has
 * already moved once, from esbuild to oxc — this injects the standard pragma,
 * which every JSX transform honours.
 */
export function jsxPlugin(config: ResolvedConfig): Plugin {
  const sheets = join(config.root, config.sheetsDir)
  const themes = join(config.root, config.themesDir)

  return {
    name: 'open-sheet:jsx',
    enforce: 'pre',
    transform(code, id) {
      const [path] = id.split('?')
      if (!path?.endsWith('.tsx') && !path?.endsWith('.jsx')) return undefined
      if (!path.startsWith(sheets) && !path.startsWith(themes)) return undefined
      if (code.includes('@jsxImportSource')) return undefined
      return { code: PRAGMA + code, map: null }
    },
  }
}
