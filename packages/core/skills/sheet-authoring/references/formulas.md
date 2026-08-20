# References and formulas

## References

None of these carry an address. They are descriptions, resolved after layout.

| Reference | Points at |
| --- | --- |
| `r.cell('revenue')` | the named column, same row |
| `r.prev().cell('revenue')` | the row above — **guard with `r.isFirst`** |
| `r.next().cell('revenue')` | the row below — **guard with `r.isLast`** |
| `r.index`, `r.isFirst`, `r.isLast`, `r.data` | position and the row's own object |
| `ref('pl').column('revenue')` | that column's whole data range |
| `ref('pl').total('revenue')` | that column's total cell (needs `total={{ … }}`) |
| `ref('pl').cell('revenue', 0)` | a specific data row |
| `ref('pl').body()` | the whole data area |
| `ref('assumptions').get('growth')` | a key-value entry, by its defined name |

`r` is the argument to a column's `formula`. `ref(name)` works anywhere,
including across sheets — the qualifier is added for you.

## Letting the data decide which rows compute

`r.data` is the row's own object, so a flag on the data can decide whether a cell
computes at all — which keeps "who does this apply to" a property of the data
rather than a condition buried in a formula:

```tsx
const MONTHS = [
  { key: 'm202605', label: '2026-05*', partial: true },   // export started mid-month
  { key: 'm202606', label: '2026-06', partial: false },
]

col('mom', {
  formula: (r) => (r.isFirst || r.data.prevPartial ? null : sub(div(…), 1)),
})
```

Returning `null` leaves the cell empty, which is the honest answer when the
comparison is not meaningful. Better still, do not generate the column at all —
see below.

## Columns are an ordinary array

`columns` is computed like any other array, which is how period-as-column layouts
stay maintainable:

```tsx
columns={[
  col('service', { header: 'Service' }),
  ...MONTHS.map((m) => col(m.key, { header: m.label, format: 'currency' })),
]}
```

You can filter as well as map. A comparison whose baseline is a partial period is
better **not produced** than produced with a caveat — a caveat gets skipped, a
column that does not exist cannot be misread:

```tsx
...MONTHS.slice(1)
  .filter((_, i) => !MONTHS[i]?.partial)
  .map((m) => col(`mom_${m.key}`, { … }))
```

**Watch the index after a filter.** `.filter().map()` gives you the position in
the *filtered* array, not the original. Use `MONTHS.indexOf(m)` when you need the
original position — pairing a column with the wrong month is easy to write and
usually only shows up in the header label.

## `r.cell(key)` vs `r.data.key`

`r.cell('revenue')` points at a **cell**, so the exported formula reads `B5` and
the recipient can change it. `r.data.revenue` reads the **raw value**, which is
baked into the formula as a literal:

```tsx
formula: (r) => div(r.cell('mar'), r.cell('prev'))   // → =D6/E6
formula: (r) => div(r.cell('mar'), r.data.prev)      // → =D6/128400
```

Both compute the same number here. Only the first stays a model.

Use `r.data` when the value genuinely is not part of the model — a flag deciding
*which* formula to build, a label, a lookup key. If it is a number the reader
might want to change, give it a column so it lands on the grid.

A field that exists in your `data` array but has no `col()` has no cell to point
at, and `r.cell()` will say so.

Using `r.prev()` on the first row is an error at resolve time naming the guard
you forgot, not a silent `#REF!`.

## Building expressions

```tsx
sub(r.cell('revenue'), r.cell('cogs'))
div(sum(ref('pl').column('grossProfit')), sum(ref('pl').column('revenue')))
mul(r.cell('operatingIncome'), sub(1, ref('assumptions').get('taxRate')))
if_(gt(r.cell('revenue'), 0), div(r.cell('cogs'), r.cell('revenue')), 0)
```

Arithmetic: `add` `sub` `mul` `div` `pow` `neg` · text: `concat` · comparison:
`eq` `neq` `lt` `gt` `lte` `gte` · functions: `sum` `avg` `count` `min` `max`
`round` `abs` `if_` `iferror` `ifna` `npv` `irr` `sumproduct`.

Bare numbers, strings, and references all lift automatically — a reference can go
anywhere an expression can, including a KPI value or a whole column formula:

