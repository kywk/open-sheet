import { parse } from '@babel/parser'
import type { Registry, TableAnchor } from '../compile/registry.js'
import type { Addr } from '../model/geometry.js'

export interface CellOrigin {
  /** Name of the block that produced this cell. */
  block: string
  kind: 'table' | 'keyValue'
  /** Column key for a table cell, or the entry key for a key-value block. */
  column?: string
  /** Zero-based index within `data`, when the cell is a data row. */
  row?: number
  part: 'title' | 'header' | 'data' | 'total'
}

/**
 * Which authoring construct produced a given cell. The registry already records
 * where every named block landed, so this is a lookup rather than a search —
 * and it means the compiler stays free of source-location bookkeeping.
 */
export function originOf(registry: Registry, sheet: string, addr: Addr): CellOrigin | undefined {
  for (const anchor of registry.values()) {
    if (anchor.sheet !== sheet) continue
    const { rect } = anchor
    if (
      addr.r < rect.r ||
      addr.r >= rect.r + rect.rows ||
      addr.c < rect.c ||
      addr.c >= rect.c + rect.cols
    ) {
      continue
    }

    if (anchor.kind === 'keyValue') {
      for (const [key, at] of anchor.keys) {
        if (at.r === addr.r && at.c === addr.c) {
          return { block: anchor.name, kind: 'keyValue', column: key, part: 'data' }
        }
      }
      return { block: anchor.name, kind: 'keyValue', part: 'title' }
    }

    const table = anchor as TableAnchor
    let column: string | undefined
    for (const [key, index] of table.columns) if (index === addr.c) column = key

    if (table.titleRow === addr.r) return { block: table.name, kind: 'table', part: 'title' }
    if (table.headerRow === addr.r) {
      return column
        ? { block: table.name, kind: 'table', column, part: 'header' }
        : { block: table.name, kind: 'table', part: 'header' }
    }
    if (table.totalRow === addr.r) {
      return column
        ? { block: table.name, kind: 'table', column, part: 'total' }
        : { block: table.name, kind: 'table', part: 'total' }
    }
    if (addr.r >= table.firstDataRow && addr.r <= table.lastDataRow && column) {
      return {
        block: table.name,
        kind: 'table',
        column,
        row: addr.r - table.firstDataRow,
        part: 'data',
      }
    }
    return { block: table.name, kind: 'table', part: 'data' }
  }
  return undefined
}

export interface SourceRange {
  start: number
  end: number
  line: number
  column: number
  text: string
}

type Node = Record<string, any>

function walk(node: Node | Node[] | null | undefined, visit: (node: Node) => void): void {
  if (!node) return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  if (typeof node.type !== 'string') return
  visit(node)
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue
    const value = (node as Node)[key]
    if (value && typeof value === 'object') walk(value as Node, visit)
  }
}

export function parseWorkbook(source: string): Node {
  return parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    ranges: true,
  }) as unknown as Node
}

function range(source: string, node: Node): SourceRange {
  return {
    start: node.start as number,
    end: node.end as number,
    line: node.loc?.start?.line ?? 0,
    column: node.loc?.start?.column ?? 0,
    text: source.slice(node.start as number, node.end as number),
  }
}

function jsxName(node: Node): string | undefined {
  const name = node.openingElement?.name
  return name?.type === 'JSXIdentifier' ? (name.name as string) : undefined
}

function attribute(element: Node, name: string): Node | undefined {
  for (const attr of element.openingElement?.attributes ?? []) {
    if (attr.type === 'JSXAttribute' && attr.name?.name === name) return attr as Node
  }
  return undefined
}

function stringOf(attr: Node | undefined): string | undefined {
  if (!attr) return undefined
  if (attr.value?.type === 'StringLiteral') return attr.value.value as string
  if (attr.value?.type === 'JSXExpressionContainer') {
    const expression = attr.value.expression
    if (expression?.type === 'StringLiteral') return expression.value as string
  }
  return undefined
}

