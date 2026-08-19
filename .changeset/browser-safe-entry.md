---
'@open-sheet/core': patch
---

Fix a blank viewer in published installs. The main entry reached Node-only code —
the CLI, the dev server, and the optional `import('playwright')` behind PDF
export — which the browser had to load to evaluate a workbook. Under npm's flat
`node_modules` that produced CommonJS the browser could not import, and the page
died before mounting.

Node-only exports moved to `@open-sheet/core/node`. The main entry is now
browser-safe: components, builders, references, compile, evaluate, style, and the
pure exporters.
