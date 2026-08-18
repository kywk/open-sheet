import { type CompiledWorkbook, emitWorkbook } from './emit.js'
import { isWorkbook, type WorkbookNode } from './nodes.js'

export interface CompileOptions {
  file?: string
}

export function compile(root: unknown, _options: CompileOptions = {}): CompiledWorkbook {
  if (!isWorkbook(root)) {
    throw new TypeError(
      'a workbook module must default-export a <Workbook> element containing <Sheet> children',
    )
  }
  return emitWorkbook(root as WorkbookNode)
}
