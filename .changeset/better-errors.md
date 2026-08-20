---
'@open-sheet/core': patch
---

Build failures name the workbook and file that failed, instead of leaving you to
guess which of several it came from. A duplicate block name used twice on one
sheet now says so rather than naming the same sheet twice.

`r.cell()` on a field that is in the data but has no column explains both ways
forward, and names the tradeoff: `r.data.x` bakes the value into the exported
formula as a literal, so the recipient cannot change it.
