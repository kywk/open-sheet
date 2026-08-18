import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface Discovered {
  id: string
  file: string
}

export function discoverSheets(root: string, dir = 'sheets'): Discovered[] {
  const base = join(root, dir)
  if (!existsSync(base)) return []

  const found: Discovered[] = []
  for (const entry of readdirSync(base).sort()) {
    const path = join(base, entry)
    if (!statSync(path).isDirectory()) continue
    for (const candidate of ['index.tsx', 'index.ts']) {
      const file = join(path, candidate)
      if (existsSync(file)) {
        found.push({ id: entry, file })
        break
      }
    }
  }
  return found
}
