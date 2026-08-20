---
'@open-sheet/core': patch
---

The HTML and viewer renderers honour Excel's format sections
(`positive;negative;zero;text`). The accounting format showed `-84,500` where
Excel showed `(84,500)`, and zero as `0` where Excel showed `-` — the same cell
reading differently in the two places.

Cycle errors name the construct that produced each cell — `"costs" column "b"
row 1` — rather than an internal coordinate the author never wrote.
