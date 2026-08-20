---
'@open-sheet/core': patch
---

`SUMPRODUCT` works for what it is actually for. The evaluator now carries array
values through comparisons and arithmetic, so the standard ranking idiom —
`SUMPRODUCT((range>cell)*1)+1` — computes instead of returning `#VALUE!`.
Summing one plain range is just `SUM`; array semantics are the whole reason to
reach for `SUMPRODUCT`.

Anything the evaluator cannot compute now reports `#NOT_EVALUATED` rather than a
fabricated `#VALUE!`. That kept a made-up Excel error out of the exported cache,
and stops `iferror` from swallowing a gap in this evaluator as though it were a
real spreadsheet condition.

`raw` accepts a tagged template with interpolated references —
``raw`=LARGE(${ref('costs').column('delta')}, 1)` `` — so the escape hatch no
longer requires writing the cell addresses the framework exists to avoid.
