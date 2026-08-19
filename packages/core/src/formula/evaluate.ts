import type { CompiledWorkbook } from '../compile/emit.js'
import { fromA1 } from '../model/a1.js'
import { type Cell, cellKey } from '../model/cell.js'
import { type ResolveContext, resolveRef } from '../refs/resolve.js'
import type { BinaryOp, Expr } from './expr.js'
import { lookup } from './functions.js'
import {
  type Computed,
  DIV0,
  errorFrom,
  isExcelError,
  isNotEvaluated,
  NOT_EVALUATED,
  NUM,
  VALUE,
} from './value.js'

export type ValueMap = Map<string, Computed>

function key(sheet: string, r: number, c: number): string {
  return `${sheet}!${cellKey(r, c)}`
}

interface Node {
  sheet: string
  r: number
  c: number
  cell: Cell
}

export class CycleError extends Error {
  readonly cells: string[]
  constructor(cells: string[]) {
    super(
      `circular reference between ${cells.join(' → ')}. ` +
        'Break the cycle in the source that produced these cells.',
    )
    this.name = 'CycleError'
    this.cells = cells
  }
}

export function evaluateWorkbook(book: CompiledWorkbook): ValueMap {
  const nodes = new Map<string, Node>()
  for (const sheet of book.sheets) {
    for (const [cellRef, cell] of sheet.cells) {
      const comma = cellRef.indexOf(',')
      const r = Number(cellRef.slice(0, comma))
      const c = Number(cellRef.slice(comma + 1))
      nodes.set(key(sheet.name, r, c), { sheet: sheet.name, r, c, cell })
    }
  }

  const values: ValueMap = new Map()
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  const contextFor = (sheet: string): ResolveContext => ({
    registry: book.registry,
    definedNames: book.definedNames,
    sheet,
  })

  function visit(id: string): Computed {
    const existing = values.get(id)
    if (state.get(id) === 'done') return existing ?? null

    if (state.get(id) === 'visiting') {
      const from = stack.indexOf(id)
      throw new CycleError([...stack.slice(from), id])
    }

    const node = nodes.get(id)
    if (!node) return null

    if (!node.cell.expr) {
      const literal = node.cell.value ?? null
      values.set(id, literal)
      state.set(id, 'done')
      return literal
    }

    state.set(id, 'visiting')
    stack.push(id)
    let result: Computed
    try {
      result = evaluateExpr(node.cell.expr, contextFor(node.sheet), read)
    } finally {
      stack.pop()
    }
    values.set(id, result)
    state.set(id, 'done')
    return result
  }

  function read(sheet: string, r: number, c: number): Computed {
    return visit(key(sheet, r, c))
  }

  for (const id of nodes.keys()) visit(id)
  return values
}

type Reader = (sheet: string, r: number, c: number) => Computed

export function evaluateExpr(expr: Expr, context: ResolveContext, read: Reader): Computed {
  switch (expr.k) {
    case 'lit':
      return expr.v
    case 'raw':
      return NOT_EVALUATED
    case 'addr': {
      const values = readAddr(expr.ref, context, read)
      if (values.length === 1) return values[0] as Computed
      return VALUE
    }
    case 'ref': {
      const values = readRef(expr, context, read)
      if (values.length === 1) return values[0] as Computed
      return VALUE
    }
    case 'neg': {
      const inner = evaluateExpr(expr.e, context, read)
      if (isNotEvaluated(inner) || isExcelError(inner)) return inner
      const n = toNumber(inner)
      return typeof n === 'number' ? -n : n
    }
    case 'op':
      return applyOp(
        expr.op,
        evaluateExpr(expr.l, context, read),
        evaluateExpr(expr.r, context, read),
      )
    case 'fn':
      return applyFn(expr, context, read)
  }
}

/** Literal addresses from a parsed formula string, read against the current sheet. */
function readAddr(reference: string, context: ResolveContext, read: Reader): Computed[] {
  const [start, end] = reference.split(':')
  const a = fromA1(start as string)
  const b = end ? fromA1(end) : a
  const out: Computed[] = []
  for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r += 1) {
    for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c += 1) {
      out.push(read(context.sheet, r, c))
    }
  }
  return out
}

function readRef(expr: Expr & { k: 'ref' }, context: ResolveContext, read: Reader): Computed[] {
  const resolved = resolveRef(expr.target, context)
  const out: Computed[] = []
  for (let r = resolved.rect.r; r < resolved.rect.r + resolved.rect.rows; r += 1) {
    for (let c = resolved.rect.c; c < resolved.rect.c + resolved.rect.cols; c += 1) {
      out.push(read(resolved.sheet, r, c))
    }
  }
  return out
}

function toNumber(value: Computed): number | Computed {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? VALUE : n
  }
  return value
}

function toText(value: Computed): string | Computed {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return value
}

function applyOp(op: BinaryOp, left: Computed, right: Computed): Computed {
  if (isNotEvaluated(left) || isNotEvaluated(right)) return NOT_EVALUATED
  if (isExcelError(left)) return left
  if (isExcelError(right)) return right

  if (op === '&') {
    const l = toText(left)
    const r = toText(right)
    if (typeof l !== 'string') return l
    if (typeof r !== 'string') return r
    return l + r
  }

  if (op === '=' || op === '<>') {
    const equal = normalizeForCompare(left) === normalizeForCompare(right)
    return op === '=' ? equal : !equal
  }

  const l = toNumber(left)
  const r = toNumber(right)
  if (typeof l !== 'number') return l
  if (typeof r !== 'number') return r

  switch (op) {
    case '+':
      return l + r
    case '-':
      return l - r
    case '*':
      return l * r
    case '/':
      return r === 0 ? DIV0 : l / r
    case '^': {
      const result = l ** r
      return Number.isFinite(result) ? result : NUM
    }
    case '<':
      return l < r
    case '>':
      return l > r
    case '<=':
      return l <= r
    case '>=':
      return l >= r
  }
}

function normalizeForCompare(value: Computed): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.toLowerCase()
  return value as string | number | boolean
}

function applyFn(expr: Expr & { k: 'fn' }, context: ResolveContext, read: Reader): Computed {
  const implementation = lookup(expr.name)
  if (!implementation) return NOT_EVALUATED

  const args: unknown[] = []
  for (const arg of expr.args) {
    if (arg.k === 'ref' || arg.k === 'addr') {
      const values =
        arg.k === 'ref' ? readRef(arg, context, read) : readAddr(arg.ref, context, read)
      for (const value of values) {
        if (isNotEvaluated(value)) return NOT_EVALUATED
        if (isExcelError(value)) return value
      }
      args.push(values.length === 1 ? values[0] : values)
      continue
    }
    const value = evaluateExpr(arg, context, read)
    if (isNotEvaluated(value)) return NOT_EVALUATED
    if (isExcelError(value)) return value
    args.push(value)
  }

  const result = implementation(...args)
  return fromLibrary(result)
}

function fromLibrary(result: unknown): Computed {
  if (result === null || result === undefined) return null
  if (typeof result === 'number') return Number.isFinite(result) ? result : NUM
  if (typeof result === 'string') {
    return result.startsWith('#') ? errorFrom(result) : result
  }
  if (typeof result === 'boolean') return result
  if (result instanceof Error) return errorFrom(`#${result.name}`)
  return VALUE
}
