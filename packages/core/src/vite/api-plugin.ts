import type { Connect, Plugin, ViteDevServer } from 'vite'
import {
  commentOnCell,
  type ExportFormat,
  editWorkbookCell,
  exportWorkbook,
  getCurrent,
  inspectCell,
  listWorkbooks,
  readWorkbook,
  setCurrent,
  writeWorkbook,
} from '../ops/index.js'
import type { ResolvedConfig } from './config.js'

const PREFIX = '/__open-sheet/api/'

interface Res {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string | Buffer): void
}

function json(res: Res, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function readBody(req: Connect.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * HTTP is a thin shell over `ops/` — the same functions the MCP server calls, so
 * there is one implementation of "write this workbook" and one place where a
 * stale write is refused.
 */
export function apiPlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'open-sheet:api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(PREFIX)) return next()

        const url = new URL(req.url, 'http://localhost')
        const route = url.pathname.slice(PREFIX.length)
        const loader = (file: string) => server.ssrLoadModule(file) as never

        try {
          if (route === 'workbooks' && req.method === 'GET') {
            return json(res, 200, { workbooks: listWorkbooks(config) })
          }

          if (route === 'source' && req.method === 'GET') {
            const id = url.searchParams.get('id')
            if (!id) return json(res, 400, { error: 'id is required' })
            return json(res, 200, readWorkbook(config, id))
          }

          if (route === 'source' && req.method === 'POST') {
            const body = (await readBody(req)) as { id?: string; source?: string; hash?: string }
            if (!body.id || body.source === undefined) {
              return json(res, 400, { error: 'id and source are required' })
            }
            return json(res, 200, writeWorkbook(config, body.id, body.source, body.hash))
          }

          if (route === 'current' && req.method === 'GET') {
            return json(res, 200, getCurrent(config) ?? {})
          }

          if (route === 'current' && req.method === 'POST') {
            const body = (await readBody(req)) as { id?: string; sheet?: string; cell?: string }
            return json(res, 200, setCurrent(config, body, new Date().toISOString()))
          }

          if (route === 'inspect' && req.method === 'POST') {
            const body = (await readBody(req)) as { id?: string; sheet?: string; cell?: string }
            if (!body.id || !body.sheet || !body.cell) {
              return json(res, 400, { error: 'id, sheet and cell are required' })
            }
            return json(res, 200, await inspectCell(config, body as never, loader))
          }

          if (route === 'edit' && req.method === 'POST') {
            const body = (await readBody(req)) as { value?: string }
            if (body.value === undefined) return json(res, 400, { error: 'value is required' })
            return json(res, 200, await editWorkbookCell(config, body as never, loader))
          }

          if (route === 'comment' && req.method === 'POST') {
            const body = (await readBody(req)) as { text?: string }
            if (!body.text) return json(res, 400, { error: 'text is required' })
            return json(res, 200, await commentOnCell(config, body as never, loader))
          }

          if (route === 'export' && req.method === 'GET') {
            const id = url.searchParams.get('id')
            const format = (url.searchParams.get('format') ?? 'xlsx') as ExportFormat
            if (!id) return json(res, 400, { error: 'id is required' })
            const result = await exportWorkbook(config, id, format, loader)
            res.statusCode = 200
            res.setHeader('Content-Type', result.contentType)
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
            return res.end(result.body)
          }

          return json(res, 404, { error: `unknown route ${route}` })
        } catch (error) {
          const status = (error as { status?: number }).status ?? 500
          return json(res, status, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    },
  }
}
