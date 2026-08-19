import type { DesignSystem } from '../style/design.js'
import { type CompiledWorkbook, emitWorkbook } from './emit.js'
import { isWorkbook, type WorkbookNode } from './nodes.js'

export interface CompileOptions {
  file?: string
  /** The workbook module's `design` const, if it exported one. */
  design?: DesignSystem
}

export function compile(root: unknown, options: CompileOptions = {}): CompiledWorkbook {
  if (!isWorkbook(root)) {
    throw new TypeError(
      'a workbook module must default-export a <Workbook> element containing <Sheet> children',
    )
  }
  const book = emitWorkbook(root as WorkbookNode)
  if (options.design) book.design = options.design
  return book
}
