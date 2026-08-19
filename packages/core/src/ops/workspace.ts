import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { ResolvedConfig } from '../vite/config.js'

export interface ThemeSummary {
  id: string
  name: string
  description?: string
  hasDemo: boolean
}

export interface ThemeDetail extends ThemeSummary {
  markdown: string
  demoId?: string
}

/** Frontmatter only — the body is markdown meant to be read, not parsed. */
function frontmatter(markdown: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown)
  if (!match) return {}
  const out: Record<string, string> = {}
  for (const line of (match[1] as string).split('\n')) {
    const at = line.indexOf(':')
    if (at === -1) continue
    out[line.slice(0, at).trim()] = line
      .slice(at + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
  }
  return out
}

export function listThemes(config: ResolvedConfig): ThemeSummary[] {
  const dir = join(config.root, config.themesDir)
  if (!existsSync(dir)) return []

  return readdirSync(dir)
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .sort()
    .map((file) => {
      const id = file.replace(/\.md$/, '')
      const meta = frontmatter(readFileSync(join(dir, file), 'utf8'))
      const summary: ThemeSummary = {
        id,
        name: meta.name ?? id,
        hasDemo: existsSync(join(dir, `${id}.demo.tsx`)),
      }
      if (meta.description) summary.description = meta.description
      return summary
    })
}

export function readTheme(config: ResolvedConfig, id: string): ThemeDetail {
  const dir = join(config.root, config.themesDir)
  const file = join(dir, `${id}.md`)
  if (!existsSync(file)) {
    const known = listThemes(config).map((theme) => theme.id)
    throw Object.assign(
      new Error(`no theme "${id}"${known.length ? ` (known: ${known.join(', ')})` : ''}`),
      {
        status: 404,
      },
    )
  }
  const markdown = readFileSync(file, 'utf8')
  const meta = frontmatter(markdown)
  const detail: ThemeDetail = {
    id,
    name: meta.name ?? id,
    hasDemo: existsSync(join(dir, `${id}.demo.tsx`)),
    markdown,
  }
  if (meta.description) detail.description = meta.description
  return detail
}

export interface AssetSummary {
  name: string
  path: string
  bytes: number
  kind: string
  /** No workbook or theme imports it. */
  unused: boolean
  importLine: string
}

const KINDS: Record<string, string> = {
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.webp': 'image',
  '.woff': 'font',
  '.woff2': 'font',
  '.csv': 'data',
  '.json': 'data',
}

function sourceFiles(config: ResolvedConfig): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(tsx?|md)$/.test(entry.name)) out.push(path)
    }
  }
  walk(join(config.root, config.sheetsDir))
  walk(join(config.root, config.themesDir))
  return out
}

/**
 * "Unused" is a grep across workbook and theme sources. It is a hint, not a
 * verdict — a file referenced by a computed path will look unused, so nothing
 * acts on it automatically.
 */
export function listAssets(config: ResolvedConfig): AssetSummary[] {
  const dir = join(config.root, 'assets')
  if (!existsSync(dir)) return []

  const sources = sourceFiles(config).map((file) => readFileSync(file, 'utf8'))

  return readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => {
      const path = join(dir, name)
      const stat = statSync(path)
      return {
        name,
        path,
        bytes: stat.size,
        kind: KINDS[extname(name).toLowerCase()] ?? 'file',
        unused: !sources.some((source) => source.includes(name)),
        importLine: `import ${identifier(name)} from '../../assets/${name}'`,
      }
    })
}

function identifier(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9]+(.)/g, (_, ch: string) => ch.toUpperCase())
  return /^[A-Za-z_]/.test(base) ? base : `asset${base}`
}
