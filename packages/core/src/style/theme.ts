import type { CellStyle, Theme } from './types.js'

const INK = '#0f172a'
const MUTED = '#64748b'
const RULE = '#cbd5e1'
const BAND = '#f8fafc'
const ACCENT = '#1d4ed8'

const body: CellStyle = {
  font: { family: 'Calibri', size: 11, color: INK },
}

/**
 * The style keys the compiler emits. A theme that omits one falls back to this
 * table, so a half-written theme degrades to plain rather than to nothing.
 */
export const DEFAULT_THEME: Theme = {
  name: 'default',
  palette: { ink: INK, muted: MUTED, rule: RULE, band: BAND, accent: ACCENT },
  defaultColumnWidth: 12,
  styles: {
    body,
    tableTitle: {
      font: { family: 'Calibri', size: 13, bold: true, color: INK },
      align: { vertical: 'middle' },
    },
    tableHeader: {
      font: { family: 'Calibri', size: 11, bold: true, color: '#ffffff' },
      fill: INK,
      align: { horizontal: 'left', vertical: 'middle', wrap: true },
      border: { bottom: { weight: 'thin', color: INK } },
    },
    tableTotal: {
      font: { family: 'Calibri', size: 11, bold: true, color: INK },
      fill: BAND,
      border: { top: { weight: 'thin', color: RULE } },
    },
    kpiLabel: {
      font: { family: 'Calibri', size: 10, color: MUTED },
      align: { horizontal: 'left' },
    },
    kpiValue: {
      font: { family: 'Calibri', size: 16, bold: true, color: ACCENT },
      align: { horizontal: 'left', vertical: 'middle' },
    },
    kvLabel: {
      font: { family: 'Calibri', size: 11, color: MUTED },
    },
    kvValue: {
      font: { family: 'Calibri', size: 11, bold: true, color: INK },
      fill: BAND,
      border: { top: { weight: 'hair', color: RULE }, bottom: { weight: 'hair', color: RULE } },
    },
    note: {
      font: { family: 'Calibri', size: 10, italic: true, color: MUTED },
      align: { wrap: true, vertical: 'top' },
    },
  },
}

export function resolveStyle(theme: Theme, key: string | undefined): CellStyle | undefined {
  if (!key) return theme.styles.body
  return theme.styles[key] ?? DEFAULT_THEME.styles[key] ?? theme.styles.body
}
