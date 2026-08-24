---
'@open-sheet/core': minor
---

Text and dates: `LEN` `LEFT` `RIGHT` `MID` `TRIM` `UPPER` `LOWER` `PROPER`
`SUBSTITUTE` `FIND` `SEARCH` `TEXT` `VALUE` `REPT` `TEXTJOIN` `CONCAT`, and
`DATE` `TODAY` `YEAR` `MONTH` `DAY` `WEEKDAY` `EOMONTH` `EDATE` `DATEDIF` `DAYS`
`NETWORKDAYS` `WORKDAY` `YEARFRAC` — 67 functions whitelisted, each verified
against a real engine.

Dates evaluate. A date in a workbook is a serial number with a format on top, and
the function library returns JavaScript `Date` objects, which the evaluator was
treating as "cannot compute" — so every date chain broke at its first call. The
HTML and viewer renderers now interpret date format codes too, instead of showing
the serial where Excel shows a date.
