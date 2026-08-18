import { describe, expect, it } from 'vitest'
import { compile } from '../compile/compile.js'
import { Cell, col, Sheet, Stack, Table, Workbook } from '../compile/components.js'
import { budget, QUARTERS } from '../compile/fixtures.js'
import { cellKey } from '../model/cell.js'
import { ref } from '../refs/ref.js'
import { CycleError, evaluateWorkbook } from './evaluate.js'
import { div, raw } from './expr.js'
import { display, isNotEvaluated } from './value.js'

function valuesOf(node: unknown) {
  const book = compile(node)
  return { book, values: evaluateWorkbook(book) }
}

const at = (values: Map<string, unknown>, sheet: string, r: number, c: number) =>
  values.get(`${sheet}!${cellKey(r, c)}`)

describe('evaluate', () => {
  it('computes the numbers the viewer will show', () => {
    const { values } = valuesOf(budget())
    const grossProfit = QUARTERS[0]!.revenue - QUARTERS[0]!.cogs
    expect(at(values, 'P&L', 4, 3)).toBe(grossProfit)
  })

  it('computes a total from a range it was never given an address for', () => {
    const { values } = valuesOf(budget())
    const expected = QUARTERS.reduce((acc, q) => acc + q.revenue, 0)
    expect(at(values, 'P&L', 8, 1)).toBe(expected)
  })

  it('computes a cross-row ratio', () => {
    const { values } = valuesOf(budget())
    const expected = QUARTERS[1]!.revenue / QUARTERS[0]!.revenue - 1
    expect(at(values, 'P&L', 5, 4)).toBeCloseTo(expected, 12)
  })

  it('computes a KPI that depends on two aggregates', () => {
    const { values } = valuesOf(budget())
    const revenue = QUARTERS.reduce((acc, q) => acc + q.revenue, 0)
    const gross = QUARTERS.reduce((acc, q) => acc + (q.revenue - q.cogs), 0)
    expect(at(values, 'P&L', 1, 1)).toBeCloseTo(gross / revenue, 12)
  })

  it('reads a defined name across sheets', () => {
    const book = (
      <Workbook>
        <Sheet name="A">
          <Table
            name="assume"
            kind="keyValue"
            data={[{ key: 'growth', label: 'Growth', value: 0.08 }]}
          />
        </Sheet>
        <Sheet name="B">
          <Cell formula={div(ref('assume').get('growth'), 2)} />
        </Sheet>
      </Workbook>
    )
    const { values } = valuesOf(book)
    expect(at(values, 'B', 0, 0)).toBeCloseTo(0.04, 12)
  })
})

describe('honesty about what we did not compute', () => {
  it('reports raw() as not evaluated rather than guessing', () => {
    const book = (
      <Workbook>
        <Sheet name="A">
          <Cell formula={raw('=XIRR(A1:A9,B1:B9)')} />
        </Sheet>
      </Workbook>
    )
    const { values } = valuesOf(book)
    const value = at(values, 'A', 0, 0)
    expect(isNotEvaluated(value)).toBe(true)
    expect(display(value as never)).toBe('#NOT_EVALUATED')
  })

  it('propagates not-evaluated through dependents', () => {
    const book = (
      <Workbook>
        <Sheet name="A">
          <Stack gap={0}>
            <Table
              name="t"
              data={[{ a: 1 }]}
              columns={[col('a'), col('b', { formula: () => raw('=XIRR(A1:A2,B1:B2)') })]}
              total={{ b: 'sum' }}
            />
          </Stack>
        </Sheet>
      </Workbook>
    )
    const { values } = valuesOf(book)
    expect(isNotEvaluated(at(values, 'A', 2, 1))).toBe(true)
  })

  it('returns #DIV/0! rather than Infinity', () => {
    const book = (
      <Workbook>
        <Sheet name="A">
          <Stack gap={0}>
            <Cell value={0} />
            <Cell formula={div(1, 0)} />
          </Stack>
        </Sheet>
      </Workbook>
    )
    const { values } = valuesOf(book)
    expect(display(at(values, 'A', 1, 0) as never)).toBe('#DIV/0!')
  })
})

describe('cycles', () => {
  it('names the cells involved instead of hanging', () => {
    const book = {
      kind: 'workbook',
      children: [
        {
          kind: 'sheet',
          name: 'A',
          children: [
            {
              kind: 'table',
              name: 'loop',
              variant: 'grid',
              showHeader: false,
              data: [{ a: 1 }, { a: 2 }],
              columns: [
                {
                  key: 'a',
                  formula: (r: { index: number }) => ({
                    k: 'ref',
                    target: {
                      kind: 'cell',
                      block: 'loop',
                      part: 'data',
                      column: 'a',
                      row: r.index === 0 ? 1 : 0,
                    },
                  }),
                },
              ],
            },
          ],
        },
      ],
    }
    expect(() => valuesOf(book)).toThrow(CycleError)
    expect(() => valuesOf(book)).toThrow(/circular reference/)
  })
})
