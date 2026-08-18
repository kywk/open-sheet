import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pdf': 'application/pdf',
}

export interface PreviewOptions {
  root?: string
  out?: string
  port?: number
}

/** Serves what `build` wrote, so the exported artefacts can be checked before shipping. */
export async function preview(
  options: PreviewOptions = {},
): Promise<{ url: string; close: () => Promise<void> }> {
  const dir = resolve(options.root ?? process.cwd(), options.out ?? 'dist')
  if (!existsSync(dir))
    throw new Error(`nothing to preview at ${dir} — run \`open-sheet build\` first`)

  const port = options.port ?? 5374
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0] as string)

    if (path === '/') {
      const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile())
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        `<!doctype html><meta charset="utf-8"><title>open-sheet preview</title>` +
          `<style>body{font:14px/1.6 system-ui;margin:40px;max-width:640px}a{color:#1d4ed8}</style>` +
          `<h1>open-sheet build</h1><ul>${files
            .map((f) => `<li><a href="/${encodeURIComponent(f)}">${f}</a></li>`)
            .join('')}</ul>`,
      )
      return
    }

    const file = join(dir, path)
    if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('not found')
      return
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })

  await new Promise<void>((done) => server.listen(port, done))
  const url = `http://localhost:${port}/`
  process.stdout.write(`\n  open-sheet preview  ${url}\n\n`)

  return { url, close: () => new Promise((done) => server.close(() => done())) }
}
