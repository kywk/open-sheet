---
name: corporate-neutral
description: Near-white, one blue accent, sans throughout. Safe for print and for Excel.
---

# Corporate neutral

The default house style: quiet enough that the numbers carry the page, and
legible after someone prints it in black and white.

## Palette

| Token | Value | Used for |
| --- | --- | --- |
| `ink` | `#0f172a` | body text, table header fill |
| `accent` | `#1d4ed8` | KPI values, data bars |
| `band` | `#f8fafc` | total rows, key-value fills |
| `rule` | `#cbd5e1` | hairlines |
| `muted` | `#64748b` | labels, notes |

One accent. A second competes with it; a third is decoration.

## Formats

| Kind | Format | Why |
| --- | --- | --- |
| Money | `currency` (`#,##0`) | decimals on a five-figure number are noise |
| Unit prices | `currency2` | where the cents genuinely matter |
| Ratios | `percent` (`0.0%`) | one decimal reads; three does not |
| Counts | `number` | thousands separators, no decimals |
| Dates | `date` (`yyyy-mm-dd`) | sorts correctly everywhere |

## Column widths

Labels 20–26 · descriptions 26 · figures 13–15 · short codes 6–11.

## Paste-ready design const

```tsx
export const design: DesignSystem = {
  palette: { accent: '#1d4ed8', header: '#0f172a', band: '#f8fafc' },
  formats: { currency: '#,##0', percent: '0.0%' },
}
```

Keep it a plain object literal — the Design panel rewrites it in place.

## Conventions

- Assumptions live on their own sheet as a `kind="keyValue"` table, always.
- A KPI band sits at the top of the sheet a reader opens first, five items at most.
- A data bar goes on the one column a reader scans for magnitude — not on every
  numeric column, or it stops meaning anything.
- Freeze at `B2` so headers and the first label column stay put.
