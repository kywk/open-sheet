import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { dev } from './dev.js'

const WORKBOOK = `import { Cell, Sheet, Stack, Table, Workbook, col, mul, ref, sum } from '@open-sheet/core'

export const meta = { title: 'Smoke Test' }

const rows = [{ n: 1 }, { n: 2 }, { n: 3 }]

export default (
  <Workbook>
    <Sheet name="Data">
      <Stack gap={1}>
        <Table
          name="rows"
          data={rows}
          columns={[
            col('n', { header: 'N' }),
            col('doubled', { header: 'Doubled', formula: (r) => mul(r.cell('n'), 2) }),
          ]}
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

      // Inspect: the useful answer is which construct produced the cell, not its address.
      const inspected = (await (
        await fetch(`${base}/__open-sheet/api/inspect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 'smoke', sheet: 'Data', cell: 'A3' }),
        })
      ).json()) as {
        origin: { block: string; column: string; row: number }
        editable: boolean
        current: string
        location: string
      }
      expect(inspected.origin).toMatchObject({ block: 'rows', column: 'n', row: 1 })
      expect(inspected.editable, 'a literal data cell is editable').toBe(true)
      expect(inspected.current).toBe('2')
      expect(inspected.location).toMatch(/index\.tsx:\d+$/)

      // A computed column is not editable, and says what to change instead.
      const computed = (await (
        await fetch(`${base}/__open-sheet/api/inspect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 'smoke', sheet: 'Data', cell: 'B3' }),
        })
      ).json()) as { editable: boolean; formula: string; reason: string }
      expect(computed.editable).toBe(false)
      expect(computed.formula).toBe('=A3*2')
      expect(computed.reason).toContain('computed, not stored')

      // Edit: writes back into the array the value actually came from.
      const edited = await fetch(`${base}/__open-sheet/api/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'smoke',
          sheet: 'Data',
          cell: 'A3',
          value: '20',
          expected: '2',
        }),
      })
      const written = (await edited.json()) as { source: string }
      expect(edited.status).toBe(200)
      expect(written.source, 'the edited element').toContain('{ n: 20 }')
      expect(written.source, 'its neighbours untouched').toContain(
        '[{ n: 1 }, { n: 20 }, { n: 3 }]',
      )

      // Comment: stored where /apply-comments will find it.
      const commented = await fetch(`${base}/__open-sheet/api/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'smoke', sheet: 'Data', cell: 'A3', text: 'is this net?' }),
      })
      const withNote = (await commented.json()) as { source: string }
      expect(commented.status).toBe(200)
      expect(withNote.source).toContain('@sheet-comment')
      expect(withNote.source).toContain('is this net?')

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
