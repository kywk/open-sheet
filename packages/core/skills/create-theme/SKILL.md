---
name: create-theme
description: Use this skill when the user wants a reusable house style for open-sheet workbooks — "make a theme with our brand colours", "all our spreadsheets should look like this", "create a corporate template". Writes `themes/<id>.md` and an optional demo workbook the gallery previews.
---

# Create a theme

A theme is a house style that workbooks link to with `meta.theme`. It lives as
markdown so it is readable by both people and agents.

## The file

`themes/<id>.md`:

```markdown
---
name: corporate-neutral
description: Near-white, one blue accent, sans throughout.
---

# Corporate neutral

## Palette
| Token | Value | Used for |
| --- | --- | --- |
| ink | #0f172a | body text, table header fill |
| accent | #1d4ed8 | KPI values, data bars |
| band | #f8fafc | total rows, key-value fills |
| rule | #cbd5e1 | hairlines |

## Formats
Currency `#,##0` · Percent `0.0%` · Dates `yyyy-mm-dd`

## Paste-ready design const
```tsx
export const design: DesignSystem = { … }
```

## Conventions
- Assumptions always on their own sheet, key-value
- Data bars on the primary magnitude column only
- Column widths: labels 24, figures 14
```

Optionally add `themes/<id>.demo.tsx` — a small workbook exercising the theme, so
the gallery has something to show.

## Rules that matter for print and Excel alike

- **One accent colour.** A second one competes; a third is decoration.
- **White or near-white background.** Anything darker costs toner and makes
  Excel's own selection highlight unreadable.
- **Body text no smaller than 10pt.** Spreadsheets get printed and squinted at.
- **Number formats are part of the theme.** A house style that leaves ratios
  unformatted has not done its job.
- Keep the `design` const a plain object literal so the Design panel can rewrite it.
