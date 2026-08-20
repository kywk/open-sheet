import {
  avg,
  count,
  type Expr,
  type ExprInput,
  isExpr,
  lift,
  max,
  min,
  sum,
} from '../formula/expr.js'
import { parseFormula } from '../formula/parse.js'
import { type Placement, placeSheet } from '../layout/place.js'
import { type Cell, type CellKey, type CellValue, cellKey } from '../model/cell.js'
import type { Addr, Rect, Size } from '../model/geometry.js'
import { isRef, type Ref } from '../refs/ref.js'
import type { DesignSystem } from '../style/design.js'
import type { KeyValueEntry } from './components.js'
import type { Aggregate, Block, PrintSetup, SheetNode, TableNode, WorkbookNode } from './nodes.js'
import type { Registry, TableAnchor } from './registry.js'
import { makeRowContext } from './row-context.js'

export interface ConditionalFormat {
  kind: 'dataBar'
  rect: Rect
  color: string
  negativeColor?: string
}

export interface PlacedChart {
  chart: 'bar' | 'line' | 'pie'
  title?: string
  rect: Rect
  categories: Ref
  series: { name: string; values: Ref }[]
}

export interface CompiledSheet {
  name: string
  print?: PrintSetup
  cells: Map<CellKey, Cell>
  columnWidths: Map<number, number>
  conditionalFormats: ConditionalFormat[]
  charts: PlacedChart[]
  /** Rows to repeat at the top of every printed page, zero-based inclusive. */
  repeatRows?: { from: number; to: number }
  freeze?: Addr
  bounds: Size
}

export interface DefinedName {
  sheet: string
  addr: Addr
}

export interface CompiledWorkbook {
  sheets: CompiledSheet[]
  registry: Registry
  definedNames: Map<string, DefinedName>
  /** From the module's `design` const; drives the theme for every renderer. */
  design?: DesignSystem
}

const AGGREGATES: Record<Aggregate, (expr: Expr) => Expr> = {
  sum: (expr) => sum(expr),
  avg: (expr) => avg(expr),
  count: (expr) => count(expr),
  min: (expr) => min(expr),
  max: (expr) => max(expr),
}

export function emitWorkbook(workbook: WorkbookNode): CompiledWorkbook {
  assertUniqueNames(workbook)
  const registry: Registry = new Map()
  const definedNames = new Map<string, DefinedName>()
  const sheets = workbook.children.map((sheet) => emitSheet(sheet, registry, definedNames))
  return { sheets, registry, definedNames }
}

function emitSheet(
  sheet: SheetNode,
  registry: Registry,
  definedNames: Map<string, DefinedName>,
): CompiledSheet {
  const cells = new Map<CellKey, Cell>()
  const columnWidths = new Map<number, number>()
  const conditionalFormats: ConditionalFormat[] = []
  const charts: PlacedChart[] = []
  const placements = placeSheet(sheet)

  for (const placement of placements) {
    if (placement.block.kind === 'chart') {
      const node = placement.block
      const placed: PlacedChart = {
        chart: node.chart,
        rect: placement.rect,
        categories: node.categories,
        series: node.series,
      }
      if (node.title !== undefined) placed.title = node.title
      charts.push(placed)
      continue
    }
    emitPlacement(
      placement,
      sheet.name,
      cells,
      columnWidths,
      conditionalFormats,
      registry,
      definedNames,
    )
  }

  const compiled: CompiledSheet = {
    name: sheet.name,
    cells,
    columnWidths,
    conditionalFormats,
    charts,
    bounds: boundsOf(placements),
  }
  if (sheet.freeze) compiled.freeze = parseFreeze(sheet.freeze)
  if (sheet.print) compiled.print = sheet.print

  // The header row of the first table is what a reader needs on page two.
  if (sheet.print?.repeatHeader) {
    for (const anchor of registry.values()) {
      if (
        anchor.kind === 'table' &&
        anchor.sheet === sheet.name &&
        anchor.headerRow !== undefined
      ) {
        compiled.repeatRows = { from: anchor.headerRow, to: anchor.headerRow }
        break
      }
    }
  }
  return compiled
}

