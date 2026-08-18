import { type ResolveContext, refToA1 } from '../refs/resolve.js'
import { type BinaryOp, type Expr, type ExprInput, lift } from './expr.js'

const PRECEDENCE: Record<BinaryOp, number> = {
  '^': 5,
  '*': 4,
  '/': 4,
  '+': 3,
  '-': 3,
  '&': 2,
  '=': 1,
  '<': 1,
  '>': 1,
  '<=': 1,
  '>=': 1,
  '<>': 1,
}

const NEG_PRECEDENCE = 6
const ATOM = 100

function precedenceOf(expr: Expr): number {
  if (expr.k === 'op') return PRECEDENCE[expr.op]
  if (expr.k === 'neg') return NEG_PRECEDENCE
  if (expr.k === 'raw') return 0
  return ATOM
}

function literal(value: string | number | boolean): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError(`cannot serialize ${value} into a formula`)
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return `"${value.replace(/"/g, '""')}"`
}

export function serialize(input: ExprInput, context: ResolveContext): string {
  const expr = lift(input)
  switch (expr.k) {
    case 'lit':
      return literal(expr.v)
    case 'ref':
      return refToA1(expr.target, context)
    case 'raw':
      return expr.src
    case 'neg': {
      const inner = serialize(expr.e, context)
      return precedenceOf(expr.e) < NEG_PRECEDENCE ? `-(${inner})` : `-${inner}`
    }
    case 'fn':
      return `${expr.name}(${expr.args.map((arg) => serialize(arg, context)).join(',')})`
    case 'op': {
      const self = PRECEDENCE[expr.op]
      const left = wrap(expr.l, context, self, 'left')
      const right = wrap(expr.r, context, self, 'right')
      return `${left}${expr.op}${right}`
    }
  }
}

function wrap(
  child: Expr,
  context: ResolveContext,
  parent: number,
  side: 'left' | 'right',
): string {
  const text = serialize(child, context)
  const own = precedenceOf(child)
  if (own > parent) return text
  if (own < parent) return `(${text})`
  return side === 'right' ? `(${text})` : text
}

export function toFormula(input: ExprInput, context: ResolveContext): string {
  return `=${serialize(input, context)}`
}
