import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { compile } from '../compile/compile.js'
import { toCsv } from '../export/csv.js'
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
}

export interface BuildResult {
  id: string
  title: string
  files: string[]
  notEvaluated: number
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
      const xlsx = join(outDir, `${id}.xlsx`)
      writeFileSync(xlsx, await writer.write(book, { values }))
      files.push(xlsx)

      if (options.csv !== false) {
        for (const sheet of book.sheets) {
          const csv = join(outDir, `${id}.${safe(sheet.name)}.csv`)
          writeFileSync(csv, toCsv(sheet, values))
          files.push(csv)
        }
      }

      results.push({ id, title: module.meta?.title ?? id, files, notEvaluated })
    }
  } finally {
    await loader.close()
  }

  return results
}

function safe(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '')
}
