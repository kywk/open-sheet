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

## Aggregating across columns

`sum` and friends are variadic, not only range-takers. When months are columns
rather than rows — a matrix — this is how a row total is written:

```tsx
const MONTHS = [{ key: 'jan' }, { key: 'feb' }, { key: 'mar' }]

col('total', { formula: (r) => sum(...MONTHS.map((m) => r.cell(m.key))) })
```

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

## Cycles

A circular reference is reported with every participating cell. Break it in the
source; there is no iterative-calculation mode.
