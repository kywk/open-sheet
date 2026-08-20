import ExcelJS from 'exceljs'
import type { CompiledWorkbook } from '../compile/emit.js'
import { serialize } from '../formula/serialize.js'
import { type Computed, isExcelError, isNotEvaluated } from '../formula/value.js'
import { columnName, rangeToA1, toA1 } from '../model/a1.js'
import { type Cell, parseCellKey } from '../model/cell.js'
import type { ResolveContext } from '../refs/resolve.js'
import { themeFor } from '../style/design.js'
import { toArgb, toExcelStyle } from '../style/excel.js'
import { DEFAULT_THEME, resolveStyle } from '../style/theme.js'
import type { Theme } from '../style/types.js'
import { numberFormat } from './formats.js'
import { injectCharts } from './ooxml-chart.js'
import type { WorkbookWriter, WriteOptions } from './writer.js'

export class XlsxWriter implements WorkbookWriter {
  readonly extension = 'xlsx'

  async write(book: CompiledWorkbook, options: WriteOptions = {}): Promise<Buffer> {
    const theme = themeFor(book.design, options.theme ?? DEFAULT_THEME)
    const workbook = new ExcelJS.Workbook()
    workbook.creator = options.creator ?? 'open-sheet'
    // Excel honours this and recalculates on open. LibreOffice does not — its
    // default for xlsx is "never recalculate on load", so it shows our cached
    // results until the user edits a cell. That is why the CI check exports
    // without cached results rather than relying on this flag.
    workbook.calcProperties.fullCalcOnLoad = true

    for (const sheet of book.sheets) {
      const worksheet = workbook.addWorksheet(sheet.name)
      const context: ResolveContext = {
        registry: book.registry,
        definedNames: book.definedNames,
        sheet: sheet.name,
      }

      const cached = options.cacheValues === false ? undefined : options.values
      for (const [key, cell] of sheet.cells) {
        const { r, c } = parseCellKey(key)
        writeCell(worksheet, r, c, cell, context, cached, theme)
      }

      for (let c = 0; c < sheet.bounds.cols; c += 1) {
        worksheet.getColumn(c + 1).width = sheet.columnWidths.get(c) ?? theme.defaultColumnWidth
      }

      for (const format of sheet.conditionalFormats) {
        worksheet.addConditionalFormatting({
          ref: rangeToA1(format.rect),
          rules: [
            {
              type: 'dataBar',
              priority: 1,
              minLength: 0,
              maxLength: 100,
              gradient: false,
              showValue: true,
              cfvo: [{ type: 'min' }, { type: 'max' }],
              color: { argb: toArgb(format.color) },
            } as never,
          ],
        })
      }

      // A form printed landscape, or a table whose header does not repeat on
      // page two, is a form nobody can use. ExcelJS defaults neither.
      if (sheet.print) {
        const { orientation, size, fitToWidth, margin } = sheet.print
        worksheet.pageSetup = {
          ...worksheet.pageSetup,
          orientation: orientation ?? 'portrait',
          paperSize: PAPER[size ?? 'A4'],
          ...(fitToWidth ? { fitToPage: true, fitToWidth: 1, fitToHeight: 0 } : {}),
          ...(margin === undefined
            ? {}
            : {
                margins: {
                  left: margin,
                  right: margin,
                  top: margin,
                  bottom: margin,
                  header: margin / 2,
                  footer: margin / 2,
                },
              }),
        }
      }

      if (sheet.repeatRows) {
        worksheet.pageSetup = {
          ...worksheet.pageSetup,
          printTitlesRow: `${sheet.repeatRows.from + 1}:${sheet.repeatRows.to + 1}`,
        }
      }

      if (sheet.freeze && (sheet.freeze.r > 0 || sheet.freeze.c > 0)) {
        worksheet.views = [
          {
            state: 'frozen',
            xSplit: sheet.freeze.c,
            ySplit: sheet.freeze.r,
            topLeftCell: undefined,
          },
        ]
      }
    }

    for (const [name, target] of book.definedNames) {
      const address = `${quote(target.sheet)}!${toA1(target.addr, { absoluteRow: true, absoluteCol: true })}`
      workbook.definedNames.add(address, name)
    }

    const buffer = await workbook.xlsx.writeBuffer()
    return injectCharts(Buffer.from(buffer as ArrayBuffer), book)
  }
}

/** Excel's numeric paper sizes; the names mean nothing to it. */
const PAPER: Record<string, number> = { Letter: 1, Legal: 5, A3: 8, A4: 9 }

function quote(sheet: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(sheet) ? sheet : `'${sheet.replace(/'/g, "''")}'`
}

function writeCell(
  worksheet: ExcelJS.Worksheet,
  r: number,
  c: number,
  cell: Cell,
  context: ResolveContext,
  values: Map<string, Computed> | undefined,
  theme: Theme,
): void {
  const target = worksheet.getCell(r + 1, c + 1)

  if (cell.expr) {
    const formula = serialize(cell.expr, context)
    const cached = values?.get(`${context.sheet}!${r},${c}`)
    const result =
      cached === undefined || isNotEvaluated(cached) ? undefined : toExcelResult(cached)
    target.value =
      result === undefined ? { formula, date1904: false } : { formula, result, date1904: false }
  } else if (cell.value !== null && cell.value !== undefined) {
    target.value = cell.value
  }

  const style = resolveStyle(theme, cell.style)
  if (style) Object.assign(target, toExcelStyle(style))

  const format = numberFormat(cell.format ?? style?.format)
  if (format) target.numFmt = format

  if (cell.span && (cell.span.rows > 1 || cell.span.cols > 1)) {
    worksheet.mergeCells(r + 1, c + 1, r + cell.span.rows, c + cell.span.cols)
  }
}

type FormulaResult = string | number | boolean | Date | ExcelJS.CellErrorValue | undefined

function toExcelResult(value: Computed): FormulaResult {
  if (isExcelError(value)) return { error: value.code } as ExcelJS.CellErrorValue
  if (value === null) return undefined
  return value as FormulaResult
}

export function a1(r: number, c: number): string {
  return `${columnName(c)}${r + 1}`
}
