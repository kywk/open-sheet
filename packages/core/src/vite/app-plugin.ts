import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import type { ResolvedConfig } from './config.js'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * The viewer lives inside this package while workbooks live in the user's
 * workspace, so Vite's root stays the workspace and the app entry is reached
 * through /@fs. Serving it any other way would put the user's `sheets/` outside
 * the root and break relative imports in their own workbooks.
 */
export function appEntry(): string {
  const candidates = [
    resolve(here, '../app/main.tsx'),
    resolve(here, '../../src/app/main.tsx'),
    resolve(here, '../../../src/app/main.tsx'),
  ]
  const found = candidates.find((path) => existsSync(path))
  if (!found)
    throw new Error(
      `cannot locate the open-sheet viewer entry (looked in ${candidates.join(', ')})`,
    )
  return found
}

export function packageRoot(): string {
  let dir = here
  for (let i = 0; i < 5; i += 1) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'src'))) return dir
    dir = dirname(dir)
  }
  return resolve(here, '../..')
}

function shell(entry: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>open-sheet</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="/@fs${entry}"></script>
</body>
</html>
`
}

export function appPlugin(_config: ResolvedConfig): Plugin {
  const entry = appEntry()

  return {
    name: 'open-sheet:app',
    configureServer(server) {
      // after Vite's own middlewares, so asset and HMR requests win
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url || req.method !== 'GET') return next()
          const [path] = req.url.split('?')
          if (path?.includes('.') || path?.startsWith('/@') || path?.startsWith('/__open-sheet')) {
            return next()
          }
          const html = await server.transformIndexHtml(req.url, shell(entry))
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
        })
      }
    },
  }
}
