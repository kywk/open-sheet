import { describe, expect, it } from 'vitest'
import { compile } from '../compile/compile.js'
import { Cell, col, Sheet, Stack, Table, Workbook } from '../compile/components.js'
import { budget, QUARTERS } from '../compile/fixtures.js'
import { cellKey } from '../model/cell.js'
import { ref } from '../refs/ref.js'
import { CycleError, evaluateExpr, evaluateWorkbook } from './evaluate.js'
import {
  abs,
  add,
  div,
  gt,
  if_,
  iferror,
  max,
  min,
  mul,
  pow,
  raw,
  round,
  sub,
  sum,
  sumproduct,
} from './expr.js'
import { serialize, toFormula } from './serialize.js'
import { display, isNotEvaluated } from './value.js'

function valuesOf(node: unknown) {
  const book = compile(node)
  return { book, values: evaluateWorkbook(book) }
}

const at = (values: Map<string, unknown>, sheet: string, r: number, c: number) =>
  values.get(`${sheet}!${cellKey(r, c)}`)

/** Look columns up by name — hard-coded indices break every time a column moves. */
function column(book: ReturnType<typeof compile>, table: string, key: string): number {
  const anchor = book.registry.get(table)
  if (anchor?.kind !== 'table') throw new Error(`no table ${table}`)
  const index = anchor.columns.get(key)
  if (index === undefined) throw new Error(`no column ${key}`)
  return index
}

function dataRow(book: ReturnType<typeof compile>, table: string, offset: number): number {
  const anchor = book.registry.get(table)
  if (anchor?.kind !== 'table') throw new Error(`no table ${table}`)
  return anchor.firstDataRow + offset
}

describe('evaluate', () => {
  it('computes the numbers the viewer will show', () => {
    const { book, values } = valuesOf(budget())
    const grossProfit = QUARTERS[0]!.revenue - QUARTERS[0]!.cogs
    expect(at(values, 'P&L', dataRow(book, 'pl', 0), column(book, 'pl', 'grossProfit'))).toBe(
      grossProfit,
    )
  })

  it('computes a total from a range it was never given an address for', () => {
    const { book, values } = valuesOf(budget())
    const anchor = book.registry.get('pl')
    if (anchor?.kind !== 'table') throw new Error('no pl table')
    const expected = QUARTERS.reduce((acc, q) => acc + q.revenue, 0)
    expect(at(values, 'P&L', anchor.totalRow as number, column(book, 'pl', 'revenue'))).toBe(
      expected,
    )
  })

  it('computes a cross-row ratio', () => {
    const { book, values } = valuesOf(budget())
    const expected = QUARTERS[1]!.revenue / QUARTERS[0]!.revenue - 1
    expect(at(values, 'P&L', dataRow(book, 'pl', 1), column(book, 'pl', 'qoq'))).toBeCloseTo(
      expected,
      12,
    )
  })

  it('computes a KPI that depends on two aggregates', () => {
    const { values } = valuesOf(budget())
    const revenue = QUARTERS.reduce((acc, q) => acc + q.revenue, 0)
    const gross = QUARTERS.reduce((acc, q) => acc + (q.revenue - q.cogs), 0)
    expect(at(values, 'P&L', 1, 1)).toBeCloseTo(gross / revenue, 12)
  })

  it('drives a whole column off a cross-sheet assumption', () => {
    const { book, values } = valuesOf(budget())
    const taxRate = 0.2
    QUARTERS.forEach((q, i) => {
      const expected = (q.revenue - q.cogs) * (1 - taxRate)
      expect(
        at(values, 'P&L', dataRow(book, 'pl', i), column(book, 'pl', 'netIncome')),
      ).toBeCloseTo(expected, 6)
    })
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
    // Named by construct, not by coordinate — the author never wrote one.
    expect(() => valuesOf(book)).toThrow(/"loop" column "a" row 1/)
    expect(() => valuesOf(book)).toThrow(/"loop" column "a" row 2/)
  })
})

