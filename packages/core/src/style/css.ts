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
 */
export function formatValue(value: unknown, format: string | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value !== 'number') return String(value)

  const code = numberFormat(format)
  if (!code || code === 'General') return trimNumber(value)

  if (code.includes('%')) {
    const decimals = decimalsIn(code)
    return `${(value * 100).toFixed(decimals)}%`
  }
  if (code.includes(',,')) return `${group((value / 1_000_000).toFixed(decimalsIn(code)))}M`
  if (code.includes(',"K"') || code.includes(',”K”')) {
    return `${group((value / 1_000).toFixed(decimalsIn(code)))}K`
  }
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
