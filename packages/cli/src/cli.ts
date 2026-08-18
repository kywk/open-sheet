import { relative } from 'node:path'
import { init } from './init.js'

const USAGE = `create-open-sheet — scaffold an open-sheet workspace

Usage:
  npx @open-sheet/cli init [directory]

Arguments:
  directory   Where to create the workspace (default: my-sheets)
`

export async function run(argv: string[]): Promise<number> {
  const command = argv[0]

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(USAGE)
    return command ? 0 : 1
  }

  if (command !== 'init') {
    process.stderr.write(`unknown command: ${command}\n\n${USAGE}`)
    return 1
  }

  const directory = argv[1] ?? 'my-sheets'
  const result = init({ directory })

  process.stdout.write(`\n  Created ${relative(process.cwd(), result.root) || '.'}\n\n`)
  for (const file of result.files.slice(0, 12)) process.stdout.write(`    ${file}\n`)
  if (result.files.length > 12) {
    process.stdout.write(`    …and ${result.files.length - 12} more\n`)
  }
  process.stdout.write('\n  Next:\n')
  for (const step of result.next) process.stdout.write(`    ${step}\n`)
  process.stdout.write('\n  Then ask your agent: /create-sheet\n\n')

  return 0
}
