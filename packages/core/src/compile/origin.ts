import type { Addr } from '../model/geometry.js'
import type { Registry, TableAnchor } from './registry.js'

export interface CellOrigin {
  /** Name of the block that produced this cell. */
  block: string
  kind: 'table' | 'keyValue'
  /** Column key for a table cell, or the entry key for a key-value block. */
  column?: string
  /** Zero-based index within `data`, when the cell is a data row. */
  row?: number
  part: 'title' | 'header' | 'data' | 'total'
}

/**
 * Which authoring construct produced a given cell. The registry already records
 * where every named block landed, so this is a lookup rather than a search —
 * and it means the compiler stays free of source-location bookkeeping.
 */
export function originOf(registry: Registry, sheet: string, addr: Addr): CellOrigin | undefined {
  for (const anchor of registry.values()) {
    if (anchor.sheet !== sheet) continue
    const { rect } = anchor
    if (
      addr.r < rect.r ||
      addr.r >= rect.r + rect.rows ||
      addr.c < rect.c ||
      addr.c >= rect.c + rect.cols
    ) {
      continue
    }

    if (anchor.kind === 'keyValue') {
      for (const [key, at] of anchor.keys) {
        if (at.r === addr.r && at.c === addr.c) {
          return { block: anchor.name, kind: 'keyValue', column: key, part: 'data' }
        }
      }
      return { block: anchor.name, kind: 'keyValue', part: 'title' }
    }

    const table = anchor as TableAnchor
    let column: string | undefined
    for (const [key, index] of table.columns) if (index === addr.c) column = key

    if (table.titleRow === addr.r) return { block: table.name, kind: 'table', part: 'title' }
    if (table.headerRow === addr.r) {
      return column
        ? { block: table.name, kind: 'table', column, part: 'header' }
        : { block: table.name, kind: 'table', part: 'header' }
    }
    if (table.totalRow === addr.r) {
      return column
        ? { block: table.name, kind: 'table', column, part: 'total' }
        : { block: table.name, kind: 'table', part: 'total' }
    }
    if (addr.r >= table.firstDataRow && addr.r <= table.lastDataRow && column) {
      return {
        block: table.name,
        kind: 'table',
        column,
        row: addr.r - table.firstDataRow,
        part: 'data',
      }
    }
    return { block: table.name, kind: 'table', part: 'data' }
  }
  return undefined
}
