/**
 * The browser-safe surface. A workbook imports from here and is evaluated by the
 * viewer in the browser, so nothing reachable from this file may touch Node —
 * see `./node` for the CLI, the dev server, and the writers.
 */

export type { CompileOptions } from './compile/compile.js'
// Compilation and evaluation — pure, and deliberately DOM-free
export { compile } from './compile/compile.js'
export type { ColumnOptions, KeyValueEntry, TableProps } from './compile/components.js'
// Authoring
export {
  Cell,
  Chart,
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
export type {
  CompiledSheet,
  CompiledWorkbook,
  ConditionalFormat,
  DefinedName,
  PlacedChart,
} from './compile/emit.js'
export { emitWorkbook } from './compile/emit.js'
export type {
  Aggregate,
  Block,
  ChartKind,
  ChartNode,
  ChartSeries,
  ColumnSpec,
  DataBar,
  InlineRun,
  KpiItem,
  Orientation,
  PageSize,
  PrintSetup,
  SheetNode,
  TableNode,
  WorkbookNode,
} from './compile/nodes.js'
export type { CellOrigin } from './compile/origin.js'
export { originOf } from './compile/origin.js'
export type { Anchor, KeyValueAnchor, Registry, TableAnchor } from './compile/registry.js'
export type { CsvOptions } from './export/csv.js'
// Pure exporters
export { toCsv } from './export/csv.js'
export { NAMED_FORMATS, numberFormat } from './export/formats.js'
export type { HtmlOptions } from './export/html.js'
export { toHtml } from './export/html.js'
export type { ValueMap } from './formula/evaluate.js'
export { CycleError, evaluateWorkbook } from './formula/evaluate.js'
export type { BinaryOp, Expr, ExprInput, FunctionName, Scalar } from './formula/expr.js'
// Formulas
export {
  abs,
  add,
  averageif,
  avg,
  concat,
  count,
  countif,
  div,
  eq,
  FUNCTIONS,
  gt,
  gte,
  if_,
  iferror,
  ifna,
  index,
  irr,
  isExpr,
  isWhitelisted,
  large,
  lift,
  lt,
  lte,
  match,
  max,
  min,
  mul,
  neg,
  neq,
  npv,
  pow,
  raw,
  round,
  small,
  sub,
  sum,
  sumif,
  sumproduct,
} from './formula/expr.js'
export type { ParsedFormula } from './formula/parse.js'
export { parseFormula } from './formula/parse.js'
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
// Model
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
export type { LookupSpec } from './refs/lookup.js'
export { lookup } from './refs/lookup.js'
export type { BlockRef, CellRef, NameRef, RangeRef, Ref, RowContext } from './refs/ref.js'
// References
export { isRef, ref } from './refs/ref.js'
export type { ResolveContext, ResolvedRef } from './refs/resolve.js'
export { refToA1, resolveRef } from './refs/resolve.js'
export { formatValue, toCssDeclarations, toCssText, toStyleObject } from './style/css.js'
export type { DesignSystem } from './style/design.js'
// Style — one model, rendered by every target
export { applyDesign, DESIGN_TOKENS, designFormat, themeFor } from './style/design.js'
export { toArgb, toExcelStyle } from './style/excel.js'
export { DEFAULT_THEME, resolveStyle } from './style/theme.js'
export type { CellStyle, StyleKey, Theme } from './style/types.js'

export interface SheetMeta {
  title: string
  theme?: string
  createdAt?: string
  description?: string
}

export interface OpenSheetConfig {
  /** Directory holding `<id>/index.tsx` workbooks, relative to the workspace root. */
  sheetsDir?: string
  /** Directory holding `<id>.md` house styles. */
  themesDir?: string
  /** Dev server port. */
  port?: number
}
