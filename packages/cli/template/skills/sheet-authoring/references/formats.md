# Formats, styles, and themes

## Number formats

Set `format` on a column, a `<Cell>`, or a KPI item. Named formats resolve to
Excel codes and are interpreted identically by the HTML renderer:

| Name | Code | Renders |
| --- | --- | --- |
| `number` | `#,##0` | `12,400,000` |
| `decimal` | `#,##0.00` | `1,234.50` |
| `currency` | `#,##0` | `12,400,000` |
| `currency2` | `#,##0.00` | |
| `accounting` | `_(* #,##0_);…` | negatives in parentheses |
| `percent` | `0.0%` | `60.3%` |
| `percent0` / `percent2` | `0%` / `0.00%` | |
| `thousands` | `#,##0,"K"` | `12,400K` |
| `millions` | `#,##0,,"M"` | `12M` |
| `date` | `yyyy-mm-dd` | |
| `text` | `@` | forces text |

Any other string is passed through as a literal Excel format code.

**A ratio without a format reads as noise.** `0.6029159519725558` in a report is
a defect. Put `format: 'percent'` on it.

## What each output does with a format

| Output | Formats applied? |
| --- | --- |
| viewer, `.html`, `.pdf` | yes — rendered as Excel would |
| `.xlsx` | yes — the code is written and Excel applies it |
| `.csv` | **no** — raw values at full precision |

CSV is data, not presentation. A `percent` column exports as
`0.5352386237513873`, not `53.5%`, because something downstream is going to do
arithmetic on it and a rounded string would be the wrong thing to hand over.

## Styles

Cells carry a style key resolved against the active theme. The compiler assigns
sensible ones (`tableHeader`, `tableTotal`, `kpiLabel`, `kpiValue`, `kvLabel`,
`kvValue`, `note`, `tableTitle`); override with `style` on a column or `<Cell>`.

Every style is one `CellStyle` — font, fill, alignment, borders, number format —
translated to CSS for the viewer and HTML, and to Excel formatting for the xlsx.
Define it once; you never write it twice.

## Data bars

```tsx
col('revenue', { header: 'Revenue', format: 'currency', bar: true })
col('variance', { bar: { color: '#16a34a' } })
```

Emits a **native** Excel `dataBar` rule over the column's data range, so it
rescales when the numbers change, and the same rule renders as a gradient in
HTML. Use it where a reader is comparing magnitudes down a column.

## Themes

`themes/<id>.md` is a house style — palette, type scale, and paste-ready
components — with an optional `<id>.demo.tsx` the gallery previews. Link a
workbook to one with `meta.theme`.

A theme that omits a style key falls back to the default for that key, so a
half-written theme degrades to plain rather than to nothing.

## Writing for the Design panel

Keep `design` a plain object literal. The panel parses and rewrites it through an
AST edit; a spread, a computed key, or a value imported from elsewhere makes the
workbook untweakable.
