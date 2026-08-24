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
