/**
 * Everything that needs Node: the CLI, the dev server, the ops layer, and the
 * writers that reach the filesystem or an optional browser.
 *
 * These are deliberately *not* in the main entry. A workbook imports
 * `@open-sheet/core` and is evaluated in the browser by the viewer, so anything
 * reachable from the main entry is code the browser has to load — and Node-only
 * code there does not merely bloat it, it breaks the page: the dependency
 * optimizer cannot analyse `import('playwright')`, and the module ends up
 * transformed twice.
 */

export type { BuildOptions, BuildResult } from './cli/build.js'
export { build } from './cli/build.js'
export type { DevOptions } from './cli/dev.js'
export { dev } from './cli/dev.js'
export { discoverSheets } from './cli/discover.js'
export type { WorkbookModule } from './cli/load.js'
export { createLoader } from './cli/load.js'
export { preview } from './cli/preview.js'
export type { DesignPatch } from './editing/design-edit.js'
export { editDesign, readDesignLiteral } from './editing/design-edit.js'
export {
  addComment,
  ChangedUnderfootError,
  editCell,
  listComments,
  NotEditableError,
} from './editing/edit.js'
export type { CellOrigin, EditTarget, SourceRange } from './editing/locate.js'
export { findEditTarget, originOf } from './editing/locate.js'
export type { PdfOptions } from './export/pdf.js'
export { PlaywrightMissingError, toPdf } from './export/pdf.js'
export type { WorkbookWriter, WriteOptions } from './export/writer.js'
export { XlsxWriter } from './export/xlsx.js'
export type {
  CommentCellRequest,
  CurrentPosition,
  EditCellRequest,
  ExportFormat,
  ExportResult,
  InspectRequest,
  InspectResult,
  ModuleLoader,
  WorkbookSource,
  WorkbookSummary,
} from './ops/index.js'
export {
  commentOnCell,
  editWorkbookCell,
  exportWorkbook,
  getCurrent,
  inspectCell,
  listWorkbooks,
  NotFoundError,
  readDesign,
  readWorkbook,
  StaleWriteError,
  setCurrent,
  writeDesign,
  writeWorkbook,
} from './ops/index.js'
export type { AssetSummary, ThemeDetail, ThemeSummary } from './ops/workspace.js'
export { listAssets, listThemes, readTheme } from './ops/workspace.js'
export type { ResolvedConfig } from './vite/config.js'
export { DEFAULT_PORT, resolveConfig } from './vite/config.js'
export { openSheetPlugins, viteConfigFor } from './vite/index.js'
