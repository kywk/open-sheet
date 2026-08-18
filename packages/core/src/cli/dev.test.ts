import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { dev } from './dev.js'

const WORKBOOK = `import { Cell, Sheet, Stack, Table, Workbook, col, ref, sum } from '@open-sheet/core'

export const meta = { title: 'Smoke Test' }

export default (
  <Workbook>
    <Sheet name="Data">
      <Stack gap={1}>
        <Table
          name="rows"
          data={[{ n: 1 }, { n: 2 }, { n: 3 }]}
          columns={[col('n', { header: 'N' })]}
          total={{ n: 'sum' }}
        />
        <Cell formula={sum(ref('rows').column('n'))} />
      </Stack>
    </Sheet>
  </Workbook>
)
`

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'open-sheet-dev-'))
  mkdirSync(join(root, 'sheets', 'smoke'), { recursive: true })
  writeFileSync(join(root, 'sheets', 'smoke', 'index.tsx'), WORKBOOK)
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'smoke-workspace', private: true, type: 'module' }),
  )

  // Stand in for a real install, so workbooks resolve @open-sheet/core by name.
  const corePackage = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  mkdirSync(join(root, 'node_modules', '@open-sheet'), { recursive: true })
  symlinkSync(corePackage, join(root, 'node_modules', '@open-sheet', 'core'), 'dir')

  return root
}

/**
 * The component tests render against a stubbed manifest. This one boots the real
 * server so the parts only it can break — virtual-module discovery, JSX pragma
 * injection, /@fs resolution, symlinked roots — are actually exercised.
 *
 * Deliberately one test rather than a suite sharing a `beforeAll` server, and
 * the shutdown is time-boxed — see the note in the `finally` block.
 */
describe('the dev server', () => {
  it('serves the viewer, the manifest, and the API', { timeout: 120_000 }, async () => {
    const server = await dev({ root: workspace(), port: 5391, watch: false })
    const base = server.url.replace(/\/$/, '')

    try {
      const shell = await fetch(`${base}/`)
      const html = await shell.text()
      expect(shell.status, 'viewer shell').toBe(200)
      expect(html).toContain('<div id="root">')
      expect(html).toMatch(/src="\/@fs.*main\.tsx"/)

      const manifest = await (await fetch(`${base}/@id/__x00__virtual:open-sheet/manifest`)).text()
      expect(manifest, 'virtual manifest lists the workbook').toContain('"smoke"')
      expect(manifest).toContain('import(')

      const module = await (await fetch(`${base}/sheets/smoke/index.tsx`)).text()
      expect(module, 'jsx pragma injected').toContain('@jsxImportSource @open-sheet/core')
      expect(module, 'workbook must not compile against React').not.toMatch(
        /from ["'][^"']*react\/jsx/,
      )

      const listed = (await (await fetch(`${base}/__open-sheet/api/workbooks`)).json()) as {
        workbooks: { id: string }[]
      }
      expect(listed.workbooks.map((w) => w.id)).toEqual(['smoke'])

      const exported = await fetch(`${base}/__open-sheet/api/export?id=smoke&format=xlsx`)
      expect(exported.status, 'xlsx export').toBe(200)
      expect(exported.headers.get('content-type')).toContain('spreadsheetml')
      expect((await exported.arrayBuffer()).byteLength).toBeGreaterThan(2000)

      await (
        await fetch(`${base}/__open-sheet/api/current`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 'smoke', sheet: 'Data', cell: 'B4' }),
        })
      ).text()
      const current = (await (await fetch(`${base}/__open-sheet/api/current`)).json()) as {
        id: string
        cell: string
      }
      expect(current, 'current position published for /current-sheet').toMatchObject({
        id: 'smoke',
        cell: 'B4',
      })

      const read = (await (await fetch(`${base}/__open-sheet/api/source?id=smoke`)).json()) as {
        source: string
      }
      const stale = await fetch(`${base}/__open-sheet/api/source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'smoke', source: '// nope', hash: 'stale-hash' }),
      })
      await stale.text()
      expect(stale.status, 'stale write refused').toBe(409)
      expect(read.source).toContain('Smoke Test')

      const missing = await fetch(`${base}/__open-sheet/api/source?id=nope`)
      const error = (await missing.json()) as { error: string }
      expect(missing.status).toBe(404)
      expect(error.error, 'unknown id names what is available').toContain('known: smoke')
    } finally {
      // A Vite dev server driven from inside vitest does not always finish
      // shutting down — measured at over 60s against ~95ms for the same server
      // closed from a plain script. The worker exits and reclaims the port
      // either way, so the suite must not wait on it.
      await Promise.race([server.close(), new Promise((done) => setTimeout(done, 2_000))])
    }
  })
})
