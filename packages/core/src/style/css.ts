import { numberFormat } from '../export/formats.js'
import type { BorderSide, CellStyle } from './types.js'

const WEIGHT_PX: Record<BorderSide['weight'], string> = {
  hair: '0.5px',
  thin: '1px',
  medium: '2px',
}

function side(border: BorderSide | undefined): string | undefined {
  if (!border) return undefined
  return `${WEIGHT_PX[border.weight]} solid ${border.color ?? 'currentColor'}`
}

const VERTICAL: Record<string, string> = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }

export function toCssDeclarations(style: CellStyle): Record<string, string> {
  const out: Record<string, string> = {}

  if (style.font?.family) out['font-family'] = `${style.font.family}, system-ui, sans-serif`
  if (style.font?.size) out['font-size'] = `${style.font.size}px`
  if (style.font?.bold) out['font-weight'] = '700'
  if (style.font?.italic) out['font-style'] = 'italic'
  if (style.font?.color) out.color = style.font.color
  if (style.fill) out['background-color'] = style.fill

  if (style.align?.horizontal) out['text-align'] = style.align.horizontal
  if (style.align?.vertical) out['align-items'] = VERTICAL[style.align.vertical] as string
  if (style.align?.wrap) out['white-space'] = 'normal'
  if (style.align?.indent) out['padding-left'] = `${style.align.indent * 8}px`

  const top = side(style.border?.top)
  const bottom = side(style.border?.bottom)
  const left = side(style.border?.left)
  const right = side(style.border?.right)
  if (top) out['border-top'] = top
  if (bottom) out['border-bottom'] = bottom
  if (left) out['border-left'] = left
  if (right) out['border-right'] = right

  return out
}

export function toCssText(style: CellStyle): string {
  return Object.entries(toCssDeclarations(style))
    .map(([property, value]) => `${property}:${value}`)
    .join(';')
}

/**
 * Excel number formats drive both renderers. The HTML side cannot ask Excel to
 * format for it, so the common codes are interpreted here; anything else falls
 * back to the raw value rather than guessing at a format we do not understand.
 *
 * Sections matter more than they look. Excel reads `positive;negative;zero;text`
 * and the accounting format uses all of them — negatives in parentheses, zero as
 * a dash. Ignoring them made the viewer show `-84,500` where Excel showed
 * `(84,500)`: the same cell reading differently in the two places, which is the
 * one thing a "what you see is what exports" tool cannot afford.
 */
export function formatValue(value: unknown, format: string | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value !== 'number') return String(value)

  const full = numberFormat(format)
  if (!full || full === 'General') return trimNumber(value)

  const { code, negated, literal } = section(full, value)
  if (literal !== undefined) return literal
  const magnitude = negated ? Math.abs(value) : value
  const rendered = renderSection(magnitude, code)
  return negated ? `(${rendered})` : rendered
}

interface Section {
  code: string
  /** The negative section is written for a positive number in parentheses. */
  negated: boolean
  /** A section that is nothing but literal text, e.g. the accounting zero dash. */
  literal?: string
}

function section(full: string, value: number): Section {
  const parts = splitSections(full)
  if (parts.length === 1) return { code: clean(parts[0] as string), negated: false }

  const chosen =
    value < 0 ? (parts[1] ?? parts[0]) : value === 0 ? (parts[2] ?? parts[0]) : parts[0]
  const code = clean(chosen as string)

  // A negative section written as `(#,##0)` already carries the sign visually.
  const parenthesised = /^\(.*\)$/.test(code)
  const bare = parenthesised ? code.slice(1, -1) : code

  if (!/[0#]/.test(bare)) {
    const text = bare.replace(/"/g, '').trim()
    return { code: bare, negated: false, literal: text }
  }
  return { code: bare, negated: value < 0 && parenthesised }
}

/** `;` inside quotes is literal text, not a section break. */
function splitSections(code: string): string[] {
  const out: string[] = []
  let current = ''
  let quoted = false
  for (const ch of code) {
    if (ch === '"') quoted = !quoted
    if (ch === ';' && !quoted) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  out.push(current)
  return out
}

/** Strips Excel's alignment padding (`_(`, `* `) which has no HTML equivalent. */
function clean(code: string): string {
  return code.replace(/_./g, '').replace(/\*./g, '').trim()
}

function renderSection(value: number, code: string): string {
  if (code.includes('%')) {
    const decimals = decimalsIn(code)
    return `${(value * 100).toFixed(decimals)}%`
  }
  if (code.includes(',,')) return `${group((value / 1_000_000).toFixed(decimalsIn(code)))}M`
  if (code.includes(',"K"')) return `${group((value / 1_000).toFixed(decimalsIn(code)))}K`
  if (code.includes('#,##0')) return group(value.toFixed(decimalsIn(code)))
  if (code === '@') return String(value)

  return trimNumber(value)
}

function decimalsIn(code: string): number {
  const match = /\.(0+)/.exec(code)
  return match ? (match[1] as string).length : code.includes('%') ? 1 : 0
}

function group(text: string): string {
  const [whole, fraction] = text.split('.')
  const sign = (whole as string).startsWith('-') ? '-' : ''
  const digits = (whole as string).replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return sign + digits + (fraction ? `.${fraction}` : '')
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)))
}

/**
 * React's inline `style` prop takes camelCase keys and silently drops kebab-case
 * ones, so the grid needs its own shape of the same declarations. Keeping this
 * beside the CSS adapter means the two cannot drift.
 */
export function toStyleObject(style: CellStyle): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [property, value] of Object.entries(toCssDeclarations(style))) {
    out[property.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())] = value
  }
  return out
}
