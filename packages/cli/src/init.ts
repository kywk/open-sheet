import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectPackageManager, installCommand, runCommand } from './package-manager.js'

const here = dirname(fileURLToPath(import.meta.url))

export interface InitOptions {
  directory: string
  cwd?: string
  version?: string
}

export interface InitResult {
  root: string
  files: string[]
  next: string[]
}

function templateDir(): string {
  for (const candidate of [join(here, '..', 'template'), join(here, '..', '..', 'template')]) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error('scaffolder template is missing from the installed package')
}

/**
 * The skills are staged into the template at build time, because `npx
 * @open-sheet/cli init` installs the scaffolder alone — core is not on disk to
 * resolve them from. The other lookups are for running out of the monorepo.
 */
function skillsDir(root: string): string | undefined {
  const staged = join(root, 'skills')
  if (existsSync(join(staged, 'create-sheet', 'SKILL.md'))) return staged

  const require = createRequire(import.meta.url)
  try {
    const core = require.resolve('@open-sheet/core/package.json')
    const candidate = join(dirname(core), 'skills')
    if (existsSync(candidate)) return candidate
  } catch {
    // fall through to the monorepo layout
  }
  for (const candidate of [
    join(here, '..', '..', 'core', 'skills'),
    join(here, '..', '..', '..', 'core', 'skills'),
  ]) {
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

export function init(options: InitOptions): InitResult {
  const root = resolve(options.cwd ?? process.cwd(), options.directory)

  if (existsSync(root) && readdirSync(root).length > 0) {
    throw new Error(`${root} already exists and is not empty`)
  }

  mkdirSync(root, { recursive: true })
  cpSync(templateDir(), root, { recursive: true })

  const files: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else files.push(path.slice(root.length + 1))
    }
  }

  const name = options.directory.split('/').filter(Boolean).pop() ?? 'my-sheets'
  const version = options.version ?? 'latest'
  const packageJson = join(root, 'package.json')
  writeFileSync(
    packageJson,
    readFileSync(packageJson, 'utf8')
      .replaceAll('__NAME__', name)
      .replaceAll('__VERSION__', version),
  )

  // npm strips a leading-dot .gitignore from a published package, so the
  // template ships it renamed and it is restored here.
  const shippedIgnore = join(root, 'gitignore')
  if (existsSync(shippedIgnore)) renameSync(shippedIgnore, join(root, '.gitignore'))

  const skills = skillsDir(root)
  if (skills) {
    // Both conventions, so the workspace works with Claude Code and with agents
    // that read .agents/skills.
    for (const target of ['.claude/skills', '.agents/skills']) {
      const destination = join(root, target)
      mkdirSync(destination, { recursive: true })
      cpSync(skills, destination, { recursive: true })
    }
    // The staging copy has done its job.
    rmSync(join(root, 'skills'), { recursive: true, force: true })
  }

  walk(root)

  const manager = detectPackageManager()
  return {
    root,
    files: files.sort(),
    next: [`cd ${options.directory}`, installCommand(manager), runCommand(manager, 'dev')],
  }
}
