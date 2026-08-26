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

## Pointing open-sheet.dev at Cloudflare

Two of the steps are yours — they need a Cloudflare login and a GoDaddy login,
which nothing here has.

**1. Add the zone.** dash.cloudflare.com → Add a site → `open-sheet.dev`. It will
scan the existing records; take whatever it offers, the next step cleans up.

**2. Give this a token.** dash.cloudflare.com → My Profile → API Tokens → Create,
with `Zone:Read` and `DNS:Edit` on that zone. Then, in your own shell:

```bash
export CLOUDFLARE_API_TOKEN=...
node apps/web/dns.mjs            # says what it would do
node apps/web/dns.mjs --apply    # does it
```

It prints the two nameservers to set at GoDaddy, deletes what GoDaddy left
behind, and adds the mail hardening below. It is idempotent — running it twice
changes nothing the second time.

**3. Change the nameservers at GoDaddy** to the two it printed, replacing
`ns31/ns32.domaincontrol.com`. Only you can do this.

### What it deletes, and why

| Record | |
| --- | --- |
| `A → 76.223.105.230`, `A → 13.248.243.5` | GoDaddy's parking page |
| `CNAME _domainconnect` | GoDaddy's setup wizard; meaningless once the nameservers move |
| `TXT _dmarc` with `onsecureserver.net` | reports to GoDaddy's aggregator, which you cannot read |

### What it adds

The domain does not send mail, and saying so is what stops anyone sending as
`@open-sheet.dev`:

```
MX   @        .                                    priority 0   (RFC 7505 null MX)
TXT  @        v=spf1 -all
TXT  _dmarc   v=DMARC1; p=reject; adkim=s; aspf=s
```

Nothing else is touched — anything it does not recognise is listed and left
alone.
