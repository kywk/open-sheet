---
'@open-sheet/core': patch
---

Restores `sheet-authoring/SKILL.md`, which had been overwritten with the contents
of one of its own reference files and shipped that way since 0.1.3 — taking the
file contract, the component surface, and the self-review checklist with it.
A test now guards the shipped skills.

Adds two self-review checks: nothing that depends on the values may be decided in
the `data` array, and periods being compared must cover comparable spans.
Documents data-driven row conditions and computed `columns`.
