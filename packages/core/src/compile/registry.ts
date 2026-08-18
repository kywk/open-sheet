import type { Addr, Rect } from '../model/geometry.js'

export interface TableAnchor {
  kind: 'table'
  name: string
  sheet: string
  rect: Rect
  titleRow?: number
  headerRow?: number
  firstDataRow: number
  lastDataRow: number
  rowCount: number
  totalRow?: number
  columns: Map<string, number>
}

export interface KeyValueAnchor {
  kind: 'keyValue'
  name: string
  sheet: string
  rect: Rect
  keys: Map<string, Addr>
}

export type Anchor = TableAnchor | KeyValueAnchor

export type Registry = Map<string, Anchor>

export function requireAnchor(registry: Registry, name: string): Anchor {
  const anchor = registry.get(name)
  if (anchor) return anchor
  const known = [...registry.keys()]
  const suggestion = nearest(name, known)
  throw new Error(
    `no block named "${name}"` +
      (suggestion ? `; did you mean "${suggestion}"?` : '') +
      (known.length ? ` (known: ${known.join(', ')})` : ''),
  )
}

export function requireColumn(anchor: TableAnchor, column: string): number {
  const index = anchor.columns.get(column)
  if (index !== undefined) return index
  const known = [...anchor.columns.keys()]
  const suggestion = nearest(column, known)
  throw new Error(
    `no column "${column}" in table "${anchor.name}"` +
      (suggestion ? `; did you mean "${suggestion}"?` : '') +
      ` (columns: ${known.join(', ')})`,
  )
}

function nearest(target: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const distance = editDistance(target.toLowerCase(), candidate.toLowerCase())
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return bestDistance <= Math.max(2, Math.floor(target.length / 3)) ? best : undefined
}

function editDistance(a: string, b: string): number {
  const prev = new Array<number>(b.length + 1)
  const curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j += 1) prev[j] = j
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        (curr[j - 1] as number) + 1,
        (prev[j] as number) + 1,
        (prev[j - 1] as number) + cost,
      )
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j] as number
  }
  return prev[b.length] as number
}
