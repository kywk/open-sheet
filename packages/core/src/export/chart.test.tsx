import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { compile } from '../compile/compile.js'
import { Chart, col, Sheet, Stack, Table, Workbook } from '../compile/components.js'
import { evaluateWorkbook } from '../formula/evaluate.js'
import { ref } from '../refs/ref.js'
import { toHtml } from './html.js'
import { XlsxWriter } from './xlsx.js'

const rows = [
  { month: 'Jan', units: 120, revenue: 5_880 },
  { month: 'Feb', units: 150, revenue: 7_350 },
  { month: 'Mar', units: 190, revenue: 9_310 },
]

const book = () =>
  compile(
    <Workbook>
      <Sheet name="Sales">
        <Stack gap={1}>
          <Table
            name="sales"
            data={rows}
            columns={[
              col('month', { header: 'Month' }),
              col('units', { header: 'Units' }),
              col('revenue', { header: 'Revenue' }),
            ]}
            total={{ units: 'sum', revenue: 'sum' }}
          />
          <Chart
            kind="bar"
            title="Units by month"
            categories={ref('sales').column('month')}
            series={[
              { name: 'Units', values: ref('sales').column('units') },
              { name: 'Revenue', values: ref('sales').column('revenue') },
            ]}
          />
        </Stack>
      </Sheet>
    </Workbook>,
  )

async function parts() {
  const compiled = book()
  const buffer = await new XlsxWriter().write(compiled, { values: evaluateWorkbook(compiled) })
  const files = unzipSync(new Uint8Array(buffer))
  const decoder = new TextDecoder()
  return {
    names: Object.keys(files),
    read: (name: string) => decoder.decode(files[name] as Uint8Array),
  }
}

describe('native charts in the workbook', () => {
  it('writes the chart, drawing, and relationship parts', async () => {
    const { names } = await parts()
    expect(names).toContain('xl/charts/chart1.xml')
    expect(names).toContain('xl/drawings/drawing1.xml')
    expect(names).toContain('xl/drawings/_rels/drawing1.xml.rels')
    expect(names).toContain('xl/worksheets/_rels/sheet1.xml.rels')
  })

  it('binds each series to a live cell range, not to baked numbers', async () => {
    const { read } = await parts()
    const chart = read('xl/charts/chart1.xml')

    // This is the whole point: change a number and the chart moves.
    expect(chart).toContain('<c:f>Sales!$B$2:$B$4</c:f>')
    expect(chart).toContain('<c:f>Sales!$C$2:$C$4</c:f>')
    expect(chart).toContain('<c:f>Sales!$A$2:$A$4</c:f>')
    expect(chart).not.toContain('120')
    expect(chart).not.toContain('5880')
  })

  it('declares the chart parts so the package stays valid', async () => {
    const { read } = await parts()
    const types = read('[Content_Types].xml')
    expect(types).toContain('/xl/charts/chart1.xml')
    expect(types).toContain('drawingml.chart+xml')
    expect(types).toContain('/xl/drawings/drawing1.xml')
  })

  it('links the drawing from the sheet without colliding with existing ids', async () => {
    const { read } = await parts()
    const rels = read('xl/worksheets/_rels/sheet1.xml.rels')
    const ids = [...rels.matchAll(/Id="(rId\d+)"/g)].map((m) => m[1])
    expect(new Set(ids).size, 'relationship ids must be unique').toBe(ids.length)
    expect(read('xl/worksheets/sheet1.xml')).toMatch(/<drawing r:id="rId\d+"\/>/)
  })

  it('carries the title and a legend for multiple series', async () => {
    const chart = (await parts()).read('xl/charts/chart1.xml')
    expect(chart).toContain('Units by month')
    expect(chart).toContain('<c:legend>')
    expect(chart).toContain('<c:barChart>')
  })

  it('leaves a workbook without charts byte-identical to plain ExcelJS output', async () => {
    const plain = compile(
      <Workbook>
        <Sheet name="S">
          <Table name="t" data={[{ a: 1 }]} columns={[col('a')]} />
        </Sheet>
      </Workbook>,
    )
    const buffer = await new XlsxWriter().write(plain)
    const names = Object.keys(unzipSync(new Uint8Array(buffer)))
    expect(names.some((name) => name.includes('chart'))).toBe(false)
    expect(names.some((name) => name.includes('drawing'))).toBe(false)
  })
})

describe('the HTML twin', () => {
  it('draws the same chart as SVG from the evaluated values', () => {
    const compiled = book()
    const html = toHtml(compiled, { values: evaluateWorkbook(compiled) })
    expect(html).toContain('<svg')
    expect(html).toContain('Units by month')
    expect(html).toContain('class="os-chart"')
    // categories come from the same range the workbook chart points at
    expect(html).toContain('>Jan<')
    expect(html).toContain('>Mar<')
  })
})
