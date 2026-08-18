import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { init } from './init.js'
import { detectPackageManager, installCommand, runCommand } from './package-manager.js'

const scratch = () => mkdtempSync(join(tmpdir(), 'open-sheet-init-'))

describe('init', () => {
  it('creates a workspace that is ready to run', () => {
    const cwd = scratch()
    const result = init({ directory: 'my-sheets', cwd })

    expect(existsSync(join(result.root, 'package.json'))).toBe(true)
    expect(existsSync(join(result.root, 'open-sheet.config.ts'))).toBe(true)
    expect(existsSync(join(result.root, 'sheets', 'getting-started', 'index.tsx'))).toBe(true)
    expect(existsSync(join(result.root, 'AGENTS.md'))).toBe(true)
  })

  it('names the package after the directory and pins the framework', () => {
    const cwd = scratch()
    const result = init({ directory: 'acme-models', cwd, version: '^1.2.3' })
    const manifest = JSON.parse(readFileSync(join(result.root, 'package.json'), 'utf8'))

    expect(manifest.name).toBe('acme-models')
    expect(manifest.dependencies['@open-sheet/core']).toBe('^1.2.3')
    expect(manifest.scripts.dev).toBe('open-sheet dev')
  })

  it('delivers the skills under both conventions', () => {
    const cwd = scratch()
    const result = init({ directory: 'my-sheets', cwd })

    for (const base of ['.claude/skills', '.agents/skills']) {
      expect(existsSync(join(result.root, base, 'create-sheet', 'SKILL.md'))).toBe(true)
      expect(existsSync(join(result.root, base, 'sheet-authoring', 'SKILL.md'))).toBe(true)
      expect(
        existsSync(join(result.root, base, 'sheet-authoring', 'references', 'formulas.md')),
      ).toBe(true)
    }
  })

  it('ships a starter workbook that contains no cell address', () => {
    const cwd = scratch()
    const result = init({ directory: 'my-sheets', cwd })
    const source = readFileSync(join(result.root, 'sheets', 'getting-started', 'index.tsx'), 'utf8')

    // The premise of the framework, enforced on the file every new user reads first.
    expect(source).not.toMatch(/\$?[A-Z]{1,2}\$?\d+\s*[:)]/)
    expect(source).not.toContain('SUM(')
    expect(source).toContain("r.cell('units')")
    expect(source).toContain("ref('assumptions').get('price')")
  })

  it('refuses to scaffold over an existing workspace', () => {
    const cwd = scratch()
    init({ directory: 'my-sheets', cwd })
    expect(() => init({ directory: 'my-sheets', cwd })).toThrow(/already exists and is not empty/)
  })

  it('suggests the next steps in the manager the user invoked it with', () => {
    const cwd = scratch()
    const result = init({ directory: 'my-sheets', cwd })
    expect(result.next[0]).toBe('cd my-sheets')
    expect(result.next).toHaveLength(3)
  })
})

describe('package manager detection', () => {
  it('reads the npm user agent', () => {
    expect(detectPackageManager('pnpm/10.0.0 npm/? node/v22')).toBe('pnpm')
    expect(detectPackageManager('yarn/4.0.0')).toBe('yarn')
    expect(detectPackageManager('bun/1.0.0')).toBe('bun')
    expect(detectPackageManager('npm/10.0.0')).toBe('npm')
    expect(detectPackageManager(undefined)).toBe('npm')
  })

  it('phrases commands the way each manager expects', () => {
    expect(installCommand('yarn')).toBe('yarn')
    expect(installCommand('pnpm')).toBe('pnpm install')
    expect(runCommand('npm', 'dev')).toBe('npm run dev')
    expect(runCommand('pnpm', 'dev')).toBe('pnpm dev')
  })
})
