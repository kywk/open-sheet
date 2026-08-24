import { isRef, type Ref } from '../refs/ref.js'

export type Scalar = number | string | boolean

export type BinaryOp = '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<' | '>' | '<=' | '>=' | '<>'

export interface LitExpr {
  k: 'lit'
  v: Scalar
}
export interface RefExpr {
  k: 'ref'
  target: Ref
}
export interface OpExpr {
  k: 'op'
  op: BinaryOp
  l: Expr
  r: Expr
}
export interface NegExpr {
  k: 'neg'
  e: Expr
}
export interface FnExpr {
  k: 'fn'
  name: string
  args: Expr[]
}
export interface RawExpr {
  k: 'raw'
  src: string
}

/**
 * A literal A1 address or range, from a hand-written formula string. Kept as a
 * distinct node rather than as `raw` so it can still be evaluated — but kept as
 * an *address* rather than resolved into a Ref, because it is precisely the
 * thing that breaks when a row is inserted, and that should stay visible.
 */
export interface AddrExpr {
  k: 'addr'
  ref: string
}

export type Expr =
  | LitExpr
  | RefExpr
  | OpExpr
  | NegExpr
  | FnExpr
  | RawExpr
  | AddrExpr
  | RawTemplateExpr

export type ExprInput = Expr | Ref | Scalar

const EXPR_KINDS = new Set(['lit', 'ref', 'op', 'neg', 'fn', 'raw', 'addr', 'rawTemplate'])

export function isExpr(value: unknown): value is Expr {
  if (typeof value !== 'object' || value === null) return false
  const k = (value as { k?: unknown }).k
  return typeof k === 'string' && EXPR_KINDS.has(k)
}

export function lift(input: ExprInput): Expr {
  if (isExpr(input)) return input
  if (isRef(input)) return { k: 'ref', target: input }
  return { k: 'lit', v: input }
}

/**
 * The v0 whitelist. Dispatch is never dynamic on an arbitrary name: a function
 * outside this set has no evaluation path and must go through `raw()`, which
 * renders as #NOT_EVALUATED rather than as an invented number.
 */
export const FUNCTIONS = [
  'SUM',
  'AVERAGE',
  'COUNT',
  'COUNTA',
  'MIN',
  'MAX',
  'ROUND',
  'ROUNDUP',
  'ROUNDDOWN',
  'ABS',
  'IF',
  'IFERROR',
  'IFNA',
  'AND',
  'OR',
  'NOT',
  'CONCATENATE',
  'NPV',
  'IRR',
  'PMT',
  'SUMPRODUCT',
  // tier 1 — lookup and conditional aggregation
  'INDEX',
  'MATCH',
  'LARGE',
  'SMALL',
  'SUMIF',
  'SUMIFS',
  'COUNTIF',
  'COUNTIFS',
  'AVERAGEIF',
  'AVERAGEIFS',
  'MAXIFS',
  'MINIFS',
  // tier 2 — text
  'LEN',
  'LEFT',
  'RIGHT',
  'MID',
  'TRIM',
  'UPPER',
  'LOWER',
  'PROPER',
  'SUBSTITUTE',
  'REPLACE',
  'FIND',
  'SEARCH',
  'TEXT',
  'VALUE',
  'REPT',
  'TEXTJOIN',
  'CONCAT',
  // tier 2 — dates
  'DATE',
  'TODAY',
  'NOW',
  'YEAR',
  'MONTH',
  'DAY',
  'HOUR',
  'MINUTE',
  'WEEKDAY',
  'WEEKNUM',
  'EOMONTH',
  'EDATE',
  'DATEDIF',
  'DAYS',
  'NETWORKDAYS',
  'WORKDAY',
  'YEARFRAC',
] as const

export type FunctionName = (typeof FUNCTIONS)[number]

const FUNCTION_SET: ReadonlySet<string> = new Set(FUNCTIONS)

export function isWhitelisted(name: string): name is FunctionName {
  return FUNCTION_SET.has(name.toUpperCase())
}

function fn(name: FunctionName, args: readonly ExprInput[]): FnExpr {
  return { k: 'fn', name, args: args.map(lift) }
}

function binary(op: BinaryOp, l: ExprInput, r: ExprInput): OpExpr {
  return { k: 'op', op, l: lift(l), r: lift(r) }
}

