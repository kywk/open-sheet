import type { Expr } from '../formula/expr.js'
import type { Size } from './geometry.js'

export type CellValue = number | string | boolean | null

export interface SourceLoc {
  file: string
  line: number
  column: number
}

export interface Cell {
  value?: CellValue
  expr?: Expr
  style?: string
  format?: string
  span?: Size
  loc?: SourceLoc
}

export type CellKey = string

export function cellKey(r: number, c: number): CellKey {
  return `${r},${c}`
}

export function parseCellKey(key: CellKey): { r: number; c: number } {
  const comma = key.indexOf(',')
  return { r: Number(key.slice(0, comma)), c: Number(key.slice(comma + 1)) }
}
