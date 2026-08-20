---
'@open-sheet/core': patch
---

`IFERROR`, `IFNA`, and `IF` are evaluated lazily, as Excel evaluates them. They
previously could not work at all: every argument was evaluated first and any
Excel error returned immediately, so `IFERROR` never saw the error it exists to
catch and `IF` failed on exactly the rows its guard was there for. Adds `ifna`.

Authoring types accept a bare `Ref` wherever an expression is accepted — a KPI
value, a column formula, a key-value entry. `lift()` already handled them at
runtime and the reference documentation listed them as usable; only the types
disagreed.
