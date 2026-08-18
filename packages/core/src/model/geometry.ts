export interface Addr {
  r: number
  c: number
}

export interface Size {
  rows: number
  cols: number
}

export interface Rect extends Addr, Size {}

export const MAX_ROWS = 1_048_576
export const MAX_COLS = 16_384

export function sizeOf(rect: Rect): Size {
  return { rows: rect.rows, cols: rect.cols }
}

export function bottomOf(rect: Rect): number {
  return rect.r + rect.rows
}

export function rightOf(rect: Rect): number {
  return rect.c + rect.cols
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.r < bottomOf(b) && b.r < bottomOf(a) && a.c < rightOf(b) && b.c < rightOf(a)
}

export function contains(rect: Rect, addr: Addr): boolean {
  return addr.r >= rect.r && addr.r < bottomOf(rect) && addr.c >= rect.c && addr.c < rightOf(rect)
}

export function translate(rect: Rect, dr: number, dc: number): Rect {
  return { r: rect.r + dr, c: rect.c + dc, rows: rect.rows, cols: rect.cols }
}

export function unionSize(sizes: readonly Size[]): Size {
  let rows = 0
  let cols = 0
  for (const s of sizes) {
    if (s.rows > rows) rows = s.rows
    if (s.cols > cols) cols = s.cols
  }
  return { rows, cols }
}
