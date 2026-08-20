import type { Expr, ExprInput, Scalar } from '../formula/expr.js'
import { parseFormula } from '../formula/parse.js'
import type { CellValue } from '../model/cell.js'
import type { Addr, Size } from '../model/geometry.js'
import type { Ref, RowContext } from '../refs/ref.js'
import { isRef } from '../refs/ref.js'
import { asBlocks, asRuns, asSheets } from './children.js'
import type {
  Aggregate,
  Block,
  CellNode,
  ChartKind,
  ChartNode,
  ChartSeries,
  ColumnSpec,
  DataBar,
  KpiBandNode,
  KpiItem,
  NoteNode,
  RowNode,
  SheetNode,
  SpacerNode,
  StackNode,
  TableNode,
  WorkbookNode,
} from './nodes.js'

/**
 * Formula strings are a compatibility shim. They are parsed so the cell still
 * evaluates, and a dev-mode warning points at the structural equivalent — an
 * address written by hand survives exactly until someone inserts a row.
 */
function asExpr(formula: ExprInput): Expr {
  if (isRef(formula)) return { k: 'ref', target: formula }
  if (typeof formula === 'number' || typeof formula === 'boolean') return { k: 'lit', v: formula }
  if (typeof formula !== 'string') return formula
  const parsed = parseFormula(formula)
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    const detail = parsed.degraded ? ` (${parsed.reason}; it will show as #NOT_EVALUATED)` : ''
    process.emitWarning?.(
      `open-sheet: formula string "${formula}" will not survive a row insert${detail}. ` +
        'Use r.cell(...) / ref(...) instead — see the sheet-authoring skill.',
    )
  }
  return parsed.expr
}

export function Workbook(props: { children?: unknown }): WorkbookNode {
  return { kind: 'workbook', children: asSheets(props.children) }
}

export function Sheet(props: {
  name: string
  freeze?: string
  origin?: Addr
  children?: unknown
}): SheetNode {
  if (!props.name) throw new TypeError('<Sheet> requires a name')
  const node: SheetNode = {
    kind: 'sheet',
    name: props.name,
    children: asBlocks(props.children, 'Sheet'),
  }
  if (props.freeze !== undefined) node.freeze = props.freeze
  if (props.origin !== undefined) node.origin = props.origin
  return node
}

export function Stack(props: { gap?: number; children?: unknown }): StackNode {
  return { kind: 'stack', gap: props.gap ?? 1, children: asBlocks(props.children, 'Stack') }
}

export function Row(props: { gap?: number; children?: unknown }): RowNode {
  return { kind: 'row', gap: props.gap ?? 1, children: asBlocks(props.children, 'Row') }
}

export interface ColumnOptions<T> {
  header?: string
  format?: string
  width?: number
  style?: string
  bar?: boolean | DataBar
  value?: (row: T, index: number) => CellValue
  formula?: ((row: RowContext<T>) => ExprInput | null | undefined) | string
}

export function col<T = any>(key: string, options: ColumnOptions<T> = {}): ColumnSpec<T> {
  return { key, ...options }
}

export interface KeyValueEntry {
  key: string
  label: string
  value: CellValue | ExprInput
  format?: string
}

interface GridTableProps<T> {
  name: string
  data: readonly T[]
  columns: ColumnSpec<T>[]
  kind?: 'grid'
  title?: string
  showHeader?: boolean
  total?: Partial<Record<string, Aggregate>>
  style?: string
}

interface KeyValueTableProps {
  name: string
  data: readonly KeyValueEntry[]
  kind: 'keyValue'
  title?: string
  style?: string
}

export type TableProps<T> = GridTableProps<T> | KeyValueTableProps

const KEY_VALUE_COLUMNS: ColumnSpec<KeyValueEntry>[] = [
  { key: 'label', header: 'Name', value: (row) => row.label },
  { key: 'value', header: 'Value' },
]

export function Table<T = any>(props: TableProps<T>): TableNode<T> {
  if (!props.name) throw new TypeError('<Table> requires a name — it is what ref() points at')
  if (props.kind === 'keyValue') {
    const node: TableNode<any> = {
      kind: 'table',
      name: props.name,
      variant: 'keyValue',
      showHeader: false,
      data: props.data,
      columns: KEY_VALUE_COLUMNS,
    }
    if (props.title !== undefined) node.title = props.title
    if (props.style !== undefined) node.style = props.style
    return node as TableNode<T>
  }
  if (!props.columns?.length) throw new TypeError(`<Table name="${props.name}"> requires columns`)
  const node: TableNode<T> = {
    kind: 'table',
    name: props.name,
    variant: 'grid',
    showHeader: props.showHeader ?? true,
    data: props.data,
    columns: props.columns,
  }
  if (props.title !== undefined) node.title = props.title
  if (props.total !== undefined) node.total = props.total
  if (props.style !== undefined) node.style = props.style
  return node
}

export function KpiBand(props: { items: KpiItem[]; style?: string }): KpiBandNode {
  if (!props.items?.length) throw new TypeError('<KpiBand> requires items')
  const node: KpiBandNode = { kind: 'kpiBand', items: props.items }
  if (props.style !== undefined) node.style = props.style
  return node
}

export function Cell(props: {
  value?: CellValue
  formula?: ExprInput
  format?: string
  style?: string
  span?: Size
}): CellNode {
  const node: CellNode = { kind: 'cell' }
  if (props.value !== undefined) node.value = props.value
  if (props.formula !== undefined) node.expr = asExpr(props.formula)
  if (props.format !== undefined) node.format = props.format
  if (props.style !== undefined) node.style = props.style
  if (props.span !== undefined) node.span = props.span
  return node
}

export function Note(props: { cols?: number; style?: string; children?: unknown }): NoteNode {
  const node: NoteNode = { kind: 'note', runs: asRuns(props.children), cols: props.cols ?? 4 }
  if (props.style !== undefined) node.style = props.style
  return node
}

/**
 * A native chart. In the .xlsx it is real chart XML bound to real ranges, so it
 * moves when the numbers do; an embedded picture would go stale the moment
 * someone changed a cell, which is the one thing this export must never do.
 */
export function Chart(props: {
  kind?: ChartKind
  title?: string
  categories: Ref
  series: ChartSeries[]
  rows?: number
  cols?: number
}): ChartNode {
  if (!props.series?.length) throw new TypeError('<Chart> requires at least one series')
  const node: ChartNode = {
    kind: 'chart',
    chart: props.kind ?? 'bar',
    categories: props.categories,
    series: props.series,
    rows: props.rows ?? 15,
    cols: props.cols ?? 6,
  }
  if (props.title !== undefined) node.title = props.title
  return node
}

export function Spacer(props: { rows?: number; cols?: number }): SpacerNode {
  return { kind: 'spacer', rows: props.rows ?? 1, cols: props.cols ?? 1 }
}

export type { Block }
