---
'@open-sheet/core': patch
---

`raw` tagged templates accept an expression, not only a bare reference. The
signature said `Ref | Expr` and only `Ref` was implemented, so interpolating
`r.cell('x')` — which returns an expression, and is the commonest thing to
interpolate — crashed the writer while `tsc` stayed happy. An empty
interpolation is refused with a message naming its position.

A formula that fails to resolve names the block, column and row it came from,
instead of surfacing bare and leaving you to bisect the workbook by hand.
