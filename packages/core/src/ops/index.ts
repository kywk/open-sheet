import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { discoverSheets } from '../cli/discover.js'
import type { WorkbookModule } from '../cli/load.js'
import { compile } from '../compile/compile.js'
import { type DesignPatch, editDesign, readDesignLiteral } from '../editing/design-edit.js'
import { addComment, editCell, NotEditableError } from '../editing/edit.js'
import { type CellOrigin, findEditTarget, originOf } from '../editing/locate.js'
import { toCsv } from '../export/csv.js'
import { toHtml } from '../export/html.js'
import { XlsxWriter } from '../export/xlsx.js'
import { evaluateWorkbook } from '../formula/evaluate.js'
import { toFormula } from '../formula/serialize.js'
import { display } from '../formula/value.js'
import { fromA1 } from '../model/a1.js'
import { cellKey } from '../model/cell.js'
import type { ResolvedConfig } from '../vite/config.js'

export type ModuleLoader = (file: string) => Promise<WorkbookModule>

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
  const book = compile(module.default, { design: module.design })
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

export interface InspectRequest {
  id: string
  sheet: string
  cell: string
}

export interface InspectResult {
  id: string
  file: string
  sheet: string
  cell: string
  hash: string
  origin?: CellOrigin
  formula?: string
  value?: string
  editable: boolean
  /** Present when the cell holds a literal — the current source text. */
  current?: string
  /** file:line of the construct that produced it. */
  location?: string
  reason?: string
}

export async function inspectCell(
  config: ResolvedConfig,
  request: InspectRequest,
  loader: ModuleLoader,
): Promise<InspectResult> {
  const source = readWorkbook(config, request.id)
  const module = await loader(source.file)
  const book = compile(module.default, { design: module.design })
  const values = evaluateWorkbook(book)

  const addr = fromA1(request.cell)
  const origin = originOf(book.registry, request.sheet, addr)

  const result: InspectResult = {
    id: request.id,
    file: source.file,
    sheet: request.sheet,
    cell: request.cell,
    hash: source.hash,
    editable: false,
  }
  if (!origin) {
    result.reason = 'this cell is not part of any block'
    return result
  }
  result.origin = origin

  const sheet = book.sheets.find((candidate) => candidate.name === request.sheet)
  const cell = sheet?.cells.get(cellKey(addr.r, addr.c))
  if (cell?.expr && sheet) {
    result.formula = toFormula(cell.expr, {
      registry: book.registry,
      definedNames: book.definedNames,
      sheet: sheet.name,
    })
  }
  const computed = cell?.expr
    ? values.get(`${request.sheet}!${cellKey(addr.r, addr.c)}`)
    : cell?.value
  result.value = display(computed ?? null)

  const target = findEditTarget(source.source, origin)
  result.editable = target.kind === 'literal'
  if (target.range) {
    result.current = target.range.text
    result.location = `${source.file}:${target.range.line}`
  }
  if (target.reason) result.reason = target.reason

  return result
}

export interface EditCellRequest extends InspectRequest {
  value: string
  expected?: string
  hash?: string
}

export async function editWorkbookCell(
  config: ResolvedConfig,
  request: EditCellRequest,
  loader: ModuleLoader,
): Promise<WorkbookSource> {
  const source = readWorkbook(config, request.id)
  if (request.hash !== undefined && request.hash !== source.hash)
    throw new StaleWriteError(request.id)

  const module = await loader(source.file)
  const book = compile(module.default, { design: module.design })
  const origin = originOf(book.registry, request.sheet, fromA1(request.cell))
  if (!origin) throw new NotEditableError('this cell is not part of any block')

  const next = editCell({
    source: source.source,
    origin,
    value: request.value,
    ...(request.expected === undefined ? {} : { expected: request.expected }),
  })
  return writeWorkbook(config, request.id, next, source.hash)
}

export interface CommentCellRequest extends InspectRequest {
  text: string
  hash?: string
}

export async function commentOnCell(
  config: ResolvedConfig,
  request: CommentCellRequest,
  loader: ModuleLoader,
): Promise<WorkbookSource> {
  const source = readWorkbook(config, request.id)
  if (request.hash !== undefined && request.hash !== source.hash)
    throw new StaleWriteError(request.id)

  const module = await loader(source.file)
  const book = compile(module.default, { design: module.design })
  const origin = originOf(book.registry, request.sheet, fromA1(request.cell))
  if (!origin) throw new NotEditableError('this cell is not part of any block')

  return writeWorkbook(
    config,
    request.id,
    addComment({ source: source.source, origin, text: request.text }),
    source.hash,
  )
}

export interface DesignResult {
  id: string
  hash: string
  design?: DesignPatch
  editable: boolean
  reason?: string
}

export function readDesign(config: ResolvedConfig, id: string): DesignResult {
  const source = readWorkbook(config, id)
  const design = readDesignLiteral(source.source)
  const result: DesignResult = { id, hash: source.hash, editable: design !== undefined }
  if (design) result.design = design
  else result.reason = 'this workbook has no `export const design = { … }` literal to tweak'
  return result
}

export function writeDesign(
  config: ResolvedConfig,
  id: string,
  patch: DesignPatch,
  hash?: string,
): WorkbookSource {
  const source = readWorkbook(config, id)
  if (hash !== undefined && hash !== source.hash) throw new StaleWriteError(id)
  return writeWorkbook(config, id, editDesign(source.source, patch), source.hash)
}