/** The `<Table name="…">` element for a block, wherever it sits in the file. */
export function findBlockElement(ast: Node, source: string, block: string): Node | undefined {
  let found: Node | undefined
  walk(ast, (node) => {
    if (found || node.type !== 'JSXElement') return
    if (jsxName(node) !== 'Table') return
    if (stringOf(attribute(node, 'name')) === block) found = node
  })
  void source
  return found
}

export interface EditTarget {
  kind: 'literal' | 'formula' | 'header' | 'unsupported'
  range?: SourceRange
  /** Why this cell cannot be edited directly, when kind is 'formula'/'unsupported'. */
  reason?: string
}

/**
 * Resolve a cell origin down to the exact source range holding its value.
 *
 * The hard case is a table cell, whose value lives in an object inside the array
 * passed to `data` — often a variable declared elsewhere in the file, not an
 * inline literal. Following that binding is what makes the inspector able to
 * edit real workbooks rather than only toy ones.
 */
export function findEditTarget(source: string, origin: CellOrigin): EditTarget {
  const ast = parseWorkbook(source)

  if (origin.part === 'header') {
    return { kind: 'header', reason: 'edit the column’s `header` option' }
  }
  if (origin.part === 'total') {
    return {
      kind: 'formula',
      reason: 'this is a total; change the `total` aggregate or its column',
    }
  }
  if (origin.part === 'title') {
    return { kind: 'unsupported', reason: 'edit the block’s `title` prop' }
  }

  const element = findBlockElement(ast, source, origin.block)
  if (!element) return { kind: 'unsupported', reason: `no <Table name="${origin.block}"> found` }

  const dataAttr = attribute(element, 'data')
  const expression = dataAttr?.value?.expression
  if (!expression) return { kind: 'unsupported', reason: 'block has no `data` prop' }

  const array = resolveArray(ast, expression)
  if (!array) {
    return {
      kind: 'unsupported',
      reason: 'the `data` array is computed, so there is no literal value to edit',
    }
  }

  if (origin.kind === 'keyValue') {
    const entry = findEntryByKey(array, origin.column)
    if (!entry) return { kind: 'unsupported', reason: `no entry with key "${origin.column}"` }
    const value = propertyValue(entry, 'value')
    if (!value) return { kind: 'unsupported', reason: 'entry has no `value`' }
    return { kind: 'literal', range: range(source, value) }
  }

  const index = origin.row ?? -1
  const row = array.elements?.[index]
  if (!row || row.type !== 'ObjectExpression') {
    return { kind: 'unsupported', reason: `data row ${index} is not an object literal` }
  }

  const value = propertyValue(row as Node, origin.column ?? '')
  if (!value) {
    return {
      kind: 'formula',
      reason: `column "${origin.column}" is computed, not stored — edit the inputs or the formula`,
    }
  }
  return { kind: 'literal', range: range(source, value) }
}

/** `data={rows}` is the common case, so follow the binding to its declaration. */
function resolveArray(ast: Node, expression: Node): Node | undefined {
  if (expression.type === 'ArrayExpression') return expression
  if (expression.type !== 'Identifier') return undefined

  let found: Node | undefined
  walk(ast, (node) => {
    if (found || node.type !== 'VariableDeclarator') return
    if (node.id?.type !== 'Identifier' || node.id.name !== expression.name) return
    if (node.init?.type === 'ArrayExpression') found = node.init as Node
  })
  return found
}

function findEntryByKey(array: Node, key: string | undefined): Node | undefined {
  if (!key) return undefined
  for (const element of array.elements ?? []) {
    if (element?.type !== 'ObjectExpression') continue
    const value = propertyValue(element as Node, 'key')
    if (value?.type === 'StringLiteral' && value.value === key) return element as Node
  }
  return undefined
}

function propertyValue(object: Node, name: string): Node | undefined {
  for (const property of object.properties ?? []) {
    if (property.type !== 'ObjectProperty') continue
    const propertyName =
      property.key?.type === 'Identifier'
        ? property.key.name
        : property.key?.type === 'StringLiteral'
          ? property.key.value
          : undefined
    if (propertyName === name) return property.value as Node
  }
  return undefined
}
