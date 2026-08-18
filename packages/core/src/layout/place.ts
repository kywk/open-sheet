import { type Block, isContainer, type SheetNode } from '../compile/nodes.js'
import { overlaps, type Rect } from '../model/geometry.js'
import { measure } from './measure.js'

export interface Placement {
  block: Exclude<Block, { kind: 'stack' } | { kind: 'row' }>
  rect: Rect
}

export function placeSheet(sheet: SheetNode): Placement[] {
  const origin = sheet.origin ?? { r: 0, c: 0 }
  const placements: Placement[] = []
  placeSequence(sheet.children, 1, 'stack', origin.r, origin.c, placements)
  assertNoCollisions(placements, sheet.name)
  return placements
}

function placeBlock(block: Block, r: number, c: number, out: Placement[]): void {
  const size = measure(block)
  if (size.rows === 0 || size.cols === 0) return
  if (isContainer(block)) {
    placeSequence(block.children, block.gap, block.kind, r, c, out)
    return
  }
  out.push({ block, rect: { r, c, rows: size.rows, cols: size.cols } })
}

function placeSequence(
  children: readonly Block[],
  gap: number,
  axis: 'stack' | 'row',
  r: number,
  c: number,
  out: Placement[],
): void {
  let cursorR = r
  let cursorC = c
  let placed = false
  for (const child of children) {
    const size = measure(child)
    if (size.rows === 0 || size.cols === 0) continue
    if (placed) {
      if (axis === 'stack') cursorR += gap
      else cursorC += gap
    }
    placeBlock(child, cursorR, cursorC, out)
    if (axis === 'stack') cursorR += size.rows
    else cursorC += size.cols
    placed = true
  }
}

/**
 * Overlapping rects mean the placement engine is broken, not that the author did
 * something wrong — they never chose a coordinate. Fail loudly rather than
 * silently writing one block over another.
 */
export function assertNoCollisions(placements: readonly Placement[], sheetName: string): void {
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i] as Placement
      const b = placements[j] as Placement
      if (overlaps(a.rect, b.rect)) {
        throw new Error(
          `placement collision on sheet "${sheetName}": ` +
            `<${a.block.kind}> at ${fmt(a.rect)} overlaps <${b.block.kind}> at ${fmt(b.rect)}. ` +
            'This is a bug in the placement engine.',
        )
      }
    }
  }
}

function fmt(rect: Rect): string {
  return `(r${rect.r},c${rect.c} ${rect.rows}x${rect.cols})`
}
