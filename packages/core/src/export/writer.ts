import type { CompiledWorkbook } from '../compile/emit.js'
import type { ValueMap } from '../formula/evaluate.js'

export interface WriteOptions {
  /**
   * Cached values written alongside each formula. Excel recalculates on open,
   * but a cached result means the file shows correct numbers in viewers that
   * do not recalculate (Preview, GitHub, many mobile apps).
   */
  values?: ValueMap
  creator?: string
}

/**
 * ExcelJS is MIT and the only mature JS library covering formulas, styles, and
 * conditional formatting together — but its last release was 2023-10, so the
 * writer sits behind this interface. Swapping in `hucre` or hand-rolled OOXML
 * must not require touching anything upstream of here.
 */
export interface WorkbookWriter {
  readonly extension: string
  write(book: CompiledWorkbook, options?: WriteOptions): Promise<Buffer>
}
