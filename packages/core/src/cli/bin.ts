import { relative } from 'node:path'
import { build } from './build.js'

const USAGE = `open-sheet — the spreadsheet framework built for agents

Usage:
  open-sheet build [options]

Commands:
  build     Compile every workbook under sheets/ and write .xlsx (and .csv)

Options:
  --out <dir>    Output directory (default: dist)
  --root <dir>   Workspace root (default: cwd)
  --no-csv       Skip the per-sheet .csv files
  --html         Also write a self-contained, printable .html
  --pdf          Also write a .pdf (needs playwright installed)
`

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  if (index === -1) return undefined
  return argv[index + 1]
}

export async function run(argv: string[]): Promise<number> {
  const command = argv[0]

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(USAGE)
    return command ? 0 : 1
  }

  if (command !== 'build') {
    process.stderr.write(`unknown command: ${command}\n\n${USAGE}`)
    return 1
  }

  const options: Parameters<typeof build>[0] = {
    csv: !argv.includes('--no-csv'),
    html: argv.includes('--html'),
    pdf: argv.includes('--pdf'),
  }
  const out = flag(argv, 'out')
  const root = flag(argv, 'root')
  if (out) options.out = out
  if (root) options.root = root

  const results = await build(options)
  const cwd = process.cwd()

  for (const result of results) {
    process.stdout.write(`${result.title} (${result.id})\n`)
    for (const file of result.files) process.stdout.write(`  ${relative(cwd, file)}\n`)
    if (result.notEvaluated > 0) {
      process.stdout.write(
        `  note: ${result.notEvaluated} cell(s) exported as live formulas but not evaluated here\n`,
      )
    }
    for (const warning of result.warnings) process.stdout.write(`  warning: ${warning}\n`)
  }

  return 0
}
