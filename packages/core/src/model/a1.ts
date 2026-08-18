import type { Addr, Rect } from './geometry.js'
import { MAX_COLS, MAX_ROWS } from './geometry.js'

const LETTERS = 26

export function columnName(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_COLS) {
    throw new RangeError(`column index out of range: ${index}`)
  }
  let n = index
  let name = ''
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % LETTERS)) + name
    n = Math.floor(n / LETTERS) - 1
  }
  return name
}

export function columnIndex(name: string): number {
  const upper = name.toUpperCase()
  if (!/^[A-Z]+$/.test(upper)) throw new SyntaxError(`not a column name: ${name}`)
  let index = 0
  for (const ch of upper) index = index * LETTERS + (ch.charCodeAt(0) - 64)
  return index - 1
}

export interface A1Options {
  absoluteRow?: boolean
  absoluteCol?: boolean
}

export function toA1(addr: Addr, options: A1Options = {}): string {
  if (!Number.isInteger(addr.r) || addr.r < 0 || addr.r >= MAX_ROWS) {
    throw new RangeError(`row index out of range: ${addr.r}`)
  }
  const col = `${options.absoluteCol ? '$' : ''}${columnName(addr.c)}`
  const row = `${options.absoluteRow ? '$' : ''}${addr.r + 1}`
  return col + row
}

const A1_PATTERN = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/

export function fromA1(a1: string): Addr {
  const match = A1_PATTERN.exec(a1.trim())
  if (!match) throw new SyntaxError(`not an A1 address: ${a1}`)
  return { r: Number(match[4]) - 1, c: columnIndex(match[2] as string) }
}

export function rangeToA1(rect: Rect, options: A1Options = {}): string {
  if (rect.rows <= 0 || rect.cols <= 0) {
    throw new RangeError(`empty range: ${rect.rows}x${rect.cols}`)
  }
  const start = toA1({ r: rect.r, c: rect.c }, options)
  if (rect.rows === 1 && rect.cols === 1) return start
  const end = toA1({ r: rect.r + rect.rows - 1, c: rect.c + rect.cols - 1 }, options)
  return `${start}:${end}`
}

const SAFE_SHEET_NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/

export function quoteSheetName(name: string): string {
  if (SAFE_SHEET_NAME.test(name)) return name
  return `'${name.replace(/'/g, "''")}'`
}

export function qualify(sheet: string | undefined, reference: string): string {
  return sheet ? `${quoteSheetName(sheet)}!${reference}` : reference
}
