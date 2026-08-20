---
'@open-sheet/core': patch
---

`sheet-authoring` gains a section on what the framework cannot check: it
guarantees referential integrity, not that the things being compared are
comparable. Three real failure shapes — ordering decided in `data`, periods of
different length, sources with different coverage — with the pattern that avoids
the third: normalise each figure by its own coverage before combining them.
