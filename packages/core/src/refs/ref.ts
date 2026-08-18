import type { Expr } from '../formula/expr.js'

export interface CellRef {
  kind: 'cell'
  block: string
  part: 'data' | 'total' | 'header'
  column: string
  row?: number
  absolute?: boolean
}

export interface RangeRef {
  kind: 'range'
  block: string
  part: 'column' | 'body'
  column?: string
  absolute?: boolean
}

export interface NameRef {
  kind: 'name'
  block: string
  key: string
}

export type Ref = CellRef | RangeRef | NameRef

export function isRef(value: unknown): value is Ref {
  if (typeof value !== 'object' || value === null) return false
  const kind = (value as { kind?: unknown }).kind
  return kind === 'cell' || kind === 'range' || kind === 'name'
}

export interface RowContext<T = unknown> {
  readonly index: number
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly data: T
  cell(column: string): Expr
  prev(offset?: number): RowContext<T>
  next(offset?: number): RowContext<T>
}

export interface BlockRef {
  column(key: string): RangeRef
  total(key: string): CellRef
  cell(key: string, row: number): CellRef
  body(): RangeRef
  get(key: string): NameRef
}

export function ref(block: string): BlockRef {
  return {
    column: (key) => ({ kind: 'range', block, part: 'column', column: key }),
    total: (key) => ({ kind: 'cell', block, part: 'total', column: key }),
    cell: (key, row) => ({ kind: 'cell', block, part: 'data', column: key, row }),
    body: () => ({ kind: 'range', block, part: 'body' }),
    get: (key) => ({ kind: 'name', block, key }),
  }
}