```tsx
{ label: 'Total cost', value: ref('costs').total('total') }
col('mirror', { formula: (r) => r.cell('amount') })
```

## Periods as columns

The reference examples above put periods in rows. Cost and budget analysis
usually does the opposite — one row per account, one column per month — and that
layout needs two things the row-wise examples never show.

**`sum` is variadic**, so a row total is a spread, not a range:

```tsx
const MONTHS = [
  { key: 'jan', header: 'Jan' },
  { key: 'feb', header: 'Feb' },
  { key: 'mar', header: 'Mar' },
]

const services = [
  { service: 'Compute', jan: 128_400, feb: 141_200, mar: 155_900 },
  { service: 'Storage', jan: 22_100, feb: 21_800, mar: 24_600 },
]

<Table
  name="costs"
  data={services}
  columns={[
    col('service', { header: 'Service', width: 20 }),
    ...MONTHS.map((m) => col(m.key, { header: m.header, format: 'currency' })),
    col('total', {
      header: 'Q1',
      format: 'currency',
      formula: (r) => sum(...MONTHS.map((m) => r.cell(m.key))),
    }),
    col('mom', {
      header: 'MoM',
      format: 'percent',
      // Month-on-month reads sideways: this column against the one before it.
      formula: (r) => sub(div(r.cell('mar'), r.cell('feb')), 1),
    }),
  ]}
  total={Object.fromEntries(MONTHS.map((m) => [m.key, 'sum' as const]))}
/>
```

**Two tables fed the same array line up row for row**, so a second sheet can
reference across without any alignment work:

```tsx
// On another sheet, same `services` array, same order:
col('share', {
  formula: (r) => div(ref('costs').cell('total', r.index), ref('costs').total('total')),
})
```

`r.index` is the row's position in the data, which is what makes this safe —
insert a service and both tables move together.

## Guarding a division

Two ways, and both are honest. Use whichever reads better:

```tsx
// return null: the cell is simply empty
formula: (r) => (r.isFirst ? null : sub(div(r.cell('cur'), r.prev().cell('cur')), 1))

// iferror: keep the formula, name what happens when it cannot compute
formula: (r) => iferror(sub(div(r.cell('cur'), r.cell('prev')), 1), '')
```

**Do not "fix" a `#DIV/0!` by padding the denominator.** `max(prev, 1)` turns an
honest blank into a number that looks real and is not. `iferror` exists so you
never have to.

Return `null` from a `formula` to leave the cell empty — that is how a
first-row growth figure should be written:

```tsx
formula: (r) => (r.isFirst ? null : sub(div(r.cell('revenue'), r.prev().cell('revenue')), 1))
```

## The whitelist, and `raw()`

The builders above are the functions open-sheet can both write *and* evaluate.
Anything else goes through the escape hatch:

```tsx
formula: () => raw('=XIRR(A1:A9,B1:B9)')
```

`raw()` exports verbatim and works in Excel. It is **not evaluated here**, so the
viewer shows `#NOT_EVALUATED` and the CSV cell is empty. That is deliberate: a
plausible-looking wrong number in a financial model is the worst failure this
project can have, so it never guesses.

Prefer a whitelisted expression. Reach for `raw()` when the function genuinely
has no equivalent, and say so in a `<Note>` if the reader will wonder.

## Formula strings

A string like `"=A1+B2"` is parsed where possible so it still evaluates, but it
is not the recommended path — it is exactly the thing that breaks when a row is
inserted. Use references.

## What happens after you hand the file over

Exported ranges are ordinary A1 ranges, not Excel Tables. That decides what a
recipient can safely do:

| They do this in Excel | Ranges follow? |
| --- | --- |
| Insert a row **inside** the data | **Yes** — Excel rewrites `B2:B13` to `B2:B14` |
| Change a value | Yes, everything recalculates |
| **Append** a row below the last | **No** — the range still ends where it did |
| Delete a row inside the data | Yes |

So "insert a row above the total" is safe advice; "add new rows at the bottom" is
not. If a workbook invites the reader to add rows, say where.

Adding rows in the *source* is always safe — that is what the framework is for,
and every reference re-resolves on the next build.

## Cycles

A circular reference is reported with every participating cell. Break it in the
source; there is no iterative-calculation mode.
