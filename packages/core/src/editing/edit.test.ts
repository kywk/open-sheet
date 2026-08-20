import { describe, expect, it } from 'vitest'
import { compile } from '../compile/compile.js'
import { originOf } from '../compile/origin.js'
import { fromA1 } from '../model/a1.js'
import {
  addComment,
  ChangedUnderfootError,
  editCell,
  listComments,
  NotEditableError,
} from './edit.js'
import { findEditTarget, parseWorkbook } from './locate.js'

const SOURCE = `import { Sheet, Table, Workbook, col, sub } from '@open-sheet/core'

export const meta = { title: 'Edit target' }

interface Row {
  quarter: string
  revenue: number
  cogs: number
}

// Declared separately, the way a real workbook does it.
const quarters: Row[] = [
  { quarter: 'Q1', revenue: 12400000, cogs: 5100000 },
  { quarter: 'Q2', revenue: 13900000, cogs: 5600000 },
]

export default (
  <Workbook>
    <Sheet name="Assumptions">
      <Table name="assume" kind="keyValue" data={[
        { key: 'growth', label: 'Growth', value: 0.08 },
      ]} />
    </Sheet>
    <Sheet name="P&L">
      <Table
        name="pl"
        data={quarters}
        columns={[
          col('quarter', { header: 'Quarter' }),
          col('revenue', { header: 'Revenue' }),
          col('cogs', { header: 'COGS' }),
          col('grossProfit', {
            header: 'Gross profit',
            formula: (r) => sub(r.cell('revenue'), r.cell('cogs')),
          }),
        ]}
        total={{ revenue: 'sum' }}
      />
    </Sheet>
  </Workbook>
)
`

// The fixture above is what the *editor* parses. Compiling needs the real thing,
// so build an equivalent workbook to get a registry with the same shape.
function registryFor() {
  const book = compile({
    kind: 'workbook',
    children: [
      {
        kind: 'sheet',
        name: 'Assumptions',
        children: [
          {
            kind: 'table',
            name: 'assume',
            variant: 'keyValue',
            showHeader: false,
            data: [{ key: 'growth', label: 'Growth', value: 0.08 }],
            columns: [
              { key: 'label', value: (row: { label: string }) => row.label },
              { key: 'value' },
            ],
          },
        ],
      },
      {
        kind: 'sheet',
        name: 'P&L',
        children: [
          {
            kind: 'table',
            name: 'pl',
            variant: 'grid',
            showHeader: true,
            data: [
              { quarter: 'Q1', revenue: 12400000, cogs: 5100000 },
              { quarter: 'Q2', revenue: 13900000, cogs: 5600000 },
            ],
            columns: [
              { key: 'quarter', header: 'Quarter' },
              { key: 'revenue', header: 'Revenue' },
              { key: 'cogs', header: 'COGS' },
              { key: 'grossProfit', header: 'Gross profit', formula: () => ({ k: 'lit', v: 0 }) },
            ],
            total: { revenue: 'sum' },
          },
        ],
      },
    ],
  })
  return book
}

const at = (sheet: string, a1: string) => originOf(registryFor().registry, sheet, fromA1(a1))

describe('locating what produced a cell', () => {
  it('finds a data cell by block, column, and row', () => {
    expect(at('P&L', 'B2')).toEqual({
      block: 'pl',
      kind: 'table',
      column: 'revenue',
      row: 0,
      part: 'data',
    })
    expect(at('P&L', 'C3')).toMatchObject({ column: 'cogs', row: 1, part: 'data' })
  })

  it('recognises headers and totals', () => {
    expect(at('P&L', 'A1')).toMatchObject({ part: 'header', column: 'quarter' })
    expect(at('P&L', 'B4')).toMatchObject({ part: 'total', column: 'revenue' })
  })

  it('finds a key-value entry by its key', () => {
    expect(at('Assumptions', 'B1')).toMatchObject({ block: 'assume', column: 'growth' })
  })

  it('returns nothing outside every block', () => {
    expect(at('P&L', 'Z40')).toBeUndefined()
  })
})

