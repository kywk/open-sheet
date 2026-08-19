import type { Expr, Scalar } from '../formula/expr.js'
import type { CellValue } from '../model/cell.js'
import type { Addr, Size } from '../model/geometry.js'
import type { RowContext } from '../refs/ref.js'

export interface DataBar {
  color?: string
  /** Negative values grow left from a zero baseline. */
  negativeColor?: string
}

export interface ColumnSpec<T = any> {
  key: string
  header?: string
  format?: string
  width?: number
  style?: string
  /** Draw an in-cell bar across this column's data range. Live in Excel, drawn in HTML. */
  bar?: boolean | DataBar
  value?: (row: T, index: number) => CellValue
  /**
   * A builder expression, or a formula string for compatibility. A string is
   * parsed where possible but is not the recommended path — it is exactly what
   * breaks when a row is inserted.
   */
  formula?: ((row: RowContext<T>) => Expr | Scalar | null | undefined) | string
}

export type Aggregate = 'sum' | 'avg' | 'count' | 'min' | 'max'

export interface InlineRun {
  text: string
  emphasis?: 'bold' | 'italic' | 'code'
}

export interface StackNode {
  kind: 'stack'
  gap: number
  children: Block[]
}

export interface RowNode {
  kind: 'row'
  gap: number
  children: Block[]
}

export interface TableNode<T = any> {
  kind: 'table'
  name: string
  variant: 'grid' | 'keyValue'
  title?: string
  showHeader: boolean
  data: readonly T[]
  columns: ColumnSpec<T>[]
  total?: Partial<Record<string, Aggregate>>
  style?: string
}

export interface KpiItem {
  label: string
  value: Expr | CellValue
  format?: string
}

export interface KpiBandNode {
  kind: 'kpiBand'
  items: KpiItem[]
  style?: string
}

export interface CellNode {
  kind: 'cell'
  value?: CellValue
  expr?: Expr
  format?: string
  style?: string
  span?: Size
}

export interface NoteNode {
  kind: 'note'
  runs: InlineRun[]
  cols: number
  style?: string
}

export interface SpacerNode {
  kind: 'spacer'
  rows: number
  cols: number
}

export type Block = StackNode | RowNode | TableNode | KpiBandNode | CellNode | NoteNode | SpacerNode

export interface SheetNode {
  kind: 'sheet'
  name: string
  freeze?: string
  origin?: Addr
  children: Block[]
}

export interface WorkbookNode {
  kind: 'workbook'
  children: SheetNode[]
}

const BLOCK_KINDS = new Set(['stack', 'row', 'table', 'kpiBand', 'cell', 'note', 'spacer'])

export function isBlock(value: unknown): value is Block {
  if (typeof value !== 'object' || value === null) return false
  return BLOCK_KINDS.has((value as { kind?: string }).kind ?? '')
}

export function isSheet(value: unknown): value is SheetNode {
  return typeof value === 'object' && value !== null && (value as SheetNode).kind === 'sheet'
}

export function isWorkbook(value: unknown): value is WorkbookNode {
  return typeof value === 'object' && value !== null && (value as WorkbookNode).kind === 'workbook'
}

export function isContainer(block: Block): block is StackNode | RowNode {
  return block.kind === 'stack' || block.kind === 'row'
}
