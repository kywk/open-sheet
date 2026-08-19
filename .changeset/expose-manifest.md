---
'@open-sheet/core': patch
---

Expose `./package.json` from the exports map, so tooling that reads it — including
the scaffolder's own fallback lookup — resolves instead of throwing.
