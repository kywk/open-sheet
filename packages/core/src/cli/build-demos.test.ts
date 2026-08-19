import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { build } from './build.js'

const demoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'apps',
  'demo',
)

/**
 * The gallery is also the integration test: every demo has to compile, evaluate,
 * and export. A workbook that only works in the viewer is not shippable.
 */
describe.skipIf(!existsSync(join(demoRoot, 'sheets')))('the demo workbooks', () => {
  it('all compile and export', { timeout: 120_000 }, async () => {
    const out = mkdtempSync(join(tmpdir(), 'open-sheet-demos-'))
    const results = await build({ root: demoRoot, out })

    expect(results.length).toBeGreaterThanOrEqual(5)
    for (const result of results) {
      expect(
        result.files.some((f) => f.endsWith('.xlsx')),
        `${result.id} xlsx`,
      ).toBe(true)
      expect(result.notEvaluated, `${result.id} has uncomputed cells`).toBe(0)
    }
  })

  it('gives every sheet its own csv, whatever script it is named in', async () => {
    const out = mkdtempSync(join(tmpdir(), 'open-sheet-demos-'))
    const results = await build({ root: demoRoot, out })

    const quotation = results.find((r) => r.id === 'tw-quotation')
    expect(quotation, 'the Chinese-language demo').toBeDefined()

    const csvs = (quotation as { files: string[] }).files.filter((f) => f.endsWith('.csv'))
    expect(csvs).toHaveLength(2)
    // Stripping to ASCII collapsed both sheet names to '', so one silently
    // overwrote the other. Distinct names, and both files present.
    expect(new Set(csvs).size).toBe(2)
    for (const csv of csvs) expect(existsSync(csv)).toBe(true)
    expect(readdirSync(out).filter((f) => f.startsWith('tw-quotation.')).length).toBe(3)
  })
})