describe('editing', () => {
  it('follows `data={quarters}` to the declaration and edits the right element', () => {
    const origin = at('P&L', 'B3')
    const edited = editCell({ source: SOURCE, origin: origin as never, value: '15000000' })

    expect(edited).toContain("{ quarter: 'Q2', revenue: 15000000, cogs: 5600000 }")
    // The other row and the rest of the file are untouched.
    expect(edited).toContain("{ quarter: 'Q1', revenue: 12400000, cogs: 5100000 }")
    expect(edited.split('\n').length).toBe(SOURCE.split('\n').length)
  })

  it('edits a key-value assumption', () => {
    const origin = at('Assumptions', 'B1')
    const edited = editCell({ source: SOURCE, origin: origin as never, value: '0.12' })
    expect(edited).toContain("{ key: 'growth', label: 'Growth', value: 0.12 }")
  })

  it('refuses when the cell no longer holds what the client saw', () => {
    const origin = at('P&L', 'B3')
    expect(() =>
      editCell({ source: SOURCE, origin: origin as never, value: '1', expected: '999' }),
    ).toThrow(ChangedUnderfootError)
  })

  it('refuses a computed column and says what to change instead', () => {
    const origin = at('P&L', 'D2')
    expect(() => editCell({ source: SOURCE, origin: origin as never, value: '1' })).toThrow(
      /computed, not stored/,
    )
  })

  it('refuses a total and points at the aggregate', () => {
    const origin = at('P&L', 'B4')
    expect(() => editCell({ source: SOURCE, origin: origin as never, value: '1' })).toThrow(
      NotEditableError,
    )
    expect(findEditTarget(SOURCE, at('P&L', 'B4') as never).reason).toContain('total')
  })

  it('points a header edit at the column option', () => {
    expect(findEditTarget(SOURCE, at('P&L', 'A1') as never).reason).toContain('header')
  })

  it('says so when the data array is computed rather than literal', () => {
    const computed = SOURCE.replace(
      'const quarters: Row[] = [',
      'const quarters: Row[] = build([',
    ).replace('\n]\n', '\n])\n')
    expect(() =>
      editCell({ source: computed, origin: at('P&L', 'B3') as never, value: '1' }),
    ).toThrow(/computed/)
  })
})

describe('comments', () => {
  it('leaves the file parseable — the test this feature shipped without', () => {
    // The original test asserted the marker was found and indented correctly and
    // stopped there. `//` in JSX children is not a comment, it is a bare text
    // node, so every note ever left broke the workbook with an error that looked
    // nothing like "you left a note".
    const commented = addComment({
      source: SOURCE,
      origin: at('P&L', 'B3') as never,
      text: 'check this',
    })
    expect(() => parseWorkbook(commented)).not.toThrow()
    expect(commented).toContain('{/* @sheet-comment')
    expect(commented).not.toMatch(/^\s*\/\/ @sheet-comment/m)
  })

  it('names the block, because one array can feed two tables', () => {
    const commented = addComment({
      source: SOURCE,
      origin: at('P&L', 'B3') as never,
      text: 'which table?',
    })
    expect(commented).toContain('"pl" column "revenue", row 2')
  })

  it('writes a marker above the block, with the cell it refers to', () => {
    const origin = at('P&L', 'B3')
    const commented = addComment({
      source: SOURCE,
      origin: origin as never,
      text: 'should this be net of returns?',
    })

    const found = listComments(commented)
    expect(found).toHaveLength(1)
    expect(found[0]?.text).toContain('should this be net of returns?')
    // …and the closing brace of the JSX comment is not part of the text.
    expect(found[0]?.text).not.toContain('*/')
    expect(commented).toContain('column "revenue", row 2')
  })

  it('keeps the indentation of the line it sits above', () => {
    const commented = addComment({
      source: SOURCE,
      origin: at('P&L', 'B3') as never,
      text: 'check',
    })
    const line = commented.split('\n').find((l) => l.includes('@sheet-comment')) as string
    expect(line.startsWith('      {/*')).toBe(true)
  })

  it('finds nothing in a clean file', () => {
    expect(listComments(SOURCE)).toHaveLength(0)
  })
})
