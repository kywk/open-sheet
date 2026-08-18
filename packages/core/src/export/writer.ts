import type { CompiledWorkbook } from '../compile/emit.js'
import type { ValueMap } from '../formula/evaluate.js'
import type { Theme } from '../style/types.js'

export interface WriteOptions {
  /**
   * Values to cache alongside each formula, so the file shows numbers in viewers
   * that cannot compute at all (Preview, GitHub, most mobile apps).
   *
   * Trusting these is only safe because CI proves our evaluator agrees with a
   * real spreadsheet engine — see the recalculation check.
   */
  values?: ValueMap

  /**
   * Set false to write bare formulas with no cached results. Anything opening
   * the file must then compute for itself, which is what makes the CI
   * recalculation check meaningful: with cached results present it would read
   * back our own answers and prove nothing.
   */
  cacheValues?: boolean

  /** House style. Both this writer and the HTML renderer consume it. */
  theme?: Theme

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
