import { numberFormat } from '../export/formats.js'
import { DEFAULT_THEME } from './theme.js'
import { type CellStyle, mergeStyle, type Theme } from './types.js'

export interface DesignSystem {
  palette?: Record<string, string>
  fonts?: Record<string, string>
  formats?: Record<string, string>
  /** Base body size in points; headings scale from it. */
  fontSize?: number
}

/** The keys the panel offers, in the order it shows them. */
export const DESIGN_TOKENS = [
  { group: 'palette', key: 'accent', label: 'Accent', kind: 'color' },
  { group: 'palette', key: 'header', label: 'Header fill', kind: 'color' },
  { group: 'palette', key: 'band', label: 'Band', kind: 'color' },
  { group: 'palette', key: 'rule', label: 'Rules', kind: 'color' },
  { group: 'fonts', key: 'body', label: 'Font', kind: 'font' },
  { group: 'formats', key: 'currency', label: 'Currency', kind: 'format' },
  { group: 'formats', key: 'percent', label: 'Percent', kind: 'format' },
] as const

/**
 * A workbook's `design` const is a small set of levers over the theme, not a
 * second theme system. Anything it does not mention falls through to the theme,
 * so a two-line design block is valid and behaves.
 */
export function applyDesign(theme: Theme, design: DesignSystem | undefined): Theme {
  if (!design) return theme

  const palette = { ...theme.palette, ...design.palette }
  const accent = design.palette?.accent ?? theme.palette.accent
  const header = design.palette?.header ?? theme.palette.ink
  const band = design.palette?.band ?? theme.palette.band
  const rule = design.palette?.rule ?? theme.palette.rule
  const family = design.fonts?.body
  const size = design.fontSize

  const restyle = (base: CellStyle | undefined, over: CellStyle): CellStyle => {
    const merged = mergeStyle(base, over)
    if (family || size) {
      merged.font = {
        ...merged.font,
        ...(family ? { family } : {}),
        ...(size && merged.font?.size ? { size: scale(merged.font.size, theme, size) } : {}),
      }
    }
    return merged
  }

  const styles: Record<string, CellStyle> = {}
  for (const [key, style] of Object.entries(theme.styles)) {
    styles[key] = restyle(style, {})
  }

  styles.tableHeader = restyle(styles.tableHeader, { fill: header })
  styles.tableTotal = restyle(styles.tableTotal, {
    fill: band,
    border: { top: { weight: 'thin', color: rule } },
  })
  styles.kpiValue = restyle(styles.kpiValue, { font: { color: accent } })
  styles.kvValue = restyle(styles.kvValue, {
    fill: band,
    border: { top: { weight: 'hair', color: rule }, bottom: { weight: 'hair', color: rule } },
  })

  return { ...theme, palette, styles }
}

function scale(current: number, theme: Theme, base: number): number {
  const themeBase = theme.styles.body?.font?.size ?? 11
  return Math.max(6, Math.round((current / themeBase) * base))
}

/** Formats named in `design.formats` override the built-in codes. */
export function designFormat(
  design: DesignSystem | undefined,
  format: string | undefined,
): string | undefined {
  if (!format) return undefined
  const override = design?.formats?.[format]
  return override ?? numberFormat(format)
}

export function themeFor(design: DesignSystem | undefined, base: Theme = DEFAULT_THEME): Theme {
  return applyDesign(base, design)
}
