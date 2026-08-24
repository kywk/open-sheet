---
'@open-sheet/core': minor
---

Lookup and conditional aggregation. `lookup({ value, from, match, get, ifMissing })`
compiles to `INDEX`/`MATCH` over **named** columns — deliberately not `VLOOKUP`,
whose positional column index silently repoints when a column is inserted.

Adds `INDEX` `MATCH` `LARGE` `SMALL` `SUMIF` `SUMIFS` `COUNTIF` `COUNTIFS`
`AVERAGEIF` `AVERAGEIFS` `MAXIFS` `MINIFS`, each verified against a real engine
before being offered.

Excel errors from the function library are reported as Excel errors rather than
as "we could not compute this" — which had hidden a real `#N/A` and stopped
`IFNA` from catching the one a failed `MATCH` exists to produce.