function emitPlacement(
  placement: Placement,
  sheetName: string,
  cells: Map<CellKey, Cell>,
  columnWidths: Map<number, number>,
  conditionalFormats: ConditionalFormat[],
  registry: Registry,
  definedNames: Map<string, DefinedName>,
): void {
  const { block, rect } = placement
  switch (block.kind) {
    case 'cell': {
      const cell: Cell = {}
      if (block.value !== undefined) cell.value = block.value
      if (block.expr !== undefined) cell.expr = block.expr
      if (block.format !== undefined) cell.format = block.format
      if (block.style !== undefined) cell.style = block.style
      if (block.span !== undefined) cell.span = block.span
      cells.set(cellKey(rect.r, rect.c), cell)
      return
    }
    case 'note': {
      const text = block.runs.map((run) => run.text).join('')
      cells.set(cellKey(rect.r, rect.c), {
        value: text,
        style: block.style ?? 'note',
        span: { rows: 1, cols: block.cols },
      })
      return
    }
    case 'spacer':
    case 'chart':
      return
    case 'kpiBand': {
      block.items.forEach((item, i) => {
        cells.set(cellKey(rect.r, rect.c + i), { value: item.label, style: 'kpiLabel' })
        const valueCell: Cell = { style: 'kpiValue' }
        if (isExpr(item.value) || isRef(item.value)) valueCell.expr = lift(item.value)
        else valueCell.value = item.value as CellValue
        if (item.format) valueCell.format = item.format
        cells.set(cellKey(rect.r + 1, rect.c + i), valueCell)
      })
      return
    }
    case 'table':
      emitTable(
        block,
        rect,
        sheetName,
        cells,
        columnWidths,
        conditionalFormats,
        registry,
        definedNames,
      )
      return
  }
}

const DEFAULT_BAR_COLOR = '#93c5fd'

function emitTable(
  table: TableNode,
  rect: Rect,
  sheetName: string,
  cells: Map<CellKey, Cell>,
  columnWidths: Map<number, number>,
  conditionalFormats: ConditionalFormat[],
  registry: Registry,
  definedNames: Map<string, DefinedName>,
): void {
  let row = rect.r

  if (table.title) {
    cells.set(cellKey(row, rect.c), {
      value: table.title,
      style: 'tableTitle',
      span: { rows: 1, cols: rect.cols },
    })
    row += 1
  }
  const titleRow = table.title ? rect.r : undefined

  if (table.variant === 'keyValue') {
    emitKeyValue(table, rect, row, sheetName, cells, registry, definedNames)
    return
  }

  let headerRow: number | undefined
  if (table.showHeader) {
    headerRow = row
    table.columns.forEach((column, i) => {
      cells.set(cellKey(row, rect.c + i), {
        value: column.header ?? column.key,
        style: column.style ? `${column.style}Header` : 'tableHeader',
      })
    })
    row += 1
  }

  const firstDataRow = row
  const columns = new Map<string, number>()
  table.columns.forEach((column, i) => {
    columns.set(column.key, rect.c + i)
    if (column.width !== undefined) columnWidths.set(rect.c + i, column.width)
  })

  table.data.forEach((dataRow, index) => {
    table.columns.forEach((column, i) => {
      const target = cellKey(firstDataRow + index, rect.c + i)
      const cell: Cell = {}
      if (column.formula) {
        // A formula that throws is a formula somebody wrote; without the block,
        // column and row, a 450-line workbook means bisecting by hand to find it.
        const produced =
          typeof column.formula === 'string'
            ? column.formula
            : withContext(table.name, column.key, index, () =>
                (column.formula as (r: never) => ExprInput | null | undefined)(
                  makeRowContext(table.name, table.data, index) as never,
                ),
              )
        if (produced === null || produced === undefined) {
          cells.set(target, cell)
          return
        }
        cell.expr = typeof produced === 'string' ? parseFormula(produced).expr : lift(produced)
      } else if (column.value) {
        cell.value = column.value(dataRow, index)
      } else {
        cell.value = readField(dataRow, column.key)
      }
      if (column.format) cell.format = column.format
      if (column.style) cell.style = column.style
      if (column.wrap) cell.wrap = true
      cells.set(target, cell)
    })
  })

  if (table.data.length > 0) {
    table.columns.forEach((column, i) => {
      if (!column.bar) return
      const bar = column.bar === true ? {} : column.bar
      const format: ConditionalFormat = {
        kind: 'dataBar',
        rect: { r: firstDataRow, c: rect.c + i, rows: table.data.length, cols: 1 },
        color: bar.color ?? DEFAULT_BAR_COLOR,
      }
      if (bar.negativeColor) format.negativeColor = bar.negativeColor
      conditionalFormats.push(format)
    })
  }

  const lastDataRow = firstDataRow + Math.max(table.data.length - 1, 0)
  let totalRow: number | undefined

  if (table.total) {
    totalRow = firstDataRow + table.data.length
    table.columns.forEach((column, i) => {
      const aggregate = table.total?.[column.key]
      const target = cellKey(totalRow as number, rect.c + i)
      if (!aggregate) {
        cells.set(
          target,
          i === 0 ? { value: 'Total', style: 'tableTotal' } : { style: 'tableTotal' },
        )
        return
      }
      const cell: Cell = {
        expr: AGGREGATES[aggregate]({
          k: 'ref',
          target: { kind: 'range', block: table.name, part: 'column', column: column.key },
        }),
        style: 'tableTotal',
      }
      if (column.format) cell.format = column.format
      cells.set(target, cell)
    })
  }

  const anchor: TableAnchor = {
    kind: 'table',
    name: table.name,
    sheet: sheetName,
    rect,
    firstDataRow,
    lastDataRow,
    rowCount: table.data.length,
    columns,
  }
  if (titleRow !== undefined) anchor.titleRow = titleRow
  if (headerRow !== undefined) anchor.headerRow = headerRow
  if (totalRow !== undefined) anchor.totalRow = totalRow
  registry.set(table.name, anchor)
}

