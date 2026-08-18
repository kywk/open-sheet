import { type Block, type InlineRun, isBlock, isSheet, type SheetNode } from './nodes.js'

export function flatten(children: unknown): unknown[] {
  const out: unknown[] = []
  const walk = (node: unknown): void => {
    if (node === null || node === undefined || node === false || node === true) return
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    out.push(node)
  }
  walk(children)
  return out
}

function describe(node: unknown): string {
  if (typeof node === 'object' && node !== null && 'kind' in node) {
    return `<${String((node as { kind: unknown }).kind)}>`
  }
  return typeof node
}

export function asBlocks(children: unknown, parent: string): Block[] {
  return flatten(children).map((node) => {
    if (isBlock(node)) return node
    if (typeof node === 'string' || typeof node === 'number') {
      throw new TypeError(
        `<${parent}> got bare text. Wrap it in <Note> or <Cell> — a cell grid has no place to put loose text.`,
      )
    }
    throw new TypeError(`<${parent}> cannot contain ${describe(node)}`)
  })
}

export function asSheets(children: unknown): SheetNode[] {
  return flatten(children).map((node) => {
    if (isSheet(node)) return node
    throw new TypeError(`<Workbook> children must be <Sheet>, got ${describe(node)}`)
  })
}

export function asRuns(children: unknown): InlineRun[] {
  return flatten(children).map((node) => {
    if (typeof node === 'string') return { text: node }
    if (typeof node === 'number') return { text: String(node) }
    if (typeof node === 'object' && node !== null && 'text' in node) return node as InlineRun
    throw new TypeError(`inline content cannot contain ${describe(node)}`)
  })
}
