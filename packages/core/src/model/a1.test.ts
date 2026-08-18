import { describe, expect, it } from 'vitest'
import { columnIndex, columnName, fromA1, qualify, quoteSheetName, rangeToA1, toA1 } from './a1.js'

describe('column names', () => {
  it('maps the first columns', () => {
    expect(columnName(0)).toBe('A')
    expect(columnName(25)).toBe('Z')
    expect(columnName(26)).toBe('AA')
    expect(columnName(701)).toBe('ZZ')
    expect(columnName(702)).toBe('AAA')
  })

  it('round-trips every index up to four letters', () => {
    for (let i = 0; i < 16384; i += 1) {
      expect(columnIndex(columnName(i))).toBe(i)
    }
  })

  it('rejects out-of-range indices', () => {
    expect(() => columnName(-1)).toThrow(RangeError)
    expect(() => columnName(16384)).toThrow(RangeError)
  })
})

describe('addresses', () => {
  it('formats relative and absolute', () => {
    expect(toA1({ r: 0, c: 0 })).toBe('A1')
    expect(toA1({ r: 3, c: 1 })).toBe('B4')
    expect(toA1({ r: 3, c: 1 }, { absoluteRow: true, absoluteCol: true })).toBe('$B$4')
    expect(toA1({ r: 3, c: 1 }, { absoluteCol: true })).toBe('$B4')
  })

  it('parses back', () => {
    expect(fromA1('B4')).toEqual({ r: 3, c: 1 })
    expect(fromA1('$B$4')).toEqual({ r: 3, c: 1 })
    expect(() => fromA1('nope')).toThrow(SyntaxError)
  })
})

describe('ranges', () => {
  it('collapses a single cell', () => {
    expect(rangeToA1({ r: 1, c: 1, rows: 1, cols: 1 })).toBe('B2')
  })

  it('spans multiple cells', () => {
    expect(rangeToA1({ r: 1, c: 1, rows: 12, cols: 1 })).toBe('B2:B13')
    expect(
      rangeToA1({ r: 1, c: 1, rows: 2, cols: 2 }, { absoluteRow: true, absoluteCol: true }),
    ).toBe('$B$2:$C$3')
  })

  it('rejects empty ranges', () => {
    expect(() => rangeToA1({ r: 0, c: 0, rows: 0, cols: 1 })).toThrow(RangeError)
  })
})

describe('sheet qualification', () => {
  it('leaves simple names bare', () => {
    expect(quoteSheetName('Summary')).toBe('Summary')
    expect(qualify('Summary', 'B4')).toBe('Summary!B4')
  })

  it('quotes names that need it', () => {
    expect(quoteSheetName('P&L')).toBe("'P&L'")
    expect(quoteSheetName('Q1 Actuals')).toBe("'Q1 Actuals'")
    expect(quoteSheetName("Bob's")).toBe("'Bob''s'")
    expect(qualify('P&L', 'B4')).toBe("'P&L'!B4")
  })

  it('omits the qualifier when there is no sheet', () => {
    expect(qualify(undefined, 'B4')).toBe('B4')
  })
})
