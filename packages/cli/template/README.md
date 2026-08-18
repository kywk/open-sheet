# __NAME__

An [open-sheet](https://github.com/lianghsun/open-sheet) workspace.

```bash
pnpm install
pnpm dev        # http://localhost:5373
```

Then ask your coding agent:

> /create-sheet — build me an FY26 budget model

## What you get

`pnpm build` writes a `.xlsx` containing **live formulas**, not baked numbers.
Open it in Excel, change an assumption, and everything downstream recalculates.

## Layout

| Path | What |
| --- | --- |
| `sheets/<id>/index.tsx` | one workbook each |
| `themes/<id>.md` | reusable house styles |
| `open-sheet.config.ts` | workspace config |
