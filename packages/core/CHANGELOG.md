# @open-sheet/core

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
