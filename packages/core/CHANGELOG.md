# @open-sheet/core

## 0.2.0

### Minor Changes

- 240fda5: Lookup and conditional aggregation. `lookup({ value, from, match, get, ifMissing })`
  compiles to `INDEX`/`MATCH` over **named** columns — deliberately not `VLOOKUP`,
  whose positional column index silently repoints when a column is inserted.
  
  Adds `INDEX` `MATCH` `LARGE` `SMALL` `SUMIF` `SUMIFS` `COUNTIF` `COUNTIFS`
  `AVERAGEIF` `AVERAGEIFS` `MAXIFS` `MINIFS`, each verified against a real engine
  before being offered.
  
  Excel errors from the function library are reported as Excel errors rather than
  as "we could not compute this" — which had hidden a real `#N/A` and stopped
  `IFNA` from catching the one a failed `MATCH` exists to produce.
- ed2c38e: Text and dates: `LEN` `LEFT` `RIGHT` `MID` `TRIM` `UPPER` `LOWER` `PROPER`
  `SUBSTITUTE` `FIND` `SEARCH` `TEXT` `VALUE` `REPT` `TEXTJOIN` `CONCAT`, and
  `DATE` `TODAY` `YEAR` `MONTH` `DAY` `WEEKDAY` `EOMONTH` `EDATE` `DATEDIF` `DAYS`
  `NETWORKDAYS` `WORKDAY` `YEARFRAC` — 67 functions whitelisted, each verified
  against a real engine.
  
  Dates evaluate. A date in a workbook is a serial number with a format on top, and
  the function library returns JavaScript `Date` objects, which the evaluator was
  treating as "cannot compute" — so every date chain broke at its first call. The
  HTML and viewer renderers now interpret date format codes too, instead of showing
  the serial where Excel shows a date.

### Patch Changes

- 10efe56: Two correctness fixes reported by @ericweichun.
  
  Duplicate key-value keys are refused at compile time. Excel's defined names are
  workbook-global and case-insensitive, so two blocks claiming one name meant the
  exported formula pointed at whichever was written last while the evaluator
  resolved through the block the author named — the viewer showing 0.1 where Excel
  computed 0.2. Keys are also validated against Excel's rules for a name, and the
  serializer now requires the column to match before using a name.
  
  Blank cells compare the way a spreadsheet compares them: a blank takes the empty
  value of whatever it is compared against, so `blank = 0` and `blank = ""` are
  both true while `0 = ""` is false. The relation is not transitive, which is why
  a blank cannot be normalised to one or the other.
- bd8c2d7: Functions added after Excel 2007 are written with the `_xlfn.` prefix the file
  format requires. Without it `IFS`, `SWITCH`, and `TEXTJOIN` are `#NAME?` in
  anything that does not already know them — verified against LibreOffice, where
  the bare name fails and the prefixed one computes. The prefix is a storage
  detail: Excel displays the bare name, and the parser strips it on the way back.

## 0.1.9

### Patch Changes

- 15949d4: `<Sheet print={{ … }}>` sets orientation, paper size, fit-to-width, margins, and
  whether the table header repeats on every printed page. Without it Excel prints
  landscape at 100%, so a form comes out sideways and page two of a long table
  arrives with no header — neither recoverable by the person holding the paper.
  HTML and PDF follow the same declaration.
- 35af6f6: `col(key, { wrap: true })` wraps long text. Excel does not wrap by default, so a
  description column narrower than its content spilled into the neighbouring cell
  or was clipped when printed — while HTML wrapped it, so the two disagreed.

## 0.1.8

### Patch Changes

- 210df3a: `sheet-authoring` gains a section on what the framework cannot check: it
  guarantees referential integrity, not that the things being compared are
  comparable. Three real failure shapes — ordering decided in `data`, periods of
  different length, sources with different coverage — with the pattern that avoids
  the third: normalise each figure by its own coverage before combining them.

## 0.1.7

### Patch Changes

- 22c6534: Restores `sheet-authoring/SKILL.md`, which had been overwritten with the contents
  of one of its own reference files and shipped that way since 0.1.3 — taking the
  file contract, the component surface, and the self-review checklist with it.
  A test now guards the shipped skills.
  
  Adds two self-review checks: nothing that depends on the values may be decided in
  the `data` array, and periods being compared must cover comparable spans.
  Documents data-driven row conditions and computed `columns`.

## 0.1.6

### Patch Changes

- 8505b72: `raw` tagged templates accept an expression, not only a bare reference. The
  signature said `Ref | Expr` and only `Ref` was implemented, so interpolating
  `r.cell('x')` — which returns an expression, and is the commonest thing to
  interpolate — crashed the writer while `tsc` stayed happy. An empty
  interpolation is refused with a message naming its position.
  
  A formula that fails to resolve names the block, column and row it came from,
  instead of surfacing bare and leaving you to bisect the workbook by hand.

## 0.1.5

### Patch Changes

- 52ae163: Elementwise functions map over a range, so `ABS(range)` inside `SUMPRODUCT`
  computes — ranking by magnitude of change was the case that found it. Aggregates
  are deliberately left alone: `MIN` over a range is a minimum, not one per cell.

