/** @jsxImportSource react */
// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { compile } from '../compile/compile.js'
import { budget } from '../compile/fixtures.js'
import { evaluateWorkbook } from '../formula/evaluate.js'
import { App } from './App.js'
import { FormulaBar } from './components/FormulaBar.js'
import { Grid } from './components/Grid.js'

function fixture() {
  const book = compile(budget())
  return { book, values: evaluateWorkbook(book) }
}

describe('the viewer', () => {
  it('compiles and renders a workbook in the browser', async () => {
    render(<App />)
    // The title appears in both the sidebar and the toolbar.
    await waitFor(() => expect(screen.getAllByText('Fixture Budget').length).toBe(2))
    expect(screen.getByRole('tab', { name: 'Assumptions' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'P&L' })).toBeTruthy()
  })

  it('lists workbooks in the sidebar', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Fixture Budget').length).toBeGreaterThan(0))
  })

  it('offers every export format', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('XLSX')).toBeTruthy())
    const xlsx = screen.getByText('XLSX') as HTMLAnchorElement
    expect(xlsx.getAttribute('href')).toContain('format=xlsx')
    expect(xlsx.getAttribute('href')).toContain('id=fixture-budget')
  })
})

describe('the workspace views', () => {
  it('offers Workbooks, Themes, and Assets', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Themes' })).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Workbooks' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Assets' })).toBeTruthy()
  })

  it('switches away from the grid when another view is picked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Fixture Budget').length).toBe(2))

    await user.click(screen.getByRole('button', { name: 'Themes' }))
    expect(screen.queryByRole('tab', { name: 'P&L' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Workbooks' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: 'P&L' })).toBeTruthy())
  })
})

describe('the grid', () => {
  it('renders computed values, formatted', () => {
    const { book, values } = fixture()
    const { container } = render(
      <Grid
        sheet={book.sheets[1]!}
        values={values}
        selection={{ r: 0, c: 0 }}
        onSelect={() => {}}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('12,400,000')
    expect(text).toContain('Gross profit')
    expect(text).toContain('60.3%')
  })

  it('marks the selected cell', () => {
    const { book, values } = fixture()
    const { container } = render(
      <Grid
        sheet={book.sheets[1]!}
        values={values}
        selection={{ r: 4, c: 1 }}
        onSelect={() => {}}
      />,
    )
    expect(container.querySelectorAll('.os-cell.is-selected')).toHaveLength(1)
  })

  it('renders row and column headers', () => {
    const { book, values } = fixture()
    const { container } = render(
      <Grid
        sheet={book.sheets[0]!}
        values={values}
        selection={{ r: 0, c: 0 }}
        onSelect={() => {}}
      />,
    )
    const heads = container.querySelector('.os-colheads')
    expect(within(heads as HTMLElement).getByText('A')).toBeTruthy()
    expect(within(heads as HTMLElement).getByText('B')).toBeTruthy()
  })

  it('virtualizes: a tall sheet renders far fewer cells than it has', () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({ a: i }))
    const book = compile({
      kind: 'workbook',
      children: [
        {
          kind: 'sheet',
          name: 'Big',
          children: [
            {
              kind: 'table',
              name: 'big',
              variant: 'grid',
              showHeader: true,
              data: rows,
              columns: [{ key: 'a', header: 'A' }],
            },
          ],
        },
      ],
    })
    const { container } = render(
      <Grid
        sheet={book.sheets[0]!}
        values={new Map()}
        selection={{ r: 0, c: 0 }}
        onSelect={() => {}}
      />,
    )
    const rendered = container.querySelectorAll('.os-cell').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(2000)
  })
})

describe('the formula bar', () => {
  it('shows the resolved formula and the computed value', () => {
    const { book, values } = fixture()
    const anchor = book.registry.get('pl')
    if (anchor?.kind !== 'table') throw new Error('no pl table')
    const { container } = render(
      <FormulaBar
        book={book}
        values={values}
        sheetIndex={1}
        selection={{ r: anchor.firstDataRow, c: anchor.columns.get('grossProfit') as number }}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('=B5-C5')
    expect(text).toContain('7300000')
  })

  it('shows the defined name rather than an address', () => {
    const { book, values } = fixture()
    const anchor = book.registry.get('pl')
    if (anchor?.kind !== 'table') throw new Error('no pl table')
    const { container } = render(
      <FormulaBar
        book={book}
        values={values}
        sheetIndex={1}
        selection={{ r: anchor.firstDataRow, c: anchor.columns.get('netIncome') as number }}
      />,
    )
    expect(container.textContent).toContain('taxRate')
  })
})
