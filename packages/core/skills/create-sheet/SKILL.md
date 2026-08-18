---
name: create-sheet
description: Use this skill when the user wants to create, draft, build, or generate a new spreadsheet, financial model, budget, forecast, dashboard, tracker, or register in this open-sheet workspace. Triggers on phrases like "build me a budget model", "make a spreadsheet for X", "draft an FY26 forecast", "put this data in a workbook", or when the user asks to add something under `sheets/`. Do NOT use for editing the framework itself — only for authoring content inside `sheets/<id>/`.
---

# Create a workbook in open-sheet

This skill owns the **workflow**. The technical reference — file contract,
components, references, formats — lives in the **`sheet-authoring`** skill. Read
it before writing code; do not duplicate its rules here.

You only write files under `sheets/<id>/`. Never modify `package.json`,
`open-sheet.config.ts`, or an existing workbook unless asked.

## Step 0 — Pick a theme

List `themes/`. If any theme markdown exists, offer each theme id via
`AskUserQuestion` plus a final **"no theme — design from scratch"** option. If
the user picks one, read `themes/<id>.md` end to end, copy its palette and
components, and set `meta.theme`.

## Step 1 — Get the numbers before anything else

A spreadsheet is judged entirely on whether its numbers are right. Before
structure, before layout, establish:

- **Purpose** — what decision does this workbook support? A budget to approve, a
  forecast to argue with, a register to maintain?
- **Audience** — a CFO wants assumptions they can change; an analyst wants the
  working; an ops team wants a list they can filter.
- **The data** — where does it come from? Ask for the file, the query, the
  figures. If the user has none yet, build the structure and leave explicit
  `TODO:` markers.

> **Never invent a figure.** Not a revenue number, not a growth rate, not a
> headcount, not a "typical industry" benchmark. A fabricated number in a
> spreadsheet is indistinguishable from a real one — it will be formatted,
> totalled, and charted exactly like the truth, and someone will make a decision
> on it. This matters more here than in a slide deck or a report.
>
> If you need a placeholder to demonstrate structure, make it obviously fake
> (`0`, or `1` with a `<Note>` saying so) and tell the user.

## Step 2 — Clarify the shape (ask before writing code)

One `AskUserQuestion` call, skipping anything the user has already settled:

1. **Workbook type** — propose three that fit *this* request, with what each
   implies structurally:
   - *"our FY26 numbers"* → **driver model** (assumptions sheet drives a P&L) ·
     **budget vs actual** (variance columns and a data bar) · **exec summary**
     (one sheet, KPI band, no working shown)
   - *"track our vendors"* → **register** (one row per vendor, filterable) ·
     **spend analysis** (grouped totals, top-N) · **scorecard** (weighted criteria)
2. **Assumptions** — which numbers should the reader be able to change? This is
   the question that decides whether the export is a model or a picture.
3. **Sheets** — one sheet or several? Assumptions separate from calculations is
   the default and should only be collapsed for a genuinely trivial workbook.
4. **Output** — is this opened in Excel (the usual case), printed as a report,
   or read as a dashboard? It changes formats, widths, and whether to add a
   `--html` pass.

## Step 3 — Pick an id

**kebab-case**, short, descriptive: `fy26-budget`, `vendor-register`,
`unit-economics`. Check `sheets/` for collisions.

## Step 4 — Plan the sheets before writing

One line per sheet, with its role. Typical shapes:

| Type | Sheets |
| --- | --- |
| Driver model | Assumptions · P&L · (Cash flow) · (Summary) |
| Budget vs actual | Assumptions · Budget · Actual · Variance |
| Register | Data · (Lookups) · (Summary) |
| Dashboard | Assumptions · Data · Dashboard |

Rules:

- **Assumptions get their own sheet**, as a `kind="keyValue"` table. Every key
  becomes an Excel defined name, so exported formulas read `=B5*growth`.
- Calculations reference assumptions. A rate written inside a formula is a rate
  the reader cannot change.
- A KPI band belongs at the top of the sheet a reader opens first.

Show the plan before writing if it runs past three sheets.

## Step 5 — Write `sheets/<id>/index.tsx`

Read **`sheet-authoring`** first. While writing:

- Structure in JSX, rows in a plain TypeScript array
- Every computed column uses `formula`, never a value pre-computed in `data` —
  a pre-computed value exports as a dead number
- Guard `r.prev()` / `r.next()` with `r.isFirst` / `r.isLast`
- Set a `format` on every numeric column
- `bar: true` where a reader compares magnitudes down a column
- No cell addresses. None.

## Step 6 — Check it

Look at the viewer, and:

- [ ] Do the totals match what you would get by hand?
- [ ] Is anything showing `#NOT_EVALUATED` that should not be?
- [ ] Change an assumption in the viewer's source and confirm the dependent
      numbers move. If they do not, something is a literal that should be a
      formula.
- [ ] Run the self-review checklist in `sheet-authoring`.

Then tell the user what you assumed and what you left as `TODO`.
