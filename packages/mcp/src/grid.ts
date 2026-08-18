import {
  type CompiledWorkbook,
  type Computed,
  display,
  isNotEvaluated,
  parseCellKey,
  toA1,
  toFormula,
} from '@open-sheet/core'

export interface CellReport {
  address: string
  formula?: string
  value: string
  notEvaluated?: true
}

export interface SheetReport {
  name: string
  rows: number
  cols: number
  cells: CellReport[]
}

/**
 * An agent inspecting a model needs both halves: the formula tells it what the
 * author meant, the value tells it whether that came out right. Returning only
 * one leaves it guessing.
 */
export function reportSheet(
  book: CompiledWorkbook,
  values: Map<string, Computed>,
  sheetName: string,
): SheetReport {
  const sheet = book.sheets.find((candidate) => candidate.name === sheetName)
  if (!sheet) {
    const known = book.sheets.map((s) => s.name).join(', ')
    throw new Error(`no sheet "${sheetName}" (sheets: ${known})`)
  }

  const context = {
    registry: book.registry,
    definedNames: book.definedNames,
    sheet: sheet.name,
  }

  const cells: CellReport[] = []
  for (const [key, cell] of sheet.cells) {
    const { r, c } = parseCellKey(key)
    const computed = cell.expr ? values.get(`${sheet.name}!${key}`) : (cell.value ?? null)
    const report: CellReport = {
      address: toA1({ r, c }),
      value: display(computed ?? null),
    }
    if (cell.expr) {
      try {
        report.formula = toFormula(cell.expr, context)
      } catch (error) {
        report.formula = `#ERROR: ${error instanceof Error ? error.message : String(error)}`
      }
    }
    if (isNotEvaluated(computed)) report.notEvaluated = true
    cells.push(report)
  }

  cells.sort((a, b) => a.address.localeCompare(b.address, 'en', { numeric: true }))
  return { name: sheet.name, rows: sheet.bounds.rows, cols: sheet.bounds.cols, cells }
}

export function toGrid(report: SheetReport): string[][] {
  const grid: string[][] = []
  for (const cell of report.cells) {
    const match = /^([A-Z]+)(\d+)$/.exec(cell.address)
    if (!match) continue
    const r = Number(match[2]) - 1
    let c = 0
    for (const ch of match[1] as string) c = c * 26 + (ch.charCodeAt(0) - 64)
    c -= 1
    grid[r] ??= []
    ;(grid[r] as string[])[c] = cell.value
  }
  return grid
}
