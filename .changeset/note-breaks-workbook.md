---
'@open-sheet/core': patch
---

Leaving a note from the Inspector no longer breaks the workbook. The marker was
written as `//`, which is a comment in JS but a bare text node in JSX children —
where a `<Table>` always sits — so every note ever left stopped the workbook
compiling, with an error that looked nothing like "you left a note". JSX
positions now get `{/* … */}`. Markers name the block, since one data array can
feed several tables.

The Design panel stops misreporting state: an unset colour is shown as unset
rather than as black, and a value the dropdown does not know about is shown as
set rather than as the theme default. Its empty state says what to add.

The viewer keeps your sheet, selection, and open panel across the reload that
writing an edit triggers.
