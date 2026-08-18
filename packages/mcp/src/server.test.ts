import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { compile, createLoader, evaluateWorkbook, resolveConfig } from '@open-sheet/core'
import { afterEach, describe, expect, it } from 'vitest'
import { reportSheet } from './grid.js'
import { createServer } from './server.js'

const WORKBOOK = `import { Sheet, Table, Workbook, col, mul, ref, sub } from '@open-sheet/core'

export const meta = { title: 'Unit Economics' }

export default (
  <Workbook>
    <Sheet name="Assumptions">
      <Table name="assume" kind="keyValue" data={[
        { key: 'price', label: 'Price', value: 50 },
        { key: 'cost', label: 'Cost', value: 20 },
      ]} />
    </Sheet>
    <Sheet name="Model">
      <Table
        name="units"
        data={[{ n: 10 }, { n: 20 }]}
        columns={[
          col('n', { header: 'Units' }),
          col('revenue', { header: 'Revenue', formula: (r) => mul(r.cell('n'), ref('assume').get('price')) }),
          col('margin', {
            header: 'Margin',
            formula: (r) => mul(r.cell('n'), sub(ref('assume').get('price'), ref('assume').get('cost'))),
          }),
        ]}
        total={{ revenue: 'sum', margin: 'sum' }}
      />
    </Sheet>
  </Workbook>
)
`

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'open-sheet-mcp-'))
  mkdirSync(join(root, 'sheets', 'unit-economics'), { recursive: true })
  writeFileSync(join(root, 'sheets', 'unit-economics', 'index.tsx'), WORKBOOK)
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'w', type: 'module' }))

  // Stand in for a real install, so workbooks resolve @open-sheet/core by name.
  const core = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'core')
  mkdirSync(join(root, 'node_modules', '@open-sheet'), { recursive: true })
  symlinkSync(core, join(root, 'node_modules', '@open-sheet', 'core'), 'dir')

  return root
}

const loaders: { close: () => Promise<void> }[] = []

async function connect(root: string) {
  const config = resolveConfig(root)
  const loader = await createLoader(root)
  loaders.push(loader)

  const server = createServer({ config, loader: loader.load })
  const client = new Client({ name: 'test', version: '1' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { client, config }
}

function payload(result: unknown): any {
  const content = (result as { content: { text: string }[] }).content[0]
  return JSON.parse(content?.text ?? '{}')
}

afterEach(async () => {
  while (loaders.length) await loaders.pop()?.close()
})

describe('the MCP server', () => {
  it('advertises the tools an agent needs', async () => {
    const { client } = await connect(workspace())
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'current_position',
      'describe_workbook',
      'export_workbook',
      'list_workbooks',
      'read_sheet',
      'read_workbook',
      'write_workbook',
    ])
  })

  it('describes the vocabulary ref() accepts', async () => {
    const { client } = await connect(workspace())
    const result = payload(
      await client.callTool({ name: 'describe_workbook', arguments: { id: 'unit-economics' } }),
    )

    expect(result.title).toBe('Unit Economics')
    expect(result.definedNames).toEqual(['price', 'cost'])
    const table = result.blocks.find((b: { name: string }) => b.name === 'units')
    expect(table.columns).toEqual(['n', 'revenue', 'margin'])
    expect(table.hasTotal).toBe(true)
  })

  it('returns resolved formulas and computed values together', async () => {
    const { client } = await connect(workspace())
    const result = payload(
      await client.callTool({
        name: 'read_sheet',
        arguments: { id: 'unit-economics', sheet: 'Model' },
      }),
    )

    const first = result.cells.find((c: { address: string }) => c.address === 'B2')
    expect(first.formula).toBe('=A2*price')
    expect(first.value).toBe('500')

    const second = result.cells.find((c: { address: string }) => c.address === 'B3')
    expect(second.formula).toBe('=A3*price')
    expect(second.value).toBe('1000')

    // A cross-sheet assumption resolves to its defined name, not an address.
    const margin = result.cells.find((c: { address: string }) => c.address === 'C2')
    expect(margin.formula).toBe('=A2*(price-cost)')
  })

  it('refuses a stale write rather than overwriting', async () => {
    const { client } = await connect(workspace())
    const read = payload(
      await client.callTool({ name: 'read_workbook', arguments: { id: 'unit-economics' } }),
    )
    expect(read.hash).toMatch(/^[0-9a-f]{16}$/)

    const stale = await client.callTool({
      name: 'write_workbook',
      arguments: { id: 'unit-economics', source: '// nope', hash: 'not-the-hash' },
    })
    expect((stale as { isError?: boolean }).isError).toBe(true)
    expect((stale as { content: { text: string }[] }).content[0]?.text).toContain(
      'changed since you read it',
    )
  })

  it('accepts a write that carries the current hash', async () => {
    const { client } = await connect(workspace())
    const read = payload(
      await client.callTool({ name: 'read_workbook', arguments: { id: 'unit-economics' } }),
    )
    const written = payload(
      await client.callTool({
        name: 'write_workbook',
        arguments: {
          id: 'unit-economics',
          source: read.source.replace('value: 50', 'value: 60'),
          hash: read.hash,
        },
      }),
    )
    expect(written.hash).not.toBe(read.hash)
  })

  it('exports a live xlsx as base64', async () => {
    const { client } = await connect(workspace())
    const result = payload(
      await client.callTool({
        name: 'export_workbook',
        arguments: { id: 'unit-economics', format: 'xlsx' },
      }),
    )
    expect(result.filename).toBe('unit-economics.xlsx')
    expect(result.encoding).toBe('base64')
    expect(Buffer.from(result.body, 'base64').byteLength).toBeGreaterThan(2000)
  })

  it('reports an unknown workbook without throwing', async () => {
    const { client } = await connect(workspace())
    const result = await client.callTool({ name: 'read_workbook', arguments: { id: 'nope' } })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect((result as { content: { text: string }[] }).content[0]?.text).toContain(
      'known: unit-economics',
    )
  })
})

describe('the sheet report', () => {
  it('names the available sheets when one is missing', async () => {
    const root = workspace()
    const loader = await createLoader(root)
    loaders.push(loader)
    const module = await loader.load(join(root, 'sheets', 'unit-economics', 'index.tsx'))
    const book = compile(module.default)
    expect(() => reportSheet(book, evaluateWorkbook(book), 'Nope')).toThrow(
      /sheets: Assumptions, Model/,
    )
  })
})
