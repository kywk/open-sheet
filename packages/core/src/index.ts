export type { CompileOptions } from './compile/compile.js'
export { compile } from './compile/compile.js'
export type { ColumnOptions, KeyValueEntry, TableProps } from './compile/components.js'
export {
  Cell,
  col,
  KpiBand,
  Note,
  Row,
  Sheet,
  Spacer,
  Stack,
  Table,
  Workbook,
} from './compile/components.js'
export type { CompiledSheet, CompiledWorkbook, DefinedName } from './compile/emit.js'
export { emitWorkbook } from './compile/emit.js'
export type {
  Aggregate,
  Block,
  ColumnSpec,
  InlineRun,
  KpiItem,
  SheetNode,
  TableNode,
  WorkbookNode,
} from './compile/nodes.js'
export type { Anchor, KeyValueAnchor, Registry, TableAnchor } from './compile/registry.js'
export { NAMED_FORMATS, numberFormat } from './export/formats.js'
export type { WorkbookWriter, WriteOptions } from './export/writer.js'
export { XlsxWriter } from './export/xlsx.js'
export type { ValueMap } from './formula/evaluate.js'
export { CycleError, evaluateWorkbook } from './formula/evaluate.js'
export type { BinaryOp, Expr, ExprInput, FunctionName, Scalar } from './formula/expr.js'
export {
  abs,
  add,
  avg,
  concat,
  count,
  div,
  eq,
  FUNCTIONS,
  gt,
  gte,
  if_,
  iferror,
  irr,
  isExpr,
  isWhitelisted,
  lift,
  lt,
  lte,
  max,
  min,
  mul,
  neg,
  neq,
  npv,
  pow,
  raw,
  round,
  sub,
  sum,
  sumproduct,
} from './formula/expr.js'
export { serialize, toFormula } from './formula/serialize.js'
export type { Computed, ExcelError, NotEvaluated } from './formula/value.js'
export {
  display,
  errorFrom,
  isExcelError,
  isNotEvaluated,
  NOT_EVALUATED,
} from './formula/value.js'
export { measure, tableRowCount } from './layout/measure.js'
export type { Placement } from './layout/place.js'
export { placeSheet } from './layout/place.js'
export {
  columnIndex,
  columnName,
  fromA1,
  qualify,
  quoteSheetName,
  rangeToA1,
  toA1,
} from './model/a1.js'
export type { Cell as CellData, CellValue, SourceLoc } from './model/cell.js'
export { cellKey, parseCellKey } from './model/cell.js'
export type { Addr, Rect, Size } from './model/geometry.js'
export type { BlockRef, CellRef, NameRef, RangeRef, Ref, RowContext } from './refs/ref.js'
export { isRef, ref } from './refs/ref.js'
export type { ResolveContext, ResolvedRef } from './refs/resolve.js'
export { refToA1, resolveRef } from './refs/resolve.js'

export interface SheetMeta {
  title: string
  theme?: string
  createdAt?: string
  description?: string
}

export interface DesignSystem {
  palette?: Record<string, string>
  fonts?: Record<string, string>
  formats?: Record<string, string>
}
