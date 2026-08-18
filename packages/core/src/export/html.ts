import type { CompiledSheet, CompiledWorkbook } from '../compile/emit.js'
import { type Computed, display, isExcelError, isNotEvaluated } from '../formula/value.js'
import { columnName } from '../model/a1.js'
import { parseCellKey } from '../model/cell.js'
import { formatValue, toCssText } from '../style/css.js'
import { DEFAULT_THEME, resolveStyle } from '../style/theme.js'
import { mergeStyle, type Theme } from '../style/types.js'

export interface HtmlOptions {
  title?: string
  theme?: Theme
  values?: Map<string, Computed>
  /** Landscape suits wide grids and is the default for print. */
  orientation?: 'portrait' | 'landscape'
  showGridHeaders?: boolean
}

interface Covered {
  master: string
  colspan: number
  rowspan: number
}

export function toHtml(book: CompiledWorkbook, options: HtmlOptions = {}): string {
  const theme = options.theme ?? DEFAULT_THEME
  const sheets = book.sheets.map((sheet) => renderSheet(sheet, theme, options)).join('\n')
  const title = escapeHtml(options.title ?? 'open-sheet')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${stylesheet(theme, options.orientation ?? 'landscape')}</style>
</head>
<body>
<main class="os-workbook">
${sheets}
</main>
</body>
</html>
`
}

function stylesheet(theme: Theme, orientation: 'portrait' | 'landscape'): string {
  const palette = Object.entries(theme.palette)
    .map(([name, value]) => `--os-${name}: ${value};`)
    .join('\n    ')

  return `
  :root {
    ${palette}
    --os-surface: #ffffff;
    --os-hairline: #e2e8f0;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px;
    background: #f1f5f9;
    color: var(--os-ink, #0f172a);
    font-family: Calibri, system-ui, -apple-system, sans-serif;
  }
  .os-workbook { display: flex; flex-direction: column; gap: 32px; max-width: 100%; }
  .os-sheet { background: var(--os-surface); border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
  .os-sheet > h2 {
    margin: 0 0 16px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--os-muted, #64748b);
  }
  /* Wide grids scroll inside the sheet; the page itself never scrolls sideways. */
  .os-scroll { overflow-x: auto; }
  table.os-grid { border-collapse: collapse; font-variant-numeric: tabular-nums; }
  table.os-grid td { padding: 4px 8px; vertical-align: middle; white-space: nowrap; }
  table.os-grid td.os-num { text-align: right; }
  table.os-grid td.os-skip { color: #94a3b8; font-style: italic; }
  table.os-grid td.os-err { color: #b91c1c; }
  .os-head { background: #f8fafc; color: #94a3b8; font-size: 10px; text-align: center; font-weight: 600; }
  @media print {
    body { background: #fff; padding: 0; }
    .os-sheet { box-shadow: none; border-radius: 0; padding: 0; break-after: page; }
    .os-sheet:last-child { break-after: auto; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    @page { size: A4 ${orientation}; margin: 12mm; }
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0b1220; color: #e2e8f0; }
    .os-sheet { background: #111827; box-shadow: none; border: 1px solid #1f2937; }
    .os-head { background: #0b1220; color: #475569; }
  }
`
}

interface BarScale {
  color: string
  max: number
}

/**
 * The HTML twin of Excel's data bars. Excel scales them itself; here the extent
 * has to be computed, so the range's own maximum is measured once per rule.
 */
function barScales(sheet: CompiledSheet, values: HtmlOptions['values']): Map<string, BarScale> {
  const scales = new Map<string, BarScale>()
  for (const format of sheet.conditionalFormats) {
    if (format.kind !== 'dataBar') continue
    let max = 0
    for (let r = format.rect.r; r < format.rect.r + format.rect.rows; r += 1) {
      for (let c = format.rect.c; c < format.rect.c + format.rect.cols; c += 1) {
        const cell = sheet.cells.get(`${r},${c}`)
        const value = cell?.expr ? values?.get(`${sheet.name}!${r},${c}`) : cell?.value
        if (typeof value === 'number') max = Math.max(max, Math.abs(value))
      }
    }
    if (max === 0) continue
    for (let r = format.rect.r; r < format.rect.r + format.rect.rows; r += 1) {
      for (let c = format.rect.c; c < format.rect.c + format.rect.cols; c += 1) {
        scales.set(`${r},${c}`, { color: format.color, max })
      }
    }
  }
  return scales
}

function renderSheet(sheet: CompiledSheet, theme: Theme, options: HtmlOptions): string {
  const covered = coverage(sheet)
  const scales = barScales(sheet, options.values)
  const widths: string[] = []
  for (let c = 0; c < sheet.bounds.cols; c += 1) {
    const width = sheet.columnWidths.get(c) ?? theme.defaultColumnWidth
    widths.push(`<col style="width:${Math.round(width * 8)}px">`)
  }

  const rows: string[] = []
  if (options.showGridHeaders) {
    const heads = [`<td class="os-head"></td>`]
    for (let c = 0; c < sheet.bounds.cols; c += 1) {
      heads.push(`<td class="os-head">${columnName(c)}</td>`)
    }
    rows.push(`<tr>${heads.join('')}</tr>`)
  }

  for (let r = 0; r < sheet.bounds.rows; r += 1) {
    const cells: string[] = []
    if (options.showGridHeaders) cells.push(`<td class="os-head">${r + 1}</td>`)
    for (let c = 0; c < sheet.bounds.cols; c += 1) {
      const key = `${r},${c}`
      const hidden = covered.get(key)
      if (hidden && hidden.master !== key) continue
      cells.push(renderCell(sheet, r, c, theme, options, hidden, scales.get(key)))
    }
    rows.push(`<tr>${cells.join('')}</tr>`)
  }

  return `<section class="os-sheet">
  <h2>${escapeHtml(sheet.name)}</h2>
  <div class="os-scroll"><table class="os-grid"><colgroup>${
    options.showGridHeaders ? '<col style="width:36px">' : ''
  }${widths.join('')}</colgroup><tbody>
${rows.join('\n')}
  </tbody></table></div>
</section>`
}

function renderCell(
  sheet: CompiledSheet,
  r: number,
  c: number,
  theme: Theme,
  options: HtmlOptions,
  span: Covered | undefined,
  scale: BarScale | undefined,
): string {
  const cell = sheet.cells.get(`${r},${c}`)
  const attrs: string[] = []
  if (span && span.colspan > 1) attrs.push(`colspan="${span.colspan}"`)
  if (span && span.rowspan > 1) attrs.push(`rowspan="${span.rowspan}"`)

  if (!cell) return `<td${attrs.length ? ` ${attrs.join(' ')}` : ''}></td>`

  const style = mergeStyle(resolveStyle(theme, undefined), resolveStyle(theme, cell.style))
  const computed = cell.expr ? options.values?.get(`${sheet.name}!${r},${c}`) : (cell.value ?? null)

  let css = toCssText(style)
  if (scale && typeof computed === 'number' && computed !== 0) {
    const pct = Math.min(100, Math.round((Math.abs(computed) / scale.max) * 100))
    css += `${css ? ';' : ''}background-image:linear-gradient(to right, ${scale.color} ${pct}%, transparent ${pct}%)`
  }
  if (css) attrs.push(`style="${css}"`)

  let className = ''
  let text: string
  if (isNotEvaluated(computed)) {
    className = 'os-skip'
    text = '#NOT_EVALUATED'
  } else if (isExcelError(computed)) {
    className = 'os-err'
    text = computed.code
  } else if (computed === undefined) {
    text = cell.expr ? '' : display(cell.value ?? null)
  } else {
    if (typeof computed === 'number') className = 'os-num'
    text = formatValue(computed, cell.format)
  }

  if (className) attrs.push(`class="${className}"`)
  return `<td${attrs.length ? ` ${attrs.join(' ')}` : ''}>${escapeHtml(text)}</td>`
}

function coverage(sheet: CompiledSheet): Map<string, Covered> {
  const covered = new Map<string, Covered>()
  for (const [key, cell] of sheet.cells) {
    if (!cell.span || (cell.span.rows <= 1 && cell.span.cols <= 1)) continue
    const { r, c } = parseCellKey(key)
    for (let dr = 0; dr < cell.span.rows; dr += 1) {
      for (let dc = 0; dc < cell.span.cols; dc += 1) {
        covered.set(`${r + dr},${c + dc}`, {
          master: key,
          colspan: cell.span.cols,
          rowspan: cell.span.rows,
        })
      }
    }
  }
  return covered
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] as string)
}
