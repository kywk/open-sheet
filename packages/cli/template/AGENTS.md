# This is an open-sheet workspace

Workbooks live in `sheets/<id>/index.tsx`. Each one is JSX describing the report,
with rows as plain TypeScript arrays.

## The rule that matters

**Never write a cell address.** No `B5`, no `SUM(B2:B13)`. The framework assigns
every coordinate after layout, and references resolve against it:

```tsx
col('grossProfit', { formula: (r) => sub(r.cell('revenue'), r.cell('cogs')) })
```

Add a row to the data array and every reference re-resolves. Write an address by
hand and it is correct only until someone inserts a row — after which it is
silently wrong, which in a spreadsheet is worse than broken.

## Skills

- `/create-sheet` — draft a workbook end to end
- `/sheet-authoring` — the technical reference: components, references, formats
- `/current-sheet` — resolve "the cell I'm looking at"
- `/apply-comments` — apply notes left in the viewer
- `/create-theme` — build a reusable house style

## Commands

```bash
pnpm dev       # viewer at http://localhost:5373
pnpm build     # writes .xlsx and .csv into dist/
pnpm preview   # serve what build wrote
```

## Never invent a number

A fabricated figure in a spreadsheet looks exactly like a real one — formatted,
totalled, and decided upon. If a number is not available, leave an explicit
`TODO:` and say so.
