import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { discoverSheets } from '../cli/discover.js'
import { compile } from '../compile/compile.js'
import { toCsv } from '../export/csv.js'
import { toHtml } from '../export/html.js'
import { XlsxWriter } from '../export/xlsx.js'
import { evaluateWorkbook } from '../formula/evaluate.js'
import type { ResolvedConfig } from '../vite/config.js'

export type ModuleLoader = (
  file: string,
) => Promise<{ default: unknown; meta?: { title?: string } }>

export interface WorkbookSummary {
  id: string
  file: string
  title: string
}

export interface WorkbookSource {
  id: string
  file: string
  source: string
  /** Pass back on write; a mismatch means someone else changed the file first. */
  hash: string
}

export class StaleWriteError extends Error {
  readonly status = 409
  constructor(id: string) {
    super(
      `"${id}" changed since you read it. Re-read the workbook, apply your edit to the ` +
        'current content, and write again.',
    )
    this.name = 'StaleWriteError'
  }
}

export class NotFoundError extends Error {
  readonly status = 404
  constructor(id: string, known: readonly string[]) {
    super(`no workbook "${id}"${known.length ? ` (known: ${known.join(', ')})` : ''}`)
    this.name = 'NotFoundError'
  }
}

function hashOf(source: string): string {
  return createHash('sha256').update(source).digest('hex').slice(0, 16)
}

function fileFor(config: ResolvedConfig, id: string): string {
  const found = discoverSheets(config.root, config.sheetsDir)
  const match = found.find((entry) => entry.id === id)
  if (!match)
    throw new NotFoundError(
      id,
      found.map((entry) => entry.id),
    )
  return match.file
}

export function listWorkbooks(config: ResolvedConfig, loader?: ModuleLoader): WorkbookSummary[] {
  void loader
  return discoverSheets(config.root, config.sheetsDir).map(({ id, file }) => ({
    id,
    file,
    title: id,
  }))
}

export function readWorkbook(config: ResolvedConfig, id: string): WorkbookSource {
  const file = fileFor(config, id)
  const source = readFileSync(file, 'utf8')
  return { id, file, source, hash: hashOf(source) }
}

export function writeWorkbook(
  config: ResolvedConfig,
  id: string,
  source: string,
  baseHash?: string,
): WorkbookSource {
  const current = readWorkbook(config, id)
  if (baseHash !== undefined && baseHash !== current.hash) throw new StaleWriteError(id)
  writeFileSync(current.file, source, 'utf8')
  return { id, file: current.file, source, hash: hashOf(source) }
}

export interface CurrentPosition {
  id?: string
  sheet?: string
  cell?: string
  updatedAt: string
}

function currentPath(config: ResolvedConfig): string {
  return join(config.root, 'node_modules', '.open-sheet', 'current.json')
}

/**
 * Published so `/current-sheet` can answer "the one you are looking at" instead
 * of the agent having to ask which workbook was meant.
 */
export function setCurrent(
  config: ResolvedConfig,
  position: Omit<CurrentPosition, 'updatedAt'>,
  now: string,
): CurrentPosition {
  const record: CurrentPosition = { ...position, updatedAt: now }
  const path = currentPath(config)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(record, null, 2))
  return record
}

export function getCurrent(config: ResolvedConfig): CurrentPosition | undefined {
  try {
    return JSON.parse(readFileSync(currentPath(config), 'utf8')) as CurrentPosition
  } catch {
    return undefined
  }
}

export type ExportFormat = 'xlsx' | 'csv' | 'html'

export interface ExportResult {
  filename: string
  contentType: string
  body: Buffer | string
}

export async function exportWorkbook(
  config: ResolvedConfig,
  id: string,
  format: ExportFormat,
  loader: ModuleLoader,
): Promise<ExportResult> {
  const file = fileFor(config, id)
  const module = await loader(file)
  const book = compile(module.default)
  const values = evaluateWorkbook(book)
  const title = module.meta?.title ?? id

  if (format === 'xlsx') {
    return {
      filename: `${id}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: await new XlsxWriter().write(book, { values }),
    }
  }
  if (format === 'html') {
    return {
      filename: `${id}.html`,
      contentType: 'text/html; charset=utf-8',
      body: toHtml(book, { title, values }),
    }
  }
  const sheet = book.sheets[0]
  if (!sheet) throw new Error(`"${id}" has no sheets to export`)
  return {
    filename: `${id}.csv`,
    contentType: 'text/csv; charset=utf-8',
    body: toCsv(sheet, values),
  }
}
