# open-sheet.dev

The landing page. One static file, no runtime framework.

```bash
pnpm --filter @open-sheet/web build   # writes dist/
pnpm --filter @open-sheet/web dev     # builds and serves it on :4173
```

## The sheet on the page is not a screenshot

`build.mjs` compiles `sheet.mjs` with the framework the page is advertising and
inlines the real HTML export. The code shown beside it is lifted out of that
same file, from between the `#region shown` markers.

So the example cannot drift from the API, and the version badge cannot drift
from what is published — it is read from `packages/core/package.json` at build
time. A landing page that has quietly fallen behind its own release is worse
than no landing page.

## Deploying

Cloudflare Pages, with the repository connected:

| | |
| --- | --- |
| Build command | `pnpm install && pnpm --filter @open-sheet/web build` |
| Output directory | `apps/web/dist` |
| Node version | 22 |

`public/` is copied into `dist/` as-is, which is where `_headers` comes from.
