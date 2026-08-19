# Security

## Reporting a vulnerability

Please report privately through [GitHub's advisory
form](https://github.com/lianghsun/open-sheet/security/advisories/new) rather
than in a public issue.

Expect an acknowledgement within a week.

## What open-sheet does with your files

The dev server reads and writes files **inside your workspace only** — the
directories named in `open-sheet.config.ts`, plus the framework's own package
directory, which Vite needs to serve the viewer. It binds to localhost by default.

Two things worth knowing:

- **`open-sheet dev` executes your workbook source**, because compiling a
  workbook means running its TypeScript. Treat a workbook file the way you treat
  any other code in your repository.
- **`--host` exposes the dev server on your network.** It has no authentication,
  and its API can read and write files in the workspace. Use it on a network you
  trust, and not as a way to share a workbook — export one instead.

## Exported files

Exported workbooks contain formulas, values, and styles from your source. They
carry no telemetry and make no network requests.
