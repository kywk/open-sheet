# Charts

## The rule

A chart embedded as an image stops being true the moment someone changes a
number — and the whole point of an open-sheet export is that the recipient *can*
change a number. So:

**Anything in the .xlsx must recalculate. If it cannot, it does not go in.**

`<Chart>` writes real OOXML chart parts bound to real cell ranges. It is not a
picture. Change a cell in Excel and the chart moves.

## Using it

```tsx
<Chart
  kind="line"                                   // 'bar' | 'line' | 'pie'
  title="Trials by month"
  categories={ref('funnel').column('month')}
  series={[
    { name: 'Trials', values: ref('funnel').column('trials') },
    { name: 'Paid',   values: ref('funnel').column('paid') },
  ]}
  rows={16}
  cols={7}
/>
```

`categories` and `series[].values` are ordinary references, so they resolve after
layout like everything else — add a row to the data and the chart's range grows
with it.

`rows` and `cols` are the chart's footprint on the grid. The placement engine
treats it as any other block, so it stacks and gaps normally.

## What renders where

| Output | What you get |
| --- | --- |
| `.xlsx` | a native chart bound to ranges — live |
| viewer, `.html`, `.pdf` | an SVG drawn from the same evaluated values |
| `.csv` | nothing; a chart is not data |

The SVG twin reads the values the grid shows, so the two cannot disagree.

## Also live, and often better

For comparing magnitudes down a single column, `col(key, { bar: true })` is
usually the clearer choice — a native `dataBar` sits in the cells themselves, so
there is no chart to position and nothing to fall out of date.

## Structuring data for charts

- Keep a series in one contiguous column with a header
- Put category labels in their own column
- No blank rows inside a table — `<Spacer>` goes between blocks, not inside one
