import type { DefinedName } from '../compile/emit.js'
import {
  type Registry,
  requireAnchor,
  requireColumn,
  type TableAnchor,
} from '../compile/registry.js'
import { qualify, rangeToA1, toA1 } from '../model/a1.js'
import type { Rect } from '../model/geometry.js'
import type { CellRef, NameRef, RangeRef, Ref } from './ref.js'

export interface ResolveContext {
  registry: Registry
  definedNames: Map<string, DefinedName>
  sheet: string
}

export interface ResolvedRef {
  sheet: string
  rect: Rect
  name?: string
}

export function resolveRef(ref: Ref, context: ResolveContext): ResolvedRef {
  switch (ref.kind) {
    case 'cell':
      return resolveCell(ref, context)
    case 'range':
      return resolveRange(ref, context)
    case 'name':
      return resolveName(ref, context)
  }
}

function asTable(anchor: ReturnType<typeof requireAnchor>, ref: Ref): TableAnchor {
  if (anchor.kind !== 'table') {
    throw new Error(
      `"${anchor.name}" is a key-value block; use ref('${anchor.name}').get(key) instead of ` +
        `${ref.kind === 'range' ? 'column()' : 'cell()/total()'}`,
    )
  }
  return anchor
}

function resolveCell(ref: CellRef, context: ResolveContext): ResolvedRef {
  const anchor = asTable(requireAnchor(context.registry, ref.block), ref)
  const c = requireColumn(anchor, ref.column)

  if (ref.part === 'header') {
    if (anchor.headerRow === undefined) {
      throw new Error(`table "${anchor.name}" has no header row to reference`)
    }
    return { sheet: anchor.sheet, rect: { r: anchor.headerRow, c, rows: 1, cols: 1 } }
  }

  if (ref.part === 'total') {
    if (anchor.totalRow === undefined) {
      throw new Error(
        `table "${anchor.name}" has no total row; add a total={{ ${ref.column}: 'sum' }} prop ` +
          'before referencing ref().total()',
      )
    }
    return { sheet: anchor.sheet, rect: { r: anchor.totalRow, c, rows: 1, cols: 1 } }
  }

  const row = ref.row ?? 0
  if (row < 0) {
    throw new Error(
      `row ${row} is before the first data row of table "${anchor.name}". ` +
        'A formula using r.prev() must guard with r.isFirst.',
    )
  }
  if (row >= anchor.rowCount) {
    throw new Error(
      `row ${row} is past the last data row of table "${anchor.name}" (${anchor.rowCount} rows). ` +
        'A formula using r.next() must guard with r.isLast.',
    )
  }
  return { sheet: anchor.sheet, rect: { r: anchor.firstDataRow + row, c, rows: 1, cols: 1 } }
}

function resolveRange(ref: RangeRef, context: ResolveContext): ResolvedRef {
  const anchor = asTable(requireAnchor(context.registry, ref.block), ref)
  if (anchor.rowCount === 0) {
    throw new Error(`table "${anchor.name}" has no data rows, so it has no range to reference`)
  }
  if (ref.part === 'body') {
    return {
      sheet: anchor.sheet,
      rect: {
        r: anchor.firstDataRow,
        c: anchor.rect.c,
        rows: anchor.rowCount,
        cols: anchor.rect.cols,
      },
    }
  }
  if (!ref.column) throw new Error(`ref('${ref.block}').column() requires a column key`)
  const c = requireColumn(anchor, ref.column)
  return {
    sheet: anchor.sheet,
    rect: { r: anchor.firstDataRow, c, rows: anchor.rowCount, cols: 1 },
  }
}

function resolveName(ref: NameRef, context: ResolveContext): ResolvedRef {
  const anchor = requireAnchor(context.registry, ref.block)
  if (anchor.kind !== 'keyValue') {
    throw new Error(`"${ref.block}" is a table; ref().get() only works on kind="keyValue" blocks`)
  }
  const addr = anchor.keys.get(ref.key)
  if (!addr) {
    const known = [...anchor.keys.keys()]
    throw new Error(`no key "${ref.key}" in "${ref.block}" (keys: ${known.join(', ')})`)
  }
  const defined = context.definedNames.get(ref.key)
  const resolved: ResolvedRef = {
    sheet: anchor.sheet,
    rect: { r: addr.r, c: addr.c, rows: 1, cols: 1 },
  }
  if (defined && defined.sheet === anchor.sheet && defined.addr.r === addr.r) {
    resolved.name = ref.key
  }
  return resolved
}

const ABSOLUTE = { absoluteRow: true, absoluteCol: true } as const

export function refToA1(ref: Ref, context: ResolveContext): string {
  const resolved = resolveRef(ref, context)
  if (resolved.name) return resolved.name

  const absolute = ref.kind !== 'name' && ref.absolute === true
  const options = absolute ? ABSOLUTE : {}
  const reference =
    resolved.rect.rows === 1 && resolved.rect.cols === 1
      ? toA1({ r: resolved.rect.r, c: resolved.rect.c }, options)
      : rangeToA1(resolved.rect, options)

  return qualify(resolved.sheet === context.sheet ? undefined : resolved.sheet, reference)
}
