import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { compile } from '../compile/compile.js'
import { toCsv } from '../export/csv.js'
import { toHtml } from '../export/html.js'
import { PlaywrightMissingError, toPdf } from '../export/pdf.js'
import { XlsxWriter } from '../export/xlsx.js'
import { evaluateWorkbook } from '../formula/evaluate.js'
import { isNotEvaluated } from '../formula/value.js'
import { discoverSheets } from './discover.js'
import { createLoader } from './load.js'

export interface BuildOptions {
  root?: string
  out?: string
  sheetsDir?: string
  csv?: boolean
  html?: boolean
  pdf?: boolean
}

export interface BuildResult {
  id: string
  title: string
  files: string[]
  notEvaluated: number
  warnings: string[]
}

export async function build(options: BuildOptions = {}): Promise<BuildResult[]> {
  const root = resolve(options.root ?? process.cwd())
  const outDir = resolve(root, options.out ?? 'dist')
  const found = discoverSheets(root, options.sheetsDir ?? 'sheets')

  if (found.length === 0) {
    throw new Error(
      `no workbooks found under ${join(root, options.sheetsDir ?? 'sheets')}/<id>/index.tsx`,
    )
  }

  mkdirSync(outDir, { recursive: true })
  const loader = await createLoader(root)
  const writer = new XlsxWriter()
  const results: BuildResult[] = []

  try {
    for (const { id, file } of found) {
      const module = await loader.load(file)
      const book = compile(module.default)
      const values = evaluateWorkbook(book)

      let notEvaluated = 0
      for (const value of values.values()) if (isNotEvaluated(value)) notEvaluated += 1

      const files: string[] = []
      const warnings: string[] = []
      const title = module.meta?.title ?? id

      const xlsx = join(outDir, `${id}.xlsx`)
      writeFileSync(xlsx, await writer.write(book, { values }))
      files.push(xlsx)

      if (options.csv !== false) {
        const used = new Set<string>()
        book.sheets.forEach((sheet, index) => {
          let name = safe(sheet.name, index)
          if (used.has(name)) name = `${name}-${index + 1}`
          used.add(name)
          const csv = join(outDir, `${id}.${name}.csv`)
          writeFileSync(csv, toCsv(sheet, values))
          files.push(csv)
        })
      }

      if (options.html || options.pdf) {
        const html = join(outDir, `${id}.html`)
        writeFileSync(html, toHtml(book, { title, values }))
        files.push(html)
      }

      if (options.pdf) {
        try {
          const pdf = join(outDir, `${id}.pdf`)
          writeFileSync(pdf, await toPdf(book, { title, values }))
          files.push(pdf)
        } catch (error) {
          if (!(error instanceof PlaywrightMissingError)) throw error
          warnings.push(error.message)
        }
      }

      results.push({ id, title, files, notEvaluated, warnings })
    }
  } finally {
    await loader.close()
  }

  return results
}

/**
 * Keeps letters in any script. Stripping to ASCII collapsed every Chinese sheet
 * name to the empty string, so two sheets produced the same filename and one
 * silently overwrote the other. Only characters a filesystem objects to are
 * replaced, and an index is appended if a name still collides.
 */
function safe(name: string, index: number): string {
  const cleaned = name
    .replace(/[/\\:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
    .trim()
  return cleaned === '' ? `sheet-${index + 1}` : cleaned
}
