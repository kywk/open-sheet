# @open-sheet/core

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
