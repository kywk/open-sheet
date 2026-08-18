import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
 * server so the parts only it can break — virtual-module discovery, the JSX
 * pragma injection, /@fs resolution — are actually exercised.
 */
describe('the dev server', () => {
  let server: Awaited<ReturnType<typeof dev>>
  let base: string

  beforeAll(async () => {
    server = await dev({ root: workspace(), port: 5391, watch: false })
    base = server.url.replace(/\/$/, '')
  }, 60_000)

  afterAll(async () => {
    await server?.close()
  }, 30_000)

  it('serves the viewer shell', async () => {
    const response = await fetch(`${base}/`)
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain('<div id="root">')
    expect(html).toMatch(/src="\/@fs.*main\.tsx"/)
  })

  it('generates the workbook manifest as a virtual module', async () => {
    const response = await fetch(`${base}/@id/__x00__virtual:open-sheet/manifest`)
    const code = await response.text()
    expect(response.status).toBe(200)
    expect(code).toContain('"smoke"')
    expect(code).toContain('import(')
  })

  it('injects the jsx pragma so workbooks compile against open-sheet, not React', async () => {
    const response = await fetch(`${base}/sheets/smoke/index.tsx`)
    const code = await response.text()
    expect(code).toContain('@jsxImportSource @open-sheet/core')
    expect(code).not.toMatch(/from ["'][^"']*react\/jsx/)
  })

  it('lists workbooks over the API', async () => {
    const response = await fetch(`${base}/__open-sheet/api/workbooks`)
    const body = (await response.json()) as { workbooks: { id: string }[] }
    expect(body.workbooks.map((w) => w.id)).toEqual(['smoke'])
  })

  it('exports a live xlsx over the API', async () => {
    const response = await fetch(`${base}/__open-sheet/api/export?id=smoke&format=xlsx`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('spreadsheetml')
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(2000)
  })

  it('reports where the reader is, for /current-sheet', async () => {
    await fetch(`${base}/__open-sheet/api/current`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'smoke', sheet: 'Data', cell: 'B4' }),
    })
    const response = await fetch(`${base}/__open-sheet/api/current`)
    const body = (await response.json()) as { id: string; cell: string }
    expect(body.id).toBe('smoke')
    expect(body.cell).toBe('B4')
  })

  it('refuses a stale write instead of clobbering', async () => {
    const read = await (await fetch(`${base}/__open-sheet/api/source?id=smoke`)).json()
    const response = await fetch(`${base}/__open-sheet/api/source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'smoke', source: '// nope', hash: 'stale-hash' }),
    })
    expect(response.status).toBe(409)
    expect((read as { source: string }).source).toContain('Smoke Test')
  })

  it('names the available workbooks when one is not found', async () => {
    const response = await fetch(`${base}/__open-sheet/api/source?id=nope`)
    expect(response.status).toBe(404)
    expect(((await response.json()) as { error: string }).error).toContain('known: smoke')
  })
})
