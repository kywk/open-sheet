# Placement

You describe the order. The framework decides the coordinates.

## Sizes are discrete

Every block reports a size in whole rows and columns:

| Block | Rows | Columns |
| --- | --- | --- |
| `<Cell>` | 1, or `span.rows` | 1, or `span.cols` |
| `<Note cols={n}>` | 1 | `n` (default 4) |
| `<Spacer>` | `rows` | `cols` |
| `<KpiBand>` | 2 (labels, values) | one per item |
| `<Table>` | title? + header? + data rows + total? | one per column |
| `<Stack>` | sum of children + `gap` between | widest child |
| `<Row>` | tallest child | sum of children + `gap` between |

Because sizes are arithmetic rather than measured, the compiler never needs a
browser. Export runs in Node.

## Stacking

A `<Sheet>`'s children are stacked with a gap of 1. Nest `<Stack>` to change the
gap, `<Row>` to go sideways.

```tsx
<Sheet name="Summary">
  <Stack gap={2}>
    <KpiBand items={…} />
    <Row gap={3}>
      <Table name="left" … />
      <Table name="right" … />
    </Row>
    <Note>Footnote.</Note>
  </Stack>
</Sheet>
```

Blocks that measure zero — an empty `<Stack>`, a conditional that rendered
nothing — take no space and consume no gap, so `{condition && <Table …/>}` does
not leave a hole.

## Merging

A `<Table title>` is merged across the table's full width automatically — you do
not size it. `<Cell span={{ rows, cols }}>` merges explicitly, and the placement
engine reserves the whole footprint, so a spanned cell cannot be overlapped.

## Collisions are framework bugs

The engine asserts that no two blocks overlap and reports both rects if they do.
You never chose a coordinate, so a collision is never your mistake — file it.

## Do not compute where something landed

If you want to point at a cell, use a reference. `firstDataRow`, `totalRow`, and
the column map exist on the compiled registry for the framework's own use; they
are not an authoring API.
