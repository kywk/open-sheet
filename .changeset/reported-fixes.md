---
'@open-sheet/core': patch
---

Two correctness fixes reported by @ericweichun.

Duplicate key-value keys are refused at compile time. Excel's defined names are
workbook-global and case-insensitive, so two blocks claiming one name meant the
exported formula pointed at whichever was written last while the evaluator
resolved through the block the author named — the viewer showing 0.1 where Excel
computed 0.2. Keys are also validated against Excel's rules for a name, and the
serializer now requires the column to match before using a name.

Blank cells compare the way a spreadsheet compares them: a blank takes the empty
value of whatever it is compared against, so `blank = 0` and `blank = ""` are
both true while `0 = ""` is false. The relation is not transitive, which is why
a blank cannot be normalised to one or the other.
