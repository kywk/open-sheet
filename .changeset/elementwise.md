---
'@open-sheet/core': patch
---

Elementwise functions map over a range, so `ABS(range)` inside `SUMPRODUCT`
computes — ranking by magnitude of change was the case that found it. Aggregates
are deliberately left alone: `MIN` over a range is a minimum, not one per cell.
