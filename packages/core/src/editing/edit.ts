import { type CellOrigin, findBlockElement, findEditTarget, parseWorkbook } from './locate.js'

export class NotEditableError extends Error {
  readonly status = 422
  constructor(reason: string) {
    super(reason)
    this.name = 'NotEditableError'
  }
}

export class ChangedUnderfootError extends Error {
  readonly status = 409
  constructor(expected: string, actual: string) {
    super(
      `the cell held \`${actual}\`, not \`${expected}\` — the file changed since you read it. ` +
        'Re-read the workbook and try again.',
    )
    this.name = 'ChangedUnderfootError'
  }
}

export interface EditRequest {
  source: string
  origin: CellOrigin
  /** New value, as it should appear in source: `42`, `'text'`, `0.08`. */
  value: string
  /** What the client believed was there. Checked before writing. */
  expected?: string
}

/**
 * Splices the new value into the original text rather than regenerating from the
 * AST. Regeneration would reformat the whole file, turning a one-cell edit into
 * a diff nobody can review.
 */
export function editCell(request: EditRequest): string {
  const target = findEditTarget(request.source, request.origin)

  if (target.kind !== 'literal' || !target.range) {
    throw new NotEditableError(target.reason ?? 'this cell is not directly editable')
  }

  if (request.expected !== undefined && target.range.text.trim() !== request.expected.trim()) {
    throw new ChangedUnderfootError(request.expected, target.range.text)
  }

  return (
    request.source.slice(0, target.range.start) +
    request.value +
    request.source.slice(target.range.end)
  )
}

export const COMMENT_MARKER = '@sheet-comment'

export interface CommentRequest {
  source: string
  origin: CellOrigin
  text: string
}

/**
 * Notes are stored in the source next to the construct they are about, so
 * `/apply-comments` finds them with the context needed to act on them.
 */
export function addComment(request: CommentRequest): string {
  const ast = parseWorkbook(request.source)
  const element = findBlockElement(ast, request.source, request.origin.block)
  if (!element) {
    throw new NotEditableError(`no <Table name="${request.origin.block}"> found`)
  }

  const start = element.start as number
  const lineStart = request.source.lastIndexOf('\n', start - 1) + 1
  const indent = /^[ \t]*/.exec(request.source.slice(lineStart, start))?.[0] ?? ''

  const where = describe(request.origin)
  const body = request.text.replace(/\s+/g, ' ').trim()
  const comment = `${indent}// ${COMMENT_MARKER}${where ? ` (${where})` : ''}: ${body}\n`

  return request.source.slice(0, lineStart) + comment + request.source.slice(lineStart)
}

function describe(origin: CellOrigin): string {
  if (origin.column === undefined) return origin.part
  if (origin.part === 'data' && origin.row !== undefined) {
    return `column "${origin.column}", row ${origin.row + 1}`
  }
  return `column "${origin.column}", ${origin.part}`
}

export function listComments(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
  source.split('\n').forEach((line, index) => {
    const at = line.indexOf(COMMENT_MARKER)
    if (at === -1) return
    out.push({ line: index + 1, text: line.slice(at + COMMENT_MARKER.length).replace(/^\W+/, '') })
  })
  return out
}
