export type HorizontalAlign = 'left' | 'center' | 'right'
export type VerticalAlign = 'top' | 'middle' | 'bottom'
export type BorderWeight = 'hair' | 'thin' | 'medium'

export interface BorderSide {
  weight: BorderWeight
  color?: string
}

export interface Borders {
  top?: BorderSide
  bottom?: BorderSide
  left?: BorderSide
  right?: BorderSide
}

/**
 * One style model, two adapters. Everything visual is expressed here and then
 * translated — never authored twice. If a property cannot be expressed in both
 * Excel and CSS, it does not belong in this type.
 */
export interface CellStyle {
  font?: {
    family?: string
    size?: number
    bold?: boolean
    italic?: boolean
    color?: string
  }
  fill?: string
  align?: {
    horizontal?: HorizontalAlign
    vertical?: VerticalAlign
    wrap?: boolean
    indent?: number
  }
  border?: Borders
  format?: string
}

export type StyleKey = string

export interface Theme {
  name: string
  palette: Record<string, string>
  defaultColumnWidth: number
  rowHeight?: number
  styles: Record<StyleKey, CellStyle>
}

export function mergeStyle(base: CellStyle | undefined, over: CellStyle | undefined): CellStyle {
  if (!base) return over ?? {}
  if (!over) return base
  return {
    font: { ...base.font, ...over.font },
    fill: over.fill ?? base.fill,
    align: { ...base.align, ...over.align },
    border: { ...base.border, ...over.border },
    format: over.format ?? base.format,
  }
}
