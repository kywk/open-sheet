import { createServer } from 'vite'
import { resolveConfig, viteConfigFor } from '../vite/index.js'
import { discoverSheets } from './discover.js'

export interface DevOptions {
  root?: string
  port?: number
  host?: string
  open?: boolean
  /** Disable the file watcher. Useful in containers with low inotify limits. */
  watch?: boolean
  /** Mount an MCP endpoint at /mcp so any agent framework can drive the workspace. */
  mcp?: boolean
}

export async function dev(
  options: DevOptions = {},
): Promise<{ url: string; close: () => Promise<void> }> {
  const root = options.root ?? process.cwd()
  const config = resolveConfig(root, options.port ? { port: options.port } : {})

  const found = discoverSheets(config.root, config.sheetsDir)
  const inline = viteConfigFor(config, options.mcp ? { mcp: true } : {})
  if (options.host) inline.server = { ...inline.server, host: options.host }
  if (options.watch === false) inline.server = { ...inline.server, watch: null }

  const server = await createServer(inline)
  await server.listen()

  const resolved = server.resolvedUrls?.local?.[0] ?? `http://localhost:${config.port}/`
  process.stdout.write(`\n  open-sheet  ${resolved}\n`)
  process.stdout.write(
    found.length === 0
      ? `  no workbooks yet — create ${config.sheetsDir}/<id>/index.tsx\n\n`
      : `  ${found.length} workbook${found.length === 1 ? '' : 's'}: ${found.map((f) => f.id).join(', ')}\n\n`,
  )

  if (options.open) server.openBrowser()

  return {
    url: resolved,
    // Keep-alive connections keep httpServer.close() waiting, so a browser tab
    // left open would hang shutdown. Drop them first.
    close: async () => {
      const http = server.httpServer as { closeAllConnections?: () => void } | null
      http?.closeAllConnections?.()
      await server.close()
    },
  }
}
