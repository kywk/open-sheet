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
 *
 * The comment form depends on where it lands. A `<Table>` lives in JSX children,
 * where `//` is not a comment at all — it is a bare text node, and the workbook
 * stops compiling with an error that looks unrelated to leaving a note. JSX
 * positions get `{/* … *\/}`; a JS position, such as beside a `col()` inside a
 * `columns={[…]}` array, keeps `//`.
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
  const label = `${COMMENT_MARKER} (${where}): ${body}`
  const comment = inJsxChildren(ast, element)
    ? `${indent}{/* ${label} */}\n`
    : `${indent}// ${label}\n`

  return request.source.slice(0, lineStart) + comment + request.source.slice(lineStart)
}

/** True when the element sits among another element's children, not in an expression. */
function inJsxChildren(ast: Node, element: Node): boolean {
  let found = false
  walkNodes(ast, (node) => {
    if (found || node.type !== 'JSXElement') return
    for (const child of node.children ?? []) {
      if (child === element) found = true
    }
  })
  return found
}

type Node = Record<string, any>

function walkNodes(node: Node | Node[] | null | undefined, visit: (node: Node) => void): void {
  if (!node) return
  if (Array.isArray(node)) {
    for (const child of node) walkNodes(child, visit)
    return
  }
  if (typeof node.type !== 'string') return
  visit(node)
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key.endsWith('Comments')) continue
    const value = node[key]
    if (value && typeof value === 'object') walkNodes(value as Node, visit)
  }
}

function describe(origin: CellOrigin): string {
  // The block name matters: one data array can feed two tables, and without it
  // "column v, row 2" does not say which. Position in the file is not enough —
  // it stops being evidence the moment someone moves the code.
  const block = `"${origin.block}"`
  if (origin.column === undefined) return `${block} ${origin.part}`
  if (origin.part === 'data' && origin.row !== undefined) {
    return `${block} column "${origin.column}", row ${origin.row + 1}`
  }
  return `${block} column "${origin.column}", ${origin.part}`
}

export function listComments(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
  source.split('\n').forEach((line, index) => {
    const at = line.indexOf(COMMENT_MARKER)
    if (at === -1) return
    const text = line
      .slice(at + COMMENT_MARKER.length)
      .replace(/\*\/\}?\s*$/, '')
      .replace(/^\W+/, '')
      .trim()
    out.push({ line: index + 1, text })
  })
  return out
}
