# Trying it before it ships

Published as `0.1.0`. Everything below is covered by automated tests too — this
is the version you can watch happen.

```bash
npx @open-sheet/cli init my-sheets
cd my-sheets && npm install
```

To work on the framework itself instead:

```bash
git clone https://github.com/lianghsun/open-sheet && cd open-sheet
pnpm install && pnpm build
```

## 1. The claim, in one minute

```bash
cd apps/demo
pnpm exec open-sheet build --out dist
```

Open `dist/fy26-budget.xlsx` in Excel or Google Sheets and click on the **Net
income** column. You should see:

```
=F6*(1-taxRate)
```

Now go to the **Assumptions** sheet and change `taxRate` from `0.2` to `0.35`.
Every net income figure, the total, and the KPI band should move.

Then open `apps/demo/sheets/fy26-budget/index.tsx` and search it for `B6`, `F6`,
or `SUM(`. There are none. The framework wrote every address.

## 2. The viewer

```bash
cd apps/demo && pnpm dev          # http://localhost:5373
```

- **Formula bar** — click any computed cell. It shows the *resolved* formula
  beside its value, which is the only place to check the framework picked the
  range you meant.
- **Inspect** — click the toolbar button, then a cell. It reports which block,
  column, and row produced it, and the source line. Change the value and it
  writes back into the array the number came from. Try it on a computed column:
  it refuses and says what to change instead.
- **Design** — change the accent colour. It rewrites the `design` literal in the
  source; rebuild and the exported workbook follows.
- **Themes / Assets** — the other two sidebar views.

## 3. The agent loop

In a coding agent, from `apps/demo` or a scaffolded workspace:

```
/create-sheet   build me a headcount plan for FY27
```

It should ask where the numbers come from before it asks anything about layout,
and it should refuse to invent figures. Check the file it writes contains no
cell address.

## 4. A fresh workspace

```bash
cd /tmp && npx @open-sheet/cli init my-sheets
```

Verify `.claude/skills/` and `.agents/skills/` both arrived, and that
`sheets/getting-started/index.tsx` reads as an argument for the whole idea.



## 5. The MCP server

```bash
cd apps/demo && pnpm exec open-sheet dev --mcp
```

```bash
curl -s -X POST http://localhost:5373/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

`describe_workbook` is the interesting one — it returns the block names, column
keys, and defined names, which is exactly the vocabulary `ref()` accepts.

## 6. The tests

```bash
pnpm test
```

144 tests. Two of them drive LibreOffice: one recalculates an exported workbook
and diffs it against our own evaluator, the other changes an assumption and
asserts the whole column moves with LibreOffice doing the arithmetic. They skip
automatically if `soffice` is not installed — `brew install --cask libreoffice`
to run them.

## What to be suspicious of

If you want to try to break it, these are the places worth pushing on:

- **Insert a row** into any `data` array and rebuild. Every formula, total, and
  chart range should re-resolve. This is the whole premise.
- **Rename a column key** and check the error names the column you meant.
- **`r.prev()` without an `isFirst` guard** — should be a clear error naming the
  guard, not a `#REF!`.
- **A function outside the whitelist** — should export verbatim and show
  `#NOT_EVALUATED`, never a plausible-looking number.
- **A non-Latin sheet name** — should get its own CSV file, not overwrite another.
