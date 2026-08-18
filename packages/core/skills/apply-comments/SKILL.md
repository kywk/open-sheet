---
name: apply-comments
description: Use this skill when the user has left notes on cells in the open-sheet viewer and wants them applied — "apply my comments", "do the notes I left", "I marked some things up". Walks every `@sheet-comment` marker in the workbook source, makes the edit each one asks for, and clears the marker.
---

# Apply the comments left in the viewer

Notes left through the viewer's inspect mode are written into the workbook source
as markers:

```tsx
// @sheet-comment: this should be a percentage, and rounded to one decimal
col('margin', { header: 'Margin', formula: (r) => div(…) }),
```

## Workflow

1. **Find them.** Search `sheets/<id>/index.tsx` for `@sheet-comment`. If the
   user did not name a workbook, use the `current-sheet` skill.
2. **Read them all before changing anything.** Two comments often describe one
   change, and a later one can contradict an earlier one.
3. **Apply each in the authoring layer.** The comment sits next to the construct
   it is about — a `col`, a `data` entry, a `<Cell>`. Change that construct, not
   a coordinate.
4. **Delete the marker** once the edit is made. A stale marker gets re-applied
   next time and the edit lands twice.
5. **Ask, do not guess.** If a comment is ambiguous ("this looks off"), leave the
   marker in place and ask what they meant. A wrong edit to a financial model is
   worse than an unapplied one.

## After

Summarise what you changed, one line per comment, and name anything you left
alone and why.
