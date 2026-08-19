# Contributing

## Setup

```bash
pnpm install
pnpm dev        # the demo workspace at http://localhost:5373
```

## What CI runs

```bash
pnpm check      # biome: format, lint, organize imports
pnpm typecheck  # tsc across the workspace graph
pnpm test       # vitest
```

A second job installs LibreOffice and runs the recalculation check. It exports a
workbook **without** cached formula results, recalculates it in LibreOffice, and
diffs the result against our own evaluator. If you touch `serialize()`,
`evaluate()`, or the xlsx writer, that is the test that matters.

## Changesets

Any change to `packages/core`, `packages/cli`, or `packages/mcp` needs one:

```bash
pnpm changeset
```

The three version together — see [.changeset/README.md](.changeset/README.md).

## The invariant

**No A1 address is ever authored by hand** — not in `apps/demo`, not in
fixtures, not in a test standing in for user code. Tests may *assert* on A1
output; they must not *write* it. The one exception is `raw()`, the deliberate
escape hatch.

A test fixture containing `=SUM(B2:B13)` written by a person is a fixture that
has stopped testing the thing this project exists for.

## Things worth knowing before you change them

- **Licenses.** `@open-sheet/core` ships MIT. Never add a GPL/AGPL dependency —
  that is why the formula engine is our own rather than HyperFormula. Check
  before adding anything to `core`; every dependency is install size for users.
- **Never invent a number.** If the evaluator cannot compute a cell it renders
  `#NOT_EVALUATED`. A plausible-looking wrong number in a financial model is the
  worst failure this project can have.
- **The compiler must not need a browser.** Sizes are discrete, so measurement
  is arithmetic. Export runs in Node; only PDF needs a browser.
- **Comments explain *why*.** Well-named code needs no narration; a hidden
  constraint or a non-obvious invariant does.

## Reporting

Bugs and features: the issue templates. Security: [SECURITY.md](SECURITY.md),
not the public tracker.