function emitKeyValue(
  table: TableNode,
  rect: Rect,
  startRow: number,
  sheetName: string,
  cells: Map<CellKey, Cell>,
  registry: Registry,
  definedNames: Map<string, DefinedName>,
): void {
  const entries = table.data as readonly KeyValueEntry[]
  const keys = new Map<string, Addr>()

  entries.forEach((entry, index) => {
    const r = startRow + index
    cells.set(cellKey(r, rect.c), { value: entry.label, style: 'kvLabel' })
    const cell: Cell = { style: 'kvValue' }
    if (isExpr(entry.value) || isRef(entry.value)) cell.expr = lift(entry.value)
    else cell.value = entry.value as CellValue
    if (entry.format) cell.format = entry.format
    cells.set(cellKey(r, rect.c + 1), cell)
    keys.set(entry.key, { r, c: rect.c + 1 })
    definedNames.set(entry.key, { sheet: sheetName, addr: { r, c: rect.c + 1 } })
  })

  registry.set(table.name, {
    kind: 'keyValue',
    name: table.name,
    sheet: sheetName,
    rect,
    keys,
  })
}

/** Names the construct a thrown error came from, which the stack alone does not. */
function withContext<T>(block: string, column: string, row: number, fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`table "${block}", column "${column}", row ${row + 1}: ${message}`, {
      cause: error,
    })
  }
}

function readField(row: unknown, key: string): CellValue {
  if (typeof row !== 'object' || row === null) return null
  const value = (row as Record<string, unknown>)[key]
  if (value === undefined || value === null) return null
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

function assertUniqueNames(workbook: WorkbookNode): void {
  const seen = new Map<string, string>()
  for (const sheet of workbook.children) {
    walkBlocks(sheet.children, (block) => {
      if (block.kind !== 'table') return
      const previous = seen.get(block.name)
      if (previous) {
        const where =
          previous === sheet.name
            ? `twice on sheet "${sheet.name}"`
            : `on sheets "${previous}" and "${sheet.name}"`
        throw new Error(
          `duplicate block name "${block.name}" — used ${where}. ` +
            'Block names are workbook-global because ref() looks them up by name.',
        )
      }
      seen.set(block.name, sheet.name)
    })
  }
}

function walkBlocks(blocks: readonly Block[], visit: (block: Block) => void): void {
  for (const block of blocks) {
    visit(block)
    if (block.kind === 'stack' || block.kind === 'row') walkBlocks(block.children, visit)
  }
}

function boundsOf(placements: readonly Placement[]): Size {
  let rows = 0
  let cols = 0
  for (const { rect } of placements) {
    rows = Math.max(rows, rect.r + rect.rows)
    cols = Math.max(cols, rect.c + rect.cols)
  }
  return { rows, cols }
}

function parseFreeze(freeze: string): Addr {
  const match = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/.exec(freeze.trim())
  if (!match) throw new SyntaxError(`<Sheet freeze> expects a cell like "B2", got "${freeze}"`)
  let c = 0
  for (const ch of (match[2] as string).toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64)
  return { r: Number(match[4]) - 1, c: c - 1 }
}
