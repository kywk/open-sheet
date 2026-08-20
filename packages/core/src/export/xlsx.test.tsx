import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { compile } from '../compile/compile.js'
import { col, Sheet, Table, Workbook } from '../compile/components.js'
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

describe('print setup — what a form needs and a grid does not', () => {
  const form = () =>
    compile(
      <Workbook>
        <Sheet
          name="Invoice"
          print={{ orientation: 'portrait', size: 'A4', fitToWidth: true, repeatHeader: true }}
        >
          <Table
            name="lines"
            data={[
              { item: 'a', amount: 1 },
              { item: 'b', amount: 2 },
            ]}
            columns={[col('item', { header: 'Item' }), col('amount', { header: 'Amount' })]}
          />
        </Sheet>
      </Workbook>,
    )

  it('writes orientation, paper size and fit-to-width', async () => {
    const buffer = await new XlsxWriter().write(form())
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(buffer as unknown as ArrayBuffer)
    const setup = reopened.getWorksheet('Invoice')?.pageSetup

    // A form printed landscape is a form nobody can use, and ExcelJS defaults to
    // landscape with no fit.
    expect(setup?.orientation).toBe('portrait')
    expect(setup?.paperSize).toBe(9) // A4; Excel knows numbers, not names
    expect(setup?.fitToWidth).toBe(1)
    expect(setup?.fitToPage).toBe(true)
  })

  it('repeats the table header on every printed page', async () => {
    const buffer = await new XlsxWriter().write(form())
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(buffer as unknown as ArrayBuffer)
    // Page two of a long table without its header is unreadable.
    expect(reopened.getWorksheet('Invoice')?.pageSetup?.printTitlesRow).toBe('1:1')
  })

  it('leaves a sheet that asked for nothing alone', async () => {
    const plain = compile(
      <Workbook>
        <Sheet name="Grid">
          <Table name="t" data={[{ a: 1 }]} columns={[col('a')]} />
        </Sheet>
      </Workbook>,
    )
    const buffer = await new XlsxWriter().write(plain)
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(buffer as unknown as ArrayBuffer)
    expect(reopened.getWorksheet('Grid')?.pageSetup?.printTitlesRow).toBeFalsy()
  })
})

describe('long text in a form', () => {
  it('wraps only the columns that asked', async () => {
    // Excel does not wrap by default, so a description column narrower than its
    // content spills into the next cell or is clipped when printed — invisible
    // to any test that only reads values.
    const book = compile(
      <Workbook>
        <Sheet name="S">
          <Table
            name="t"
            data={[{ no: 1, desc: 'a description far longer than the column is wide' }]}
            columns={[
              col('no', { header: 'No', width: 6 }),
              col('desc', { header: 'Description', width: 20, wrap: true }),
            ]}
          />
        </Sheet>
      </Workbook>,
    )
    const buffer = await new XlsxWriter().write(book)
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(buffer as unknown as ArrayBuffer)
    const sheet = reopened.getWorksheet('S')

    expect(sheet?.getCell('B2').alignment).toMatchObject({ wrapText: true, vertical: 'top' })
    expect(sheet?.getCell('A2').alignment?.wrapText).toBeFalsy()
  })
})
