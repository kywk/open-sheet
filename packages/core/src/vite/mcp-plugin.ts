import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Plugin, ViteDevServer } from 'vite'
import type { ResolvedConfig } from './config.js'

const ENDPOINT = '/mcp'

type Handler = (req: unknown, res: unknown, body?: unknown) => Promise<void>

async function readJson(req: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  if (chunks.length === 0) return undefined
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Opt-in, and loaded dynamically: @open-sheet/mcp is an optional dependency, so
 * a workspace that never drives open-sheet from an agent framework does not pay
 * for the SDK. Missing means a clear message, not a resolver error.
 */
export function mcpPlugin(config: ResolvedConfig): Plugin {
  let handler: Handler | undefined
  let failure: string | undefined

  return {
    name: 'open-sheet:mcp',
    async configureServer(server: ViteDevServer) {
      try {
        // Resolved from the *workspace*, not from this package: @open-sheet/mcp
        // is the user's optional dependency, installed next to their workbooks.
        const require = createRequire(pathToFileURL(join(config.root, 'package.json')))
        const entry = require.resolve('@open-sheet/mcp')
        const mcp = (await import(/* @vite-ignore */ pathToFileURL(entry).href)) as {
          createHttpHandler: (options: unknown) => Handler
        }
        handler = mcp.createHttpHandler({
          config,
          loader: (file: string) => server.ssrLoadModule(file),
        })
        process.stdout.write(`  mcp         http://localhost:${config.port}${ENDPOINT}\n`)
      } catch {
        failure =
          '@open-sheet/mcp is not installed. Add it to this workspace to serve /mcp:\n' +
          '  pnpm add -D @open-sheet/mcp'
        process.stderr.write(`\n  ${failure}\n`)
      }

      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== ENDPOINT) return next()

        if (!handler) {
          res.statusCode = 501
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: failure ?? 'mcp unavailable' }))
          return
        }

        try {
          const body = req.method === 'POST' ? await readJson(req) : undefined
          await handler(req, res, body)
        } catch (error) {
          if (res.headersSent) return
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
        }
      })
    },
  }
}