export const add = (l: ExprInput, r: ExprInput): OpExpr => binary('+', l, r)
export const sub = (l: ExprInput, r: ExprInput): OpExpr => binary('-', l, r)
export const mul = (l: ExprInput, r: ExprInput): OpExpr => binary('*', l, r)
export const div = (l: ExprInput, r: ExprInput): OpExpr => binary('/', l, r)
export const pow = (l: ExprInput, r: ExprInput): OpExpr => binary('^', l, r)
export const concat = (l: ExprInput, r: ExprInput): OpExpr => binary('&', l, r)
export const eq = (l: ExprInput, r: ExprInput): OpExpr => binary('=', l, r)
export const lt = (l: ExprInput, r: ExprInput): OpExpr => binary('<', l, r)
export const gt = (l: ExprInput, r: ExprInput): OpExpr => binary('>', l, r)
export const lte = (l: ExprInput, r: ExprInput): OpExpr => binary('<=', l, r)
export const gte = (l: ExprInput, r: ExprInput): OpExpr => binary('>=', l, r)
export const neq = (l: ExprInput, r: ExprInput): OpExpr => binary('<>', l, r)

export const neg = (e: ExprInput): NegExpr => ({ k: 'neg', e: lift(e) })

export const sum = (...args: ExprInput[]): FnExpr => fn('SUM', args)
export const avg = (...args: ExprInput[]): FnExpr => fn('AVERAGE', args)
export const count = (...args: ExprInput[]): FnExpr => fn('COUNT', args)
export const min = (...args: ExprInput[]): FnExpr => fn('MIN', args)
export const max = (...args: ExprInput[]): FnExpr => fn('MAX', args)
export const round = (value: ExprInput, digits: ExprInput = 0): FnExpr =>
  fn('ROUND', [value, digits])
export const abs = (value: ExprInput): FnExpr => fn('ABS', [value])
export const if_ = (test: ExprInput, then: ExprInput, otherwise: ExprInput): FnExpr =>
  fn('IF', [test, then, otherwise])
export const iferror = (value: ExprInput, fallback: ExprInput): FnExpr =>
  fn('IFERROR', [value, fallback])
export const ifna = (value: ExprInput, fallback: ExprInput): FnExpr => fn('IFNA', [value, fallback])
export const npv = (rate: ExprInput, ...values: ExprInput[]): FnExpr => fn('NPV', [rate, ...values])
export const irr = (values: ExprInput, guess?: ExprInput): FnExpr =>
  fn('IRR', guess === undefined ? [values] : [values, guess])
export const sumproduct = (...args: ExprInput[]): FnExpr => fn('SUMPRODUCT', args)

export const large = (range: ExprInput, k: ExprInput): FnExpr => fn('LARGE', [range, k])
export const small = (range: ExprInput, k: ExprInput): FnExpr => fn('SMALL', [range, k])
export const index = (range: ExprInput, position: ExprInput): FnExpr =>
  fn('INDEX', [range, position])
export const match = (value: ExprInput, range: ExprInput, kind: ExprInput = 0): FnExpr =>
  fn('MATCH', [value, range, kind])
/**
 * The criteria argument is a small expression language of its own — `">100"`,
 * `"<>done"`, `"apple"`. It is passed through as written, since inventing a
 * builder for it would mean re-implementing a syntax Excel already defines and
 * every spreadsheet user already knows.
 */
export const sumif = (range: ExprInput, criteria: ExprInput, sumRange?: ExprInput): FnExpr =>
  fn('SUMIF', sumRange === undefined ? [range, criteria] : [range, criteria, sumRange])
export const countif = (range: ExprInput, criteria: ExprInput): FnExpr =>
  fn('COUNTIF', [range, criteria])
export const averageif = (range: ExprInput, criteria: ExprInput, avgRange?: ExprInput): FnExpr =>
  fn('AVERAGEIF', avgRange === undefined ? [range, criteria] : [range, criteria, avgRange])

// --- text -------------------------------------------------------------------
export const len = (text: ExprInput): FnExpr => fn('LEN', [text])
export const left = (text: ExprInput, count: ExprInput = 1): FnExpr => fn('LEFT', [text, count])
export const right = (text: ExprInput, count: ExprInput = 1): FnExpr => fn('RIGHT', [text, count])
export const mid = (text: ExprInput, start: ExprInput, count: ExprInput): FnExpr =>
  fn('MID', [text, start, count])
export const trim = (text: ExprInput): FnExpr => fn('TRIM', [text])
export const upper = (text: ExprInput): FnExpr => fn('UPPER', [text])
export const lower = (text: ExprInput): FnExpr => fn('LOWER', [text])
export const proper = (text: ExprInput): FnExpr => fn('PROPER', [text])
export const substitute = (text: ExprInput, find: ExprInput, replace: ExprInput): FnExpr =>
  fn('SUBSTITUTE', [text, find, replace])
