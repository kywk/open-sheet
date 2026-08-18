import type { Expr } from '../formula/expr.js'
import type { RowContext } from '../refs/ref.js'

export function makeRowContext<T>(block: string, data: readonly T[], index: number): RowContext<T> {
  const context: RowContext<T> = {
    index,
    isFirst: index === 0,
    isLast: index === data.length - 1,
    data: data[index] as T,
    cell(column: string): Expr {
      return { k: 'ref', target: { kind: 'cell', block, part: 'data', column, row: index } }
    },
    prev(offset = 1): RowContext<T> {
      return makeRowContext(block, data, index - offset)
    },
    next(offset = 1): RowContext<T> {
      return makeRowContext(block, data, index + offset)
    },
  }
  return context
}