## 0.1.4

### Patch Changes

- aac914b: `SUMPRODUCT` works for what it is actually for. The evaluator now carries array
  values through comparisons and arithmetic, so the standard ranking idiom —
  `SUMPRODUCT((range>cell)*1)+1` — computes instead of returning `#VALUE!`.
  Summing one plain range is just `SUM`; array semantics are the whole reason to
  reach for `SUMPRODUCT`.
  
  Anything the evaluator cannot compute now reports `#NOT_EVALUATED` rather than a
  fabricated `#VALUE!`. That kept a made-up Excel error out of the exported cache,
  and stops `iferror` from swallowing a gap in this evaluator as though it were a
  real spreadsheet condition.
  
  `raw` accepts a tagged template with interpolated references —
  ``raw`=LARGE(${ref('costs').column('delta')}, 1)` `` — so the escape hatch no
  longer requires writing the cell addresses the framework exists to avoid.
- 88b8fa0: Build failures name the workbook and file that failed, instead of leaving you to
  guess which of several it came from. A duplicate block name used twice on one
  sheet now says so rather than naming the same sheet twice.
  
  `r.cell()` on a field that is in the data but has no column explains both ways
  forward, and names the tradeoff: `r.data.x` bakes the value into the exported
  formula as a literal, so the recipient cannot change it.
- 8d35c2d: The HTML and viewer renderers honour Excel's format sections
  (`positive;negative;zero;text`). The accounting format showed `-84,500` where
  Excel showed `(84,500)`, and zero as `0` where Excel showed `-` — the same cell
  reading differently in the two places.
  
  Cycle errors name the construct that produced each cell — `"costs" column "b"
  row 1` — rather than an internal coordinate the author never wrote.
- 4964e9c: `--help` short-circuits from any command. `open-sheet build --help` used to
  compile the whole workspace and overwrite `dist/`. Unknown options are rejected
  rather than silently ignored, so a mistyped `--xlsx` says so.
  
  Documents that CSV exports raw values without number formats, the
  periods-as-columns layout that variadic `sum` and `r.index` exist for, and that a
  table title merges to the table's width on its own.
- 46b21ad: Leaving a note from the Inspector no longer breaks the workbook. The marker was
  written as `//`, which is a comment in JS but a bare text node in JSX children —
  where a `<Table>` always sits — so every note ever left stopped the workbook
  compiling, with an error that looked nothing like "you left a note". JSX
  positions now get `{/* … */}`. Markers name the block, since one data array can
  feed several tables.
  
  The Design panel stops misreporting state: an unset colour is shown as unset
  rather than as black, and a value the dropdown does not know about is shown as
  set rather than as the theme default. Its empty state says what to add.
  
  The viewer keeps your sheet, selection, and open panel across the reload that
  writing an edit triggers.

## 0.1.3

### Patch Changes

- c03d3e2: `IFERROR`, `IFNA`, and `IF` are evaluated lazily, as Excel evaluates them. They
  previously could not work at all: every argument was evaluated first and any
  Excel error returned immediately, so `IFERROR` never saw the error it exists to
  catch and `IF` failed on exactly the rows its guard was there for. Adds `ifna`.
  
  Authoring types accept a bare `Ref` wherever an expression is accepted — a KPI
  value, a column formula, a key-value entry. `lift()` already handled them at
  runtime and the reference documentation listed them as usable; only the types
  disagreed.

## 0.1.2

### Patch Changes

- 63c352e: Fix a blank viewer in published installs. The main entry reached Node-only code —
  the CLI, the dev server, and the optional `import('playwright')` behind PDF
  export — which the browser had to load to evaluate a workbook. Under npm's flat
  `node_modules` that produced CommonJS the browser could not import, and the page
  died before mounting.
  
  Node-only exports moved to `@open-sheet/core/node`. The main entry is now
  browser-safe: components, builders, references, compile, evaluate, style, and the
  pure exporters.

## 0.1.1

### Patch Changes

- 866ec22: Expose `./package.json` from the exports map, so tooling that reads it — including
  the scaffolder's own fallback lookup — resolves instead of throwing.
- 6ac082d: Fix a blank viewer in every published install. `@vitejs/plugin-react` was a
  devDependency, so it was bundled into `dist` and its Fast Refresh runtime
  resolved to a file that does not exist there. It is a runtime dependency now.

## 0.1.0

### Minor Changes

- 6832304: First release. Author a workbook as JSX with named data columns and export a
  `.xlsx` containing live formulas — no cell address appears anywhere in the
  source, and every reference re-resolves when the data changes.
  
  Includes the viewer and dev server, the `/create-sheet` skills, an MCP server,
  inspect mode with source write-back, themes and a design panel, native Excel
  charts, and export to xlsx, csv, html, and pdf.

### Patch Changes

- 320fbd6: The scaffolder now carries the skills itself, and the framework ships the viewer,
  so `npx @open-sheet/cli init` and `open-sheet dev` work from a published install.
