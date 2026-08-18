import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { compile } from '../compile/compile.js'
import { budget } from '../compile/fixtures.js'
import { evaluateWorkbook } from '../formula/evaluate.js'
import { XlsxWriter } from './xlsx.js'

async function roundTrip() {
  const book = compile(budget())
  const values = evaluateWorkbook(book)
  const buffer = await new XlsxWriter().write(book, { values })
  const reopened = new ExcelJS.Workbook()
  await reopened.xlsx.load(buffer as unknown as ArrayBuffer)
  return { book, values, reopened }
}

describe('the exported workbook', () => {
  it('contains formulas, not baked values', async () => {
    const { reopened } = await roundTrip()
    const pl = reopened.getWorksheet('P&L')
    expect(pl).toBeDefined()

    const grossProfit = pl?.getCell('D5').value as { formula?: string }
    expect(grossProfit.formula).toBe('B5-C5')

    const total = pl?.getCell('B9').value as { formula?: string }
    expect(total.formula).toBe('SUM(B5:B8)')
  })

  it('caches the computed result so non-recalculating viewers show numbers', async () => {
    const { reopened } = await roundTrip()
    const cell = reopened.getWorksheet('P&L')?.getCell('D5').value as { result?: number }
    expect(cell.result).toBe(12_400_000 - 5_100_000)
  })

  it('carries the defined names that make formulas readable', async () => {
    const { reopened } = await roundTrip()
    const names = reopened.definedNames.model.map((entry) => entry.name)
    expect(names).toContain('growth')
    expect(names).toContain('taxRate')
  })

  it('applies number formats and column widths', async () => {
    const { reopened } = await roundTrip()
    const pl = reopened.getWorksheet('P&L')
    expect(pl?.getCell('B5').numFmt).toBe('#,##0')
    expect(pl?.getCell('F6').numFmt).toBe('0.0%')
    expect(pl?.getColumn(1).width).toBe(12)
  })

  it('freezes the pane the sheet asked for', async () => {
    const { reopened } = await roundTrip()
    const view = reopened.getWorksheet('P&L')?.views?.[0] as { state?: string; ySplit?: number }
    expect(view.state).toBe('frozen')
    expect(view.ySplit).toBe(1)
  })

  it('writes both sheets', async () => {
    const { reopened } = await roundTrip()
    expect(reopened.worksheets.map((w) => w.name)).toEqual(['Assumptions', 'P&L'])
  })
})

describe('cached results', () => {
  it('can be omitted so a reader must compute for itself', async () => {
    const book = compile(budget())
    const values = evaluateWorkbook(book)
    const buffer = await new XlsxWriter().write(book, { values, cacheValues: false })
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(buffer as unknown as ArrayBuffer)

    const cell = reopened.getWorksheet('P&L')?.getCell('E5').value as {
      formula?: string
      result?: number
    }
    expect(cell.formula).toBeDefined()
    expect(cell.result).toBeUndefined()
  })
})