describe('functions that exist to catch errors must actually see them', () => {
  const book = (formula: unknown) =>
    compile({
      kind: 'workbook',
      children: [
        {
          kind: 'sheet',
          name: 'S',
          children: [
            {
              kind: 'table',
              name: 't',
              variant: 'grid',
              showHeader: false,
              data: [{ cur: 10, prev: 0 }],
              columns: [{ key: 'cur' }, { key: 'prev' }, { key: 'out', formula }],
            },
          ],
        },
      ],
    })

  it('IFERROR returns its fallback instead of the error', () => {
    // Reported from a real workbook: a month-on-month column where the previous
    // month is zero. Without this, an author is pushed to fake the denominator.
    const values = evaluateWorkbook(
      book((r: { cell: (k: string) => never }) =>
        iferror(sub(div(r.cell('cur'), r.cell('prev')), 1), ''),
      ),
    )
    expect(values.get('S!0,2')).toBe('')
  })

  it('IFERROR passes a good value straight through', () => {
    const values = evaluateWorkbook(
      book((r: { cell: (k: string) => never }) => iferror(div(r.cell('cur'), 2), 'oops')),
    )
    expect(values.get('S!0,2')).toBe(5)
  })

  it('IF evaluates only the branch it takes', () => {
    // Excel's IF is lazy. Evaluating both branches makes a guarded division
    // fail on exactly the rows the guard exists for.
    const values = evaluateWorkbook(
      book((r: { cell: (k: string) => never }) =>
        if_(gt(r.cell('prev'), 0), div(r.cell('cur'), r.cell('prev')), 0),
      ),
    )
    expect(values.get('S!0,2')).toBe(0)
  })

  it('still propagates an error nothing is catching', () => {
    const values = evaluateWorkbook(
      book((r: { cell: (k: string) => never }) => div(r.cell('cur'), r.cell('prev'))),
    )
    expect(display(values.get('S!0,2') as never)).toBe('#DIV/0!')
  })
})

describe('array semantics — what SUMPRODUCT is actually for', () => {
  const ranked = () =>
    compile({
      kind: 'workbook',
      children: [
        {
          kind: 'sheet',
          name: 'S',
          children: [
            {
              kind: 'table',
              name: 't',
              variant: 'grid',
              showHeader: true,
              data: [{ v: 11 }, { v: 30 }, { v: 25 }],
              columns: [
                { key: 'v' },
                {
                  key: 'rank',
                  // The standard spreadsheet ranking idiom: count how many are
                  // larger. Summing one plain range would just be SUM — array
                  // comparison is the entire reason to reach for SUMPRODUCT.
                  formula: (r: never) =>
                    add(
                      sumproduct(
                        mul(
                          gt(
                            ref('t').column('v'),
                            (r as never as { cell: (k: string) => never }).cell('v'),
                          ),
                          1,
                        ),
                      ),
                      1,
                    ),
                },
              ],
            },
          ],
        },
      ],
    })

  it('ranks by counting how many are larger', () => {
    const values = evaluateWorkbook(ranked())
    expect(values.get('S!1,1')).toBe(3)
    expect(values.get('S!2,1')).toBe(1)
    expect(values.get('S!3,1')).toBe(2)
  })

  it('exports the formula Excel expects', () => {
    const book = ranked()
    expect(
      toFormula(book.sheets[0]?.cells.get('1,1')?.expr as never, {
        registry: book.registry,
        definedNames: book.definedNames,
        sheet: 'S',
      }),
    ).toBe('=SUMPRODUCT((A2:A4>A2)*1)+1')
  })
})

