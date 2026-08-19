import { NotEditableError } from './edit.js'
import { parseWorkbook } from './locate.js'

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
    if (key === 'loc' || key.endsWith('Comments')) continue
    const value = node[key]
    if (value && typeof value === 'object') walk(value as Node, visit)
  }
}

function findDesignObject(source: string): Node | undefined {
  const ast = parseWorkbook(source)
  let found: Node | undefined
  walk(ast, (node) => {
    if (found || node.type !== 'VariableDeclarator') return
    if (node.id?.type !== 'Identifier' || node.id.name !== 'design') return
    if (node.init?.type === 'ObjectExpression') found = node.init as Node
  })
  return found
}

function propertyOf(object: Node, name: string): Node | undefined {
  for (const property of object.properties ?? []) {
    if (property.type !== 'ObjectProperty') continue
    const key =
      property.key?.type === 'Identifier'
        ? property.key.name
        : property.key?.type === 'StringLiteral'
          ? property.key.value
          : undefined
    if (key === name) return property as Node
  }
  return undefined
}

export type DesignPatch = Record<string, Record<string, string | number>>

/**
 * Splices new values into the existing `design` literal rather than rewriting
 * it, so the panel's edits stay a readable diff and any comments the author left
 * in the const survive.
 *
 * A `design` built from a spread or an imported value has no literal to edit —
 * that is reported rather than worked around, because silently rewriting it into
 * a literal would discard whatever it was spreading.
 */
export function editDesign(source: string, patch: DesignPatch): string {
  const design = findDesignObject(source)
  if (!design) {
    throw new NotEditableError(
      'this workbook has no `export const design = { … }` object literal to edit. ' +
        'The Design panel needs a plain literal — a spread or an imported value cannot be rewritten safely.',
    )
  }

  // Apply deepest-first so earlier splices do not move later offsets.
  const edits: { start: number; end: number; text: string }[] = []

  for (const [group, values] of Object.entries(patch)) {
    const groupProperty = propertyOf(design, group)
    if (groupProperty?.value?.type !== 'ObjectExpression') {
      const entries = Object.entries(values)
        .map(([key, value]) => `${key}: ${literal(value)}`)
        .join(', ')
      edits.push(insertProperty(source, design, `${group}: { ${entries} }`))
      continue
    }

    const groupObject = groupProperty.value as Node
    for (const [key, value] of Object.entries(values)) {
      const existing = propertyOf(groupObject, key)
      if (existing) {
        edits.push({
          start: existing.value.start as number,
          end: existing.value.end as number,
          text: literal(value),
        })
      } else {
        edits.push(insertProperty(source, groupObject, `${key}: ${literal(value)}`))
      }
    }
  }

  let out = source
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  }
  return out
}

function insertProperty(
  source: string,
  object: Node,
  text: string,
): { start: number; end: number; text: string } {
  const properties = object.properties ?? []
  if (properties.length === 0) {
    const open = (object.start as number) + 1
    return { start: open, end: open, text: ` ${text} ` }
  }
  const last = properties[properties.length - 1] as Node
  const at = last.end as number
  const trailingComma = /^\s*,/.test(source.slice(at))
  return { start: at, end: at, text: trailingComma ? `, ${text}` : `, ${text}` }
}

function literal(value: string | number): string {
  return typeof value === 'number' ? String(value) : `'${value.replace(/'/g, "\\'")}'`
}

export function readDesignLiteral(source: string): DesignPatch | undefined {
  const design = findDesignObject(source)
  if (!design) return undefined

  const out: DesignPatch = {}
  for (const property of design.properties ?? []) {
    if (property.type !== 'ObjectProperty') continue
    const group = property.key?.name ?? property.key?.value
    if (typeof group !== 'string' || property.value?.type !== 'ObjectExpression') continue
    const values: Record<string, string | number> = {}
    for (const inner of property.value.properties ?? []) {
      if (inner.type !== 'ObjectProperty') continue
      const key = inner.key?.name ?? inner.key?.value
      if (typeof key !== 'string') continue
      if (inner.value?.type === 'StringLiteral') values[key] = inner.value.value as string
      else if (inner.value?.type === 'NumericLiteral') values[key] = inner.value.value as number
    }
    out[group] = values
  }
  return out
}
