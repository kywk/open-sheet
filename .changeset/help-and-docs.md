---
'@open-sheet/core': patch
---

`--help` short-circuits from any command. `open-sheet build --help` used to
compile the whole workspace and overwrite `dist/`. Unknown options are rejected
rather than silently ignored, so a mistyped `--xlsx` says so.

Documents that CSV exports raw values without number formats, the
periods-as-columns layout that variadic `sum` and `r.index` exist for, and that a
table title merges to the table's width on its own.