describe('never claim an Excel error we invented', () => {
  it('reports what we could not evaluate as not-evaluated, so iferror cannot swallow it', () => {
    // Fixing IFERROR made it able to mask evaluator gaps too, if those gaps
    // reported themselves as #VALUE!. They report #NOT_EVALUATED instead, which
    // is not catchable and counts in the badge.
    const book = compile({
      kind: 'workbook',
      children: [
        {
          kind: 'sheet',
          name: 'S',
          children: [
            {
              kind: 'table',
              name: 't',
              variant: 'grid',
              showHeader: false,
              data: [{ a: 1 }],
              columns: [
                { key: 'a' },
                { key: 'out', formula: () => iferror(raw('=XIRR(A1:A9,B1:B9)'), 'hidden') },
              ],
            },
          ],
        },
      ],
    })
    expect(isNotEvaluated(evaluateWorkbook(book).get('S!0,1'))).toBe(true)
  })
})

describe('elementwise functions map over a range; aggregates do not', () => {
  const mk = (formula: unknown) =>
    compile({
      kind: 'workbook',
      children: [
        {
          kind: 'sheet',
          name: 'S',
          children: [
            {
              kind: 'table',
              name: 't',
              variant: 'grid',
              showHeader: true,
              data: [{ v: -30 }, { v: 11 }, { v: -25 }],
              columns: [{ key: 'v' }, { key: 'out', formula }],
            },
          ],
        },
      ],
    })
  const at = (formula: unknown) => evaluateWorkbook(mk(formula)).get('S!1,1')

  it('ranks by magnitude — the case this was found on', () => {
    // Ranking by size of change is the ordinary reason to reach for ABS inside
    // SUMPRODUCT, and the exported formula was always right; only we could not
    // compute it.
    expect(
      at((r: { cell: (k: string) => never }) =>
        add(sumproduct(mul(gt(abs(ref('t').column('v')), abs(r.cell('v'))), 1)), 1),
      ),
    ).toBe(1)
  })

  it('maps ROUND across a range', () => {
    expect(at(() => sumproduct(round(ref('t').column('v'), 0)))).toBe(-44)
  })

  it('leaves aggregates alone — MIN over a range is a minimum, not three of them', () => {
    expect(at(() => min(ref('t').column('v')))).toBe(-30)
    expect(at(() => max(ref('t').column('v')))).toBe(11)
    expect(at(() => sum(ref('t').column('v')))).toBe(-44)
  })

  it('still works on a plain scalar', () => {
    expect(at((r: { cell: (k: string) => never }) => abs(r.cell('v')))).toBe(30)
  })
})

describe('exponent associativity matches Excel', () => {
  // Nearly reported as a serialiser bug. Excel's ^ is left-associative, unlike
  // most languages, so `B2^2^0.5` is correct for pow(pow(v,2),0.5) and the
  // parentheses really are unnecessary. The control case is what settles it.
  const context = { registry: new Map(), definedNames: new Map(), sheet: 'S' } as never

  it('omits parentheses on the left, keeps them on the right', () => {
    expect(serialize(pow(pow({ k: 'addr', ref: 'B8' }, 2), 0.5), context)).toBe('B8^2^0.5')
    expect(serialize(pow({ k: 'addr', ref: 'B8' }, pow(2, 0.5)), context)).toBe('B8^(2^0.5)')
  })

  it('evaluates left-associatively, as Excel does', () => {
    // =2^3^2 is 64 in Excel, not 512.
    expect(evaluateExpr(pow(pow(2, 3), 2), context, () => null)).toBe(64)
  })
})

describe('a failing formula names the construct it came from', () => {
  it('prefixes the block, column and row', () => {
    // Reported after bisecting a 450-line workbook by hand to find one bad
    // column: the error surfaced with no file, line, column or block.
    const book = () =>
      compile({
        kind: 'workbook',
        children: [
          {
            kind: 'sheet',
            name: 'S',
            children: [
              {
                kind: 'table',
                name: 'costs',
                variant: 'grid',
                showHeader: true,
                data: [{ v: 1 }],
                columns: [
                  { key: 'v' },
                  { key: 'bad', formula: () => sum(ref('costs').column('nope')) },
                ],
              },
            ],
          },
        ],
      })
    expect(() => evaluateWorkbook(book())).toThrow(/"costs" column "bad" row 1/)
    expect(() => evaluateWorkbook(book())).toThrow(/did you mean|no column "nope"/)
  })
})