export const find = (needle: ExprInput, haystack: ExprInput, start?: ExprInput): FnExpr =>
  fn('FIND', start === undefined ? [needle, haystack] : [needle, haystack, start])
export const search = (needle: ExprInput, haystack: ExprInput, start?: ExprInput): FnExpr =>
  fn('SEARCH', start === undefined ? [needle, haystack] : [needle, haystack, start])
/**
 * Formats a number *inside* a formula, which is not the same as a cell's number
 * format: the result is text. Use a column `format` when the cell should stay a
 * number the reader can compute with.
 */
export const text = (value: ExprInput, format: ExprInput): FnExpr => fn('TEXT', [value, format])
export const value = (text: ExprInput): FnExpr => fn('VALUE', [text])
export const rept = (t: ExprInput, times: ExprInput): FnExpr => fn('REPT', [t, times])
export const textjoin = (
  delimiter: ExprInput,
  ignoreEmpty: ExprInput,
  ...parts: ExprInput[]
): FnExpr => fn('TEXTJOIN', [delimiter, ignoreEmpty, ...parts])

// --- dates ------------------------------------------------------------------
export const date = (year: ExprInput, month: ExprInput, day: ExprInput): FnExpr =>
  fn('DATE', [year, month, day])
export const today = (): FnExpr => fn('TODAY', [])
export const year = (serial: ExprInput): FnExpr => fn('YEAR', [serial])
export const month = (serial: ExprInput): FnExpr => fn('MONTH', [serial])
export const day = (serial: ExprInput): FnExpr => fn('DAY', [serial])
export const weekday = (serial: ExprInput, kind: ExprInput = 1): FnExpr =>
  fn('WEEKDAY', [serial, kind])
export const eomonth = (start: ExprInput, months: ExprInput = 0): FnExpr =>
  fn('EOMONTH', [start, months])
export const edate = (start: ExprInput, months: ExprInput): FnExpr => fn('EDATE', [start, months])
export const days = (end: ExprInput, start: ExprInput): FnExpr => fn('DAYS', [end, start])
export const networkdays = (start: ExprInput, end: ExprInput, holidays?: ExprInput): FnExpr =>
  fn('NETWORKDAYS', holidays === undefined ? [start, end] : [start, end, holidays])
export const workday = (start: ExprInput, days: ExprInput, holidays?: ExprInput): FnExpr =>
  fn('WORKDAY', holidays === undefined ? [start, days] : [start, days, holidays])
export const yearfrac = (start: ExprInput, end: ExprInput, basis: ExprInput = 0): FnExpr =>
  fn('YEARFRAC', [start, end, basis])

export interface RawTemplateExpr {
  k: 'rawTemplate'
  strings: readonly string[]
  /**
   * Lifted to expressions, not stored as bare Refs. `r.cell('x')` already
   * returns a RefExpr, so the natural interpolation is an expression — an
   * earlier version typed it as `Ref | Expr` and implemented only `Ref`, which
   * made the commonest form crash inside the writer.
   */
  parts: Expr[]
}

/**
 * Escape hatch for formulas outside the whitelist. Exports verbatim; the viewer
 * shows #NOT_EVALUATED for it rather than guessing a value.
 *
 * Also usable as a tagged template, which is the form to prefer. A plain string
 * can only contain hand-written addresses — and this framework's one rule is
 * that you never write one, so the escape hatch should not be the thing that
 * forces you to. Interpolated references resolve after layout like any other,
 * so the formula survives an inserted row:
 *
 * ```ts
 * raw`=LARGE(${ref('costs').column('delta')}, 1)`
 * ```
 */
export function raw(src: string): RawExpr
export function raw(strings: TemplateStringsArray, ...values: ExprInput[]): RawTemplateExpr
export function raw(
  src: string | TemplateStringsArray,
  ...values: ExprInput[]
): RawExpr | RawTemplateExpr {
  if (typeof src === 'string') return { k: 'raw', src: src.replace(/^=/, '') }

  const strings = [...src]
  if (strings.length > 0) strings[0] = (strings[0] as string).replace(/^\s*=/, '')

  return {
    k: 'rawTemplate',
    strings,
    parts: values.map((value, i) => {
      if (value === undefined || value === null) {
        throw new TypeError(
          `raw\`…\` interpolation ${i + 1} is ${String(value)}. Interpolate a reference ` +
            "(ref('block').column('key')), a row cell (r.cell('key')), an expression, or a literal.",
        )
      }
      return lift(value)
    }),
  }
}
