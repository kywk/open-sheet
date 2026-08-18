import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compile } from '../compile/compile.js'
import { budget } from '../compile/fixtures.js'
import { evaluateWorkbook } from '../formula/evaluate.js'
import { isExcelError, isNotEvaluated } from '../formula/value.js'
import { parseCellKey } from '../model/cell.js'
import { XlsxWriter } from './xlsx.js'

const SOFFICE = ['/opt/homebrew/bin/soffice', '/usr/bin/soffice', '/usr/bin/libreoffice'].find(
  (path) => existsSync(path),
)

/**
 * Field 9 is "save cell contents as shown" — it must be false, or LibreOffice
 * writes the *formatted* value (0.6029… under a 0.0% format becomes "60.3%") and
 * the comparison measures our number formats instead of its arithmetic.
 * Field 12 is -1: export every sheet, each to its own file.
 */
const CSV_ALL_SHEETS =
  'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1'

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') field += ch
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/**
 * The check the whole project rests on: LibreOffice opens the exported workbook,
 * recalculates the formulas we wrote, and its numbers must match the ones our
 * own evaluator produced. A failure means either the export baked values instead
 * of formulas, or our evaluator disagrees with a real spreadsheet engine.
 */
describe.skipIf(!SOFFICE)('cross-engine recalculation', () => {
  it('LibreOffice agrees with our evaluator', { timeout: 180_000 }, async () => {
    const book = compile(budget())
    const values = evaluateWorkbook(book)
    const buffer = await new XlsxWriter().write(book, { values })

    const dir = mkdtempSync(join(tmpdir(), 'open-sheet-recalc-'))
    const xlsx = join(dir, 'fixture.xlsx')
    writeFileSync(xlsx, buffer)

    execFileSync(
      SOFFICE as string,
      [
        `-env:UserInstallation=file://${join(dir, 'profile')}`,
        '--headless',
        '--convert-to',
        CSV_ALL_SHEETS,
        '--outdir',
        dir,
        xlsx,
      ],
      { stdio: 'pipe', timeout: 150_000 },
    )

    const produced = readdirSync(dir).filter((f) => f.endsWith('.csv'))
    expect(produced.length).toBeGreaterThan(0)

    const bySheet = new Map<string, string[][]>()
    for (const file of produced) {
      const name = file.replace(/^fixture-?/, '').replace(/\.csv$/, '')
      bySheet.set(name, parseCsv(readFileSync(join(dir, file), 'utf8')))
    }

    let compared = 0
    const skipped: string[] = []

    for (const sheet of book.sheets) {
      const grid =
        bySheet.get(sheet.name) ?? (bySheet.size === 1 ? [...bySheet.values()][0] : undefined)
      if (!grid) {
        skipped.push(`whole sheet ${sheet.name} (no csv produced)`)
        continue
      }
      for (const [key, cell] of sheet.cells) {
        if (!cell.expr) continue
        const ours = values.get(`${sheet.name}!${key}`)
        if (ours === undefined || isNotEvaluated(ours)) {
          skipped.push(`${sheet.name}!${key} (#NOT_EVALUATED)`)
          continue
        }
        if (isExcelError(ours) || typeof ours !== 'number') continue

        const { r, c } = parseCellKey(key)
        const raw = grid[r]?.[c]
        expect(raw, `${sheet.name} r${r} c${c} missing from LibreOffice output`).toBeDefined()

        const theirs = Number(String(raw).replace(/[,%\s]/g, ''))
        expect(Number.isNaN(theirs), `${sheet.name} r${r} c${c} not numeric: "${raw}"`).toBe(false)

        const scale = String(raw).includes('%') ? 100 : 1
        expect(theirs / scale, `${sheet.name} r${r} c${c}`).toBeCloseTo(ours, 6)
        compared += 1
      }
    }

    expect(compared, 'no formula cells were compared — the check proved nothing').toBeGreaterThan(5)
    if (skipped.length)
      console.info(`recalc: skipped ${skipped.length} cell(s):`, skipped.join(', '))
  })
})
