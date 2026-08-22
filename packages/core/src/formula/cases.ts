import type { Expr, ExprInput } from './expr.js'
import { lift } from './expr.js'

/**
 * Builds a call to any function, whitelisted or not. The harness exists to
 * decide what belongs on the whitelist, so it must be able to ask about
 * functions that are not on it yet.
 */
export function call(name: string, ...args: ExprInput[]): Expr {
  return { k: 'fn', name, args: args.map(lift) }
}

export interface FunctionCase {
  /** Groups the report; several cases per function is normal. */
  fn: string
  /** What this case is checking, when the arguments do not say it. */
  note?: string
  /** Laid out in one column; `cell(i)` and `range(a, b)` point into it. */
  data: (number | string)[]
  build: (cell: (index: number) => Expr, range: (from: number, to: number) => Expr) => Expr
  /** What a real spreadsheet produces. Floats compare with a tolerance. */
  expect: number | string | boolean
}

const N = [3, 9, 5, 1, 7]

/**
 * One case per behaviour worth trusting, not one per function. A function joins
 * the whitelist only when its cases agree with a real engine — anything else is
 * a promise the whitelist cannot keep.
 */
export const CASES: FunctionCase[] = [
  // --- already whitelisted: these guard against regressions -----------------
  { fn: 'SUM', data: N, build: (_, r) => call('SUM', r(0, 4)), expect: 25 },
  { fn: 'AVERAGE', data: N, build: (_, r) => call('AVERAGE', r(0, 4)), expect: 5 },
  { fn: 'MIN', data: N, build: (_, r) => call('MIN', r(0, 4)), expect: 1 },
  { fn: 'MAX', data: N, build: (_, r) => call('MAX', r(0, 4)), expect: 9 },
  { fn: 'COUNT', data: N, build: (_, r) => call('COUNT', r(0, 4)), expect: 5 },
  {
    fn: 'ROUND',
    data: [1234.567],
    build: (c) => call('ROUND', c(0), 2),
    expect: 1234.57,
  },
  {
    fn: 'ROUND',
    note: 'negative digits round to the left of the point',
    data: [1234.567],
    build: (c) => call('ROUND', c(0), -2),
    expect: 1200,
  },
  { fn: 'ABS', data: [-42.5], build: (c) => call('ABS', c(0)), expect: 42.5 },
  {
    fn: 'SUMPRODUCT',
    note: 'array comparison — the only reason to use it',
    data: N,
    build: (c, r) =>
      call('SUMPRODUCT', {
        k: 'op',
        op: '*',
        l: { k: 'op', op: '>', l: r(0, 4), r: c(0) },
        r: { k: 'lit', v: 1 },
      }),
    expect: 3,
  },

  // --- tier 1: lookup and conditional aggregation ---------------------------
  { fn: 'LARGE', data: N, build: (_, r) => call('LARGE', r(0, 4), 2), expect: 7 },
  { fn: 'SMALL', data: N, build: (_, r) => call('SMALL', r(0, 4), 2), expect: 3 },
  {
    fn: 'MATCH',
    note: 'exact match returns a 1-based position',
    data: N,
    build: (_, r) => call('MATCH', 5, r(0, 4), 0),
    expect: 3,
  },
  {
    fn: 'INDEX',
    data: N,
    build: (_, r) => call('INDEX', r(0, 4), 2),
    expect: 9,
  },
  {
    fn: 'INDEX+MATCH',
    note: 'the pair that replaces VLOOKUP',
    data: N,
    build: (_, r) => call('INDEX', r(0, 4), call('MATCH', 7, r(0, 4), 0)),
    expect: 7,
  },
  {
    fn: 'SUMIF',
    note: 'criteria as a comparison string',
    data: N,
    build: (_, r) => call('SUMIF', r(0, 4), '>4'),
    expect: 21,
  },
  {
    fn: 'COUNTIF',
    data: N,
    build: (_, r) => call('COUNTIF', r(0, 4), '>4'),
    expect: 3,
  },
  {
    fn: 'AVERAGEIF',
    data: N,
    build: (_, r) => call('AVERAGEIF', r(0, 4), '>4'),
    expect: 7,
  },
  {
    fn: 'RANK',
    note: 'absent from the library; the SUMPRODUCT idiom exists because of this',
    data: N,
    build: (c, r) => call('RANK', c(1), r(0, 4), 0),
    expect: 1,
  },

  // --- tier 2: text and dates ----------------------------------------------
  { fn: 'LEN', data: ['hello'], build: (c) => call('LEN', c(0)), expect: 5 },
  { fn: 'LEFT', data: ['hello'], build: (c) => call('LEFT', c(0), 2), expect: 'he' },
  { fn: 'RIGHT', data: ['hello'], build: (c) => call('RIGHT', c(0), 2), expect: 'lo' },
  { fn: 'MID', data: ['hello'], build: (c) => call('MID', c(0), 2, 3), expect: 'ell' },
  { fn: 'TRIM', data: ['  a b  '], build: (c) => call('TRIM', c(0)), expect: 'a b' },
  { fn: 'UPPER', data: ['abc'], build: (c) => call('UPPER', c(0)), expect: 'ABC' },
  {
    fn: 'SUBSTITUTE',
    data: ['a-b-c'],
    build: (c) => call('SUBSTITUTE', c(0), '-', '+'),
    expect: 'a+b+c',
  },
  {
    fn: 'TEXT',
    note: 'number formatting inside a formula',
    data: [0.1234],
    build: (c) => call('TEXT', c(0), '0.0%'),
    expect: '12.3%',
  },
  {
    fn: 'YEAR',
    note: 'a date literal, not a serial number',
    data: [],
    build: () => call('YEAR', call('DATE', 2026, 8, 22)),
    expect: 2026,
  },
  {
    fn: 'EOMONTH',
    note: 'end of month, as a serial — the comparison is on the number',
    data: [],
    build: () => call('DAY', call('EOMONTH', call('DATE', 2026, 2, 10), 0)),
    expect: 28,
  },
  {
    fn: 'EDATE',
    data: [],
    build: () => call('MONTH', call('EDATE', call('DATE', 2026, 1, 31), 1)),
    expect: 2,
  },

  // --- tier 3: finance and statistics --------------------------------------
  { fn: 'MEDIAN', data: N, build: (_, r) => call('MEDIAN', r(0, 4)), expect: 5 },
  {
    fn: 'PMT',
    note: 'negative by convention: it is a payment out',
    data: [],
    build: () => call('ROUND', call('PMT', 0.05 / 12, 60, 100000), 2),
    expect: -1887.12,
  },
  {
    fn: 'FV',
    data: [],
    build: () => call('ROUND', call('FV', 0.05, 10, 0, -1000), 2),
    expect: 1628.89,
  },
  {
    fn: 'PV',
    data: [],
    build: () => call('ROUND', call('PV', 0.05, 10, 0, -1000), 2),
    expect: 613.91,
  },
  {
    fn: 'SLN',
    data: [],
    build: () => call('SLN', 10000, 1000, 5),
    expect: 1800,
  },

  // --- tier 4: logic and predicates ----------------------------------------
  { fn: 'MOD', data: [], build: () => call('MOD', 7, 3), expect: 1 },
  { fn: 'INT', data: [], build: () => call('INT', 7.8), expect: 7 },
  { fn: 'SIGN', data: [], build: () => call('SIGN', -3), expect: -1 },
  { fn: 'SQRT', data: [], build: () => call('SQRT', 16), expect: 4 },
  { fn: 'POWER', data: [], build: () => call('POWER', 2, 10), expect: 1024 },
  { fn: 'CEILING', data: [], build: () => call('CEILING', 4.1, 1), expect: 5 },
  { fn: 'FLOOR', data: [], build: () => call('FLOOR', 4.9, 1), expect: 4 },
  {
    fn: 'CHOOSE',
    data: [],
    build: () => call('CHOOSE', 2, 'a', 'b', 'c'),
    expect: 'b',
  },
  {
    fn: 'SWITCH',
    data: [],
    build: () => call('SWITCH', 2, 1, 'one', 2, 'two', 'other'),
    expect: 'two',
  },
  {
    fn: 'ISNUMBER',
    data: N,
    build: (c) => call('ISNUMBER', c(0)),
    expect: true,
  },
  {
    fn: 'IFS',
    data: N,
    build: (c) =>
      call('IFS', { k: 'op', op: '>', l: c(1), r: { k: 'lit', v: 5 } }, 'big', true, 'small'),
    expect: 'big',
  },
]
