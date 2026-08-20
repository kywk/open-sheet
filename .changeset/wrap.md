---
'@open-sheet/core': patch
---

`col(key, { wrap: true })` wraps long text. Excel does not wrap by default, so a
description column narrower than its content spilled into the neighbouring cell
or was clipped when printed — while HTML wrapped it, so the two disagreed.
