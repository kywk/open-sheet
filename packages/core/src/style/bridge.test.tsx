import { describe, expect, it } from 'vitest'
import { compile } from '../compile/compile.js'
import { budget } from '../compile/fixtures.js'
import { toHtml } from '../export/html.js'
import { evaluateWorkbook } from '../formula/evaluate.js'
import { formatValue, toCssDeclarations } from './css.js'
import { toArgb, toExcelStyle } from './excel.js'
import { DEFAULT_THEME, resolveStyle } from './theme.js'

describe('the style bridge', () => {
  it('renders one style into both targets consistently', () => {
    const header = resolveStyle(DEFAULT_THEME, 'tableHeader')
    expect(header).toBeDefined()

    const css = toCssDeclarations(header as never)
    const excel = toExcelStyle(header as never)

    expect(css['font-weight']).toBe('700')
    expect(excel.font?.bold).toBe(true)

    expect(css['background-color']).toBe('#0f172a')
    expect(excel.fill?.fgColor.argb).toBe('FF0F172A')

    expect(css.color).toBe('#ffffff')
    expect(excel.font?.color?.argb).toBe('FFFFFFFF')
  })

  it('converts colours to the ARGB Excel wants', () => {
    expect(toArgb('#1d4ed8')).toBe('FF1D4ED8')
    expect(toArgb('#abc')).toBe('FFAABBCC')
    expect(toArgb('FF00FF00')).toBe('FF00FF00')
  })

  it('falls back to the default theme when a theme omits a key', () => {
    const sparse = { ...DEFAULT_THEME, name: 'sparse', styles: { body: {} } }
    expect(resolveStyle(sparse, 'tableTotal')).toEqual(DEFAULT_THEME.styles.tableTotal)
  })
})

describe('number formats render the same way HTML and Excel do', () => {
  it('handles the named formats', () => {
    expect(formatValue(12_400_000, 'currency')).toBe('12,400,000')
    expect(formatValue(0.6029159, 'percent')).toBe('60.3%')
    expect(formatValue(0.6029159, 'percent2')).toBe('60.29%')
    expect(formatValue(12_400_000, 'millions')).toBe('12M')
    expect(formatValue(1234.5, 'decimal')).toBe('1,234.50')
    expect(formatValue(-1234, 'currency')).toBe('-1,234')
    expect(formatValue('text', 'currency')).toBe('text')
    expect(formatValue(null, 'currency')).toBe('')
  })
})

describe('html export', () => {
  const render = () => {
    const book = compile(budget())
    return toHtml(book, { title: 'Budget', values: evaluateWorkbook(book) })
  }

  it('writes a self-contained document', () => {
    const html = render()
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<style>')
    expect(html).not.toMatch(/<(script|link|img)\b/)
  })

  it('shows computed values, formatted', () => {
    const html = render()
    expect(html).toContain('12,400,000')
    expect(html).toContain('60.3%')
  })

  it('renders one section per sheet', () => {
    const html = render()
    expect(html).toContain('<h2>Assumptions</h2>')
    expect(html).toContain('<h2>P&amp;L</h2>')
  })

  it('escapes sheet names and text', () => {
    expect(render()).not.toContain('<h2>P&L</h2>')
  })

  it('merges spanned cells instead of repeating them', () => {
    const html = render()
    const notes = html.match(/Forecast beyond Q4/g) ?? []
    expect(notes).toHaveLength(1)
    expect(html).toMatch(/colspan="\d+"/)
  })

  it('keeps wide grids inside a scroll container', () => {
    expect(render()).toContain('class="os-scroll"')
  })

  it('carries print rules so the PDF matches', () => {
    const html = render()
    expect(html).toContain('@media print')
    expect(html).toContain('@page { size: A4 landscape')
    expect(html).toContain('display: table-header-group')
  })
})

describe('data bars land in both renderers', () => {
  it('records one rule per barred column, over the data range only', () => {
    const book = compile(budget())
    const pl = book.sheets[1]
    expect(pl?.conditionalFormats).toHaveLength(1)

    const anchor = book.registry.get('pl')
    if (anchor?.kind !== 'table') throw new Error('no pl table')
    const format = pl?.conditionalFormats[0]

    expect(format?.kind).toBe('dataBar')
    expect(format?.rect.r).toBe(anchor.firstDataRow)
    expect(format?.rect.rows).toBe(anchor.rowCount)
    expect(format?.rect.c).toBe(anchor.columns.get('revenue'))
  })

  it('draws the bar as a gradient in HTML, scaled to the range maximum', () => {
    const book = compile(budget())
    const html = toHtml(book, { values: evaluateWorkbook(book) })
    expect(html).toContain('linear-gradient(to right, #93c5fd 100%')
    expect(html).toMatch(/linear-gradient\(to right, #93c5fd 7[0-9]%/)
  })
})
