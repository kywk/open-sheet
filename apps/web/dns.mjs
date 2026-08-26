/**
 * Points open-sheet.dev at Cloudflare and clears what GoDaddy left behind.
 *
 *   node dns.mjs            # says what it would do, changes nothing
 *   node dns.mjs --apply    # does it
 *
 * Needs CLOUDFLARE_API_TOKEN with Zone:Read and DNS:Edit. Set it in your own
 * shell; it is never read from a file here and never printed.
 */
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const ZONE = process.env.ZONE ?? 'open-sheet.dev'
const APPLY = process.argv.includes('--apply')

if (!TOKEN) {
  console.error('CLOUDFLARE_API_TOKEN is not set.')
  console.error('Create one at dash.cloudflare.com → My Profile → API Tokens with')
  console.error('Zone:Read and DNS:Edit, then: export CLOUDFLARE_API_TOKEN=...')
  process.exit(1)
}

async function cf(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const body = await response.json()
  if (!body.success) {
    const why = (body.errors ?? []).map((e) => `${e.code} ${e.message}`).join('; ')
    throw new Error(`${init.method ?? 'GET'} ${path} — ${why || response.status}`)
  }
  return body.result
}

/**
 * Everything GoDaddy points at its own parking page and its own setup wizard.
 * Named rather than matched loosely: deleting a record the owner meant to keep
 * is not a mistake DNS lets you take back quickly.
 */
const PARKING_IPS = new Set(['76.223.105.230', '13.248.243.5'])
const PARKING_CNAMES = new Set(['_domainconnect.gd.domaincontrol.com'])

/**
 * The domain does not send mail, so say so in the three places a receiver
 * looks. Without these, anyone can send as @open-sheet.dev and it will pass.
 */
const MAIL_HARDENING = [
  { type: 'MX', name: ZONE, content: '.', priority: 0 },
  { type: 'TXT', name: ZONE, content: 'v=spf1 -all' },
  { type: 'TXT', name: `_dmarc.${ZONE}`, content: 'v=DMARC1; p=reject; adkim=s; aspf=s' },
]

const [zone] = await cf(`/zones?name=${ZONE}`)
if (!zone) {
  console.error(`${ZONE} is not in this Cloudflare account yet.`)
  console.error('Add it at dash.cloudflare.com → Add a site, then run this again.')
  process.exit(1)
}

console.log(`zone ${ZONE} — status ${zone.status}`)
console.log('nameservers to set at GoDaddy:')
for (const ns of zone.name_servers ?? []) console.log(`  ${ns}`)
if (zone.status !== 'active') {
  console.log('(the zone stays "pending" until GoDaddy is pointing at those two)')
}
console.log()

const records = await cf(`/zones/${zone.id}/dns_records?per_page=200`)

const doomed = records.filter(
  (r) =>
    (r.type === 'A' && PARKING_IPS.has(r.content)) ||
    (r.type === 'CNAME' && PARKING_CNAMES.has(r.content)) ||
    (r.type === 'TXT' && r.name === `_dmarc.${ZONE}` && r.content.includes('onsecureserver.net')),
)

for (const record of doomed) {
  console.log(`delete  ${record.type.padEnd(5)} ${record.name} → ${record.content}`)
  if (APPLY) await cf(`/zones/${zone.id}/dns_records/${record.id}`, { method: 'DELETE' })
}

for (const wanted of MAIL_HARDENING) {
  const existing = records.find(
    (r) => r.type === wanted.type && r.name === wanted.name && r.content === wanted.content,
  )
  if (existing) {
    console.log(`keep    ${wanted.type.padEnd(5)} ${wanted.name} → ${wanted.content}`)
    continue
  }
  console.log(`create  ${wanted.type.padEnd(5)} ${wanted.name} → ${wanted.content}`)
  if (APPLY) {
    await cf(`/zones/${zone.id}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({ ttl: 1, ...wanted }),
    })
  }
}

const survivors = records.filter((r) => !doomed.includes(r))
if (survivors.length > 0) {
  console.log('\nleft alone:')
  for (const r of survivors) {
    console.log(`  ${r.type.padEnd(5)} ${r.name} → ${String(r.content).slice(0, 60)}`)
  }
}

console.log(
  APPLY
    ? '\ndone. Cloudflare Pages adds the A/CNAME for the site itself when you attach the domain.'
    : '\nnothing changed — re-run with --apply',
)
