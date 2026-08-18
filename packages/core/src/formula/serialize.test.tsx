import { describe, expect, it } from 'vitest'
import { compile } from '../compile/compile.js'
import { budget } from '../compile/fixtures.js'
import { ref } from '../refs/ref.js'
import type { ResolveContext } from '../refs/resolve.js'
import { add, div, mul, neg, raw, sub, sum } from './expr.js'
import { toFormula } from './serialize.js'

function contextFor(sheet: string): ResolveContext {
  const book = compile(budget())
  return { registry: book.registry, definedNames: book.definedNames, sheet }
}

describe('serialize', () => {
  const pl = () => contextFor('P&L')

  it('writes a column range the author never addressed', () => {
    expect(toFormula(sum(ref('pl').column('revenue')), pl())).toBe('=SUM(B5:B8)')
  })

  it('writes a same-row difference', () => {
    expect(toFormula(sub(ref('pl').cell('revenue', 2), ref('pl').cell('cogs', 2)), pl())).toBe(
      '=B7-C7',
    )
  })

  it('writes the total cell', () => {
    expect(toFormula(ref('pl').total('revenue'), pl())).toBe('=B9')
  })

  it('prefers a defined name over an address, and qualifies across sheets', () => {
    expect(
      toFormula(mul(ref('pl').cell('revenue', 0), ref('assumptions').get('growth')), pl()),
    ).toBe('=B5*growth')
  })

  it('qualifies a cross-sheet address when there is no defined name', () => {
    const context = contextFor('Assumptions')
    expect(toFormula(sum(ref('pl').column('revenue')), context)).toBe("=SUM('P&L'!B5:B8)")
  })

  it('omits parentheses it does not need', () => {
    const c = pl()
    const a = ref('pl').cell('revenue', 0)
    const b = ref('pl').cell('cogs', 0)
    expect(toFormula(mul(add(a, b), 2), c)).toBe('=(B5+C5)*2')
    expect(toFormula(add(mul(a, 2), b), c)).toBe('=B5*2+C5')
    expect(toFormula(sub(a, sub(b, 1)), c)).toBe('=B5-(C5-1)')
    expect(toFormula(div(a, mul(b, 2)), c)).toBe('=B5/(C5*2)')
  })

  it('escapes strings and renders booleans Excel-style', () => {
    const c = pl()
    expect(toFormula({ k: 'lit', v: 'say "hi"' }, c)).toBe('="say ""hi"""')
    expect(toFormula({ k: 'lit', v: true }, c)).toBe('=TRUE')
  })

  it('handles unary minus', () => {
    const c = pl()
    expect(toFormula(neg(ref('pl').cell('revenue', 0)), c)).toBe('=-B5')
    expect(toFormula(neg(add(1, 2)), c)).toBe('=-(1+2)')
  })

  it('passes raw() through verbatim', () => {
    expect(toFormula(raw('=XIRR(A1:A9,B1:B9)'), pl())).toBe('=XIRR(A1:A9,B1:B9)')
  })

  it('serializes every formula the demo workbook produced', () => {
    const book = compile(budget())
    const context: ResolveContext = {
      registry: book.registry,
      definedNames: book.definedNames,
      sheet: 'P&L',
    }
    const formulas = [...(book.sheets[1]?.cells.values() ?? [])]
      .filter((cell) => cell.expr)
      .map((cell) => toFormula(cell.expr as never, context))
    expect(formulas).toContain('=B6-C6')
    expect(formulas).toContain('=B6/B5-1')
    expect(formulas).toContain('=SUM(B5:B8)')
    expect(formulas.every((f) => f.startsWith('='))).toBe(true)
  })
})

describe('resolution errors name what the author can act on', () => {
  it('rejects r.prev() on the first row', () => {
    expect(() => toFormula(ref('pl').cell('revenue', -1), contextFor('P&L'))).toThrow(
      /must guard with r\.isFirst/,
    )
  })

  it('suggests the column the author meant', () => {
    expect(() => toFormula(sum(ref('pl').column('revenu')), contextFor('P&L'))).toThrow(
      /did you mean "revenue"/,
    )
  })

  it('suggests the block the author meant', () => {
    expect(() => toFormula(sum(ref('pnl').column('revenue')), contextFor('P&L'))).toThrow(
      /did you mean "pl"/,
    )
  })
})
