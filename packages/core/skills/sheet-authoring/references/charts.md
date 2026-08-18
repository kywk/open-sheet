# Charts

## What is live, and why it matters

A chart embedded as an image stops being true the moment someone changes a
number — and the whole point of an open-sheet export is that the recipient *can*
change a number. So the rule is:

**Anything in the .xlsx must recalculate. If it cannot, it does not go in.**

## Today

| Want | Use | Live in Excel? |
| --- | --- | --- |
| Compare magnitudes down a column | `col(…, { bar: true })` | **Yes** — native `dataBar` |
| A chart in a printed report | HTML/PDF export | n/a — it is a report |
| A chart inside the workbook | not yet — see below | |

Native Excel charts are tracked as a roadmap item. They require writing OOXML
chart parts into the exported zip, because the underlying library has no chart
support and an embedded picture would break the rule above.

Until then: if a reader needs a chart *inside the workbook*, say so plainly in a
`<Note>` rather than pasting an image that will go stale. Excel's own chart
tools work fine on a well-structured range, and the range you exported is
well-structured.

## Structuring for charts the reader will make

- Keep a series in one contiguous column with a header
- Put the category labels in the column immediately left of the first series
- Avoid blank rows inside the data range — `<Spacer>` goes between blocks, not
  inside a table
