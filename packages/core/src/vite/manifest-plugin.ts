import { join } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { discoverSheets } from '../cli/discover.js'
import type { ResolvedConfig } from './config.js'

const MANIFEST_ID = 'virtual:open-sheet/manifest'
const RESOLVED_ID = `\0${MANIFEST_ID}`

/**
 * The viewer never scans the filesystem. It imports this module, which the
 * plugin regenerates whenever a workbook is added, removed, or renamed — so
 * discovery is a build-time concern and the browser only sees lazy imports.
 */
export function manifestPlugin(config: ResolvedConfig): Plugin {
  let server: ViteDevServer | undefined

  const generate = (): string => {
    const found = discoverSheets(config.root, config.sheetsDir)
    const entries = found
      .map(
        ({ id, file }) =>
          `  { id: ${JSON.stringify(id)}, load: () => import(${JSON.stringify(file)}) }`,
      )
      .join(',\n')
    return `export const workbooks = [\n${entries}\n]\nexport const sheetsDir = ${JSON.stringify(config.sheetsDir)}\n`
  }

  const invalidate = (path: string): void => {
    if (!server) return
    if (!path.startsWith(join(config.root, config.sheetsDir))) return
    const module = server.moduleGraph.getModuleById(RESOLVED_ID)
    if (!module) return
    server.moduleGraph.invalidateModule(module)
    server.ws.send({ type: 'full-reload' })
  }

  return {
    name: 'open-sheet:manifest',
    resolveId(id) {
      if (id === MANIFEST_ID) return RESOLVED_ID
      return undefined
    },
    load(id) {
      if (id === RESOLVED_ID) return generate()
      return undefined
    },
    configureServer(devServer) {
      server = devServer
      devServer.watcher.on('add', invalidate)
      devServer.watcher.on('unlink', invalidate)
      devServer.watcher.on('addDir', invalidate)
      devServer.watcher.on('unlinkDir', invalidate)
    },
  }
}
