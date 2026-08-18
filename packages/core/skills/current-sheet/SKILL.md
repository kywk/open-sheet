---
name: current-sheet
description: Use this skill to find out which workbook, sheet, and cell the user is currently looking at in the open-sheet viewer, so an instruction like "make this bold" or "why is this wrong?" resolves to the right place without asking. Use it whenever the user refers to "this cell", "this sheet", "the one I'm looking at", or gives an instruction with no explicit workbook id.
---

# Resolve "this one"

The dev server publishes the reader's position to
`node_modules/.open-sheet/current.json` as they navigate:

```json
{ "id": "fy26-budget", "sheet": "P&L", "cell": "B7", "updatedAt": "2026-08-18T…" }
```

Read that file, or `GET http://localhost:5373/__open-sheet/api/current`.

## Using it

1. Read the file. If it is missing or `updatedAt` is old, the dev server is
   probably not running — ask which workbook rather than guessing.
2. `id` gives you `sheets/<id>/index.tsx`.
3. `cell` is an A1 address **for reading only**. It tells you where the user is
   pointing; it is not something to write into the source.

## Turning a cell into a source location

The user points at a cell; you have to edit the block that produced it. Open the
workbook and work out which block covers that address — usually obvious from the
sheet's structure — then change the **authoring** construct:

| The user says | You change |
| --- | --- |
| "this number is wrong" | the value in the `data` array, or the `formula` |
| "make this a percentage" | `format` on that column |
| "this column should be a bar" | `bar: true` on that column |
| "this total is wrong" | the `total` aggregate, or the formula feeding it |

Never respond by writing an address into the file. If you find yourself wanting
to, re-read `sheet-authoring`.
