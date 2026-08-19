# Changesets

A changeset is required for any change to `packages/core`, `packages/cli`, or
`packages/mcp`. Apps and root tooling are exempt.

```bash
pnpm changeset          # pick the packages and the bump, write one line
```

The three packages are **fixed together**: `@open-sheet/cli` scaffolds a
workspace pinned to a `@open-sheet/core` version, and `@open-sheet/mcp` calls
into core's ops. Versioning them independently would let a scaffolded workspace
pair a CLI with a core it was never tested against.

Write the description the way a user reads a changelog: present tense, about the
change rather than the code.

> Data bars now emit a native Excel rule, so they rescale when the numbers change.

not

> Added conditionalFormats to CompiledSheet and wired it through XlsxWriter.
