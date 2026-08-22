---
'@open-sheet/core': patch
---

Functions added after Excel 2007 are written with the `_xlfn.` prefix the file
format requires. Without it `IFS`, `SWITCH`, and `TEXTJOIN` are `#NAME?` in
anything that does not already know them — verified against LibreOffice, where
the bare name fails and the prefixed one computes. The prefix is a storage
detail: Excel displays the bare name, and the parser strips it on the way back.
