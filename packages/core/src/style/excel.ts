import type { BorderSide, CellStyle } from './types.js'

type ExcelBorderStyle = 'hair' | 'thin' | 'medium'

interface ExcelBorderSide {
  style: ExcelBorderStyle
  color?: { argb: string }
}

export interface ExcelStyle {
  font?: {
    name?: string
    size?: number
    bold?: boolean
    italic?: boolean
    color?: { argb: string }
  }
  fill?: {
    type: 'pattern'
    pattern: 'solid'
    fgColor: { argb: string }
  }
  alignment?: {
    horizontal?: 'left' | 'center' | 'right'
    vertical?: 'top' | 'middle' | 'bottom'
    wrapText?: boolean
    indent?: number
  }
  border?: {
    top?: ExcelBorderSide
    bottom?: ExcelBorderSide
    left?: ExcelBorderSide
    right?: ExcelBorderSide
  }
}

/** `#1d4ed8` → `FF1D4ED8`. Excel wants ARGB; CSS gives us RGB. */
export function toArgb(color: string): string {
  const hex = color.replace('#', '').toUpperCase()
  if (hex.length === 3) {
    const [r, g, b] = hex
    return `FF${r}${r}${g}${g}${b}${b}`
  }
  if (hex.length === 6) return `FF${hex}`
  if (hex.length === 8) return hex
  return 'FF000000'
}

function side(border: BorderSide | undefined): ExcelBorderSide | undefined {
  if (!border) return undefined
  const out: ExcelBorderSide = { style: border.weight }
  if (border.color) out.color = { argb: toArgb(border.color) }
  return out
}

export function toExcelStyle(style: CellStyle): ExcelStyle {
  const out: ExcelStyle = {}

  if (style.font) {
    out.font = {}
    if (style.font.family) out.font.name = style.font.family
    if (style.font.size) out.font.size = style.font.size
    if (style.font.bold) out.font.bold = true
    if (style.font.italic) out.font.italic = true
    if (style.font.color) out.font.color = { argb: toArgb(style.font.color) }
  }

  if (style.fill) {
    out.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(style.fill) } }
  }

  if (style.align) {
    out.alignment = {}
    if (style.align.horizontal) out.alignment.horizontal = style.align.horizontal
    if (style.align.vertical) out.alignment.vertical = style.align.vertical
    if (style.align.wrap) out.alignment.wrapText = true
    if (style.align.indent) out.alignment.indent = style.align.indent
  }

  if (style.border) {
    const top = side(style.border.top)
    const bottom = side(style.border.bottom)
    const left = side(style.border.left)
    const right = side(style.border.right)
    if (top || bottom || left || right) {
      out.border = {}
      if (top) out.border.top = top
      if (bottom) out.border.bottom = bottom
      if (left) out.border.left = left
      if (right) out.border.right = right
    }
  }

  return out
}
