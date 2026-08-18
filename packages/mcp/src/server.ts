import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  compile,
  evaluateWorkbook,
  exportWorkbook,
  getCurrent,
  listWorkbooks,
  type ModuleLoader,
  type ResolvedConfig,
  readWorkbook,
  writeWorkbook,
} from '@open-sheet/core'
import { z } from 'zod'
import { reportSheet } from './grid.js'

export interface ServerOptions {
  config: ResolvedConfig
  loader: ModuleLoader
  version?: string
}

function text(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  }
}

function failure(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: error instanceof Error ? error.message : String(error),
      },
    ],
  }
}

/**
 * Every tool here goes through the same `ops` functions the browser uses, so
 * there is one implementation of "write this workbook" and one place that
 * refuses a stale write.
 */
export function createServer(options: ServerOptions): McpServer {
  const { config, loader } = options
  const server = new McpServer({ name: 'open-sheet', version: options.version ?? '0.0.0' })

  const load = async (id: string) => {
    const { file } = readWorkbook(config, id)
    const module = await loader(file)
    const book = compile(module.default)
    return { book, values: evaluateWorkbook(book), title: module.meta?.title ?? id }
  }

  server.registerTool(
    'list_workbooks',
    {
      title: 'List workbooks',
      description: 'Every workbook in this open-sheet workspace, with its id and source path.',
      inputSchema: {},
    },
    async () => {
      try {
        return text({ workbooks: listWorkbooks(config) })
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'read_workbook',
    {
      title: 'Read workbook source',
      description:
        'The TSX source of a workbook, with a hash. Pass the hash back to write_workbook so a ' +
        'concurrent edit is refused rather than overwritten.',
      inputSchema: { id: z.string().describe('workbook id, i.e. the directory under sheets/') },
    },
    async ({ id }) => {
      try {
        return text(readWorkbook(config, id))
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'write_workbook',
    {
      title: 'Write workbook source',
      description:
        'Replace a workbook’s source. Include the hash from read_workbook; if the file changed ' +
        'since, the write is refused so nobody’s edit is silently lost.',
      inputSchema: {
        id: z.string(),
        source: z.string().describe('complete TSX file contents'),
        hash: z.string().optional().describe('hash from read_workbook'),
      },
    },
    async ({ id, source, hash }) => {
      try {
        const written = writeWorkbook(config, id, source, hash)
        return text({ id: written.id, hash: written.hash, bytes: source.length })
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'read_sheet',
    {
      title: 'Read a compiled sheet',
      description:
        'Every populated cell of one sheet, as resolved Excel formulas *and* computed values. ' +
        'Cells marked notEvaluated export fine but were not computed — never treat them as zero.',
      inputSchema: {
        id: z.string(),
        sheet: z.string().describe('sheet name, as shown on its tab'),
      },
    },
    async ({ id, sheet }) => {
      try {
        const { book, values } = await load(id)
        return text(reportSheet(book, values, sheet))
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'describe_workbook',
    {
      title: 'Describe a workbook',
      description:
        'Sheet names and sizes, the named blocks with their column keys, and the defined names — ' +
        'the vocabulary ref() accepts for this workbook.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        const { book, title } = await load(id)
        return text({
          id,
          title,
          sheets: book.sheets.map((sheet) => ({
            name: sheet.name,
            rows: sheet.bounds.rows,
            cols: sheet.bounds.cols,
          })),
          blocks: [...book.registry.values()].map((anchor) =>
            anchor.kind === 'table'
              ? {
                  name: anchor.name,
                  kind: 'table',
                  sheet: anchor.sheet,
                  rows: anchor.rowCount,
                  columns: [...anchor.columns.keys()],
                  hasTotal: anchor.totalRow !== undefined,
                }
              : {
                  name: anchor.name,
                  kind: 'keyValue',
                  sheet: anchor.sheet,
                  keys: [...anchor.keys.keys()],
                },
          ),
          definedNames: [...book.definedNames.keys()],
        })
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'export_workbook',
    {
      title: 'Export a workbook',
      description:
        'Render a workbook to xlsx (live formulas), csv (first sheet, computed values), or html. ' +
        'Returns base64 for xlsx and text otherwise.',
      inputSchema: {
        id: z.string(),
        format: z.enum(['xlsx', 'csv', 'html']).default('xlsx'),
      },
    },
    async ({ id, format }) => {
      try {
        const result = await exportWorkbook(config, id, format, loader)
        return text({
          filename: result.filename,
          contentType: result.contentType,
          encoding: Buffer.isBuffer(result.body) ? 'base64' : 'utf8',
          body: Buffer.isBuffer(result.body) ? result.body.toString('base64') : result.body,
        })
      } catch (error) {
        return failure(error)
      }
    },
  )

  server.registerTool(
    'current_position',
    {
      title: 'Where the reader is',
      description:
        'The workbook, sheet, and cell currently open in the viewer, so "this cell" resolves ' +
        'without asking. Empty when the dev server is not running.',
      inputSchema: {},
    },
    async () => {
      try {
        return text(
          getCurrent(config) ?? { note: 'no position published; is the dev server running?' },
        )
      } catch (error) {
        return failure(error)
      }
    },
  )

  return server
}
