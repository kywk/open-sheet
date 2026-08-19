import { describe, expect, it } from 'vitest'
import { editDesign, readDesignLiteral } from './design-edit.js'

const SOURCE = `import { Sheet, Workbook, type DesignSystem } from '@open-sheet/core'

export const meta = { title: 'Styled' }

export const design: DesignSystem = {
  // brand blue, signed off 2026-02
  palette: { accent: '#1d4ed8', band: '#f8fafc' },
  formats: { percent: '0.0%' },
}

export default (
  <Workbook>
    <Sheet name="S" />
  </Workbook>
)
`

describe('reading the design literal', () => {
  it('returns the tokens it holds', () => {
    expect(readDesignLiteral(SOURCE)).toEqual({
      palette: { accent: '#1d4ed8', band: '#f8fafc' },
      formats: { percent: '0.0%' },
    })
  })

  it('returns nothing when there is no literal to read', () => {
    expect(readDesignLiteral('export const design = base')).toBeUndefined()
  })
})

describe('editing the design literal', () => {
  it('replaces an existing token in place', () => {
    const edited = editDesign(SOURCE, { palette: { accent: '#dc2626' } })
    expect(edited).toContain("accent: '#dc2626'")
    expect(edited).toContain("band: '#f8fafc'")
    // Splice, not regenerate — the author's comment survives.
    expect(edited).toContain('// brand blue, signed off 2026-02')
    expect(edited.split('\n').length).toBe(SOURCE.split('\n').length)
  })

  it('adds a token the literal did not have', () => {
    const edited = editDesign(SOURCE, { palette: { rule: '#cbd5e1' } })
    expect(edited).toContain("rule: '#cbd5e1'")
    expect(edited).toContain("accent: '#1d4ed8'")
  })

  it('adds a whole group', () => {
    const edited = editDesign(SOURCE, { fonts: { body: 'Georgia' } })
    expect(edited).toContain("fonts: { body: 'Georgia' }")
    expect(readDesignLiteral(edited)?.fonts).toEqual({ body: 'Georgia' })
  })

  it('applies several edits at once without corrupting offsets', () => {
    const edited = editDesign(SOURCE, {
      palette: { accent: '#16a34a', band: '#ffffff' },
      formats: { percent: '0.00%', currency: '#,##0.00' },
    })
    expect(readDesignLiteral(edited)).toEqual({
      palette: { accent: '#16a34a', band: '#ffffff' },
      formats: { percent: '0.00%', currency: '#,##0.00' },
    })
  })

  it('writes numbers unquoted', () => {
    const edited = editDesign(SOURCE, { fontSizes: { body: 12 } })
    expect(edited).toContain('body: 12')
  })

  it('refuses a design it cannot safely rewrite, rather than replacing it', () => {
    // Rewriting this into a literal would silently discard whatever `base` held.
    expect(() =>
      editDesign('export const design = { ...base }', { palette: { accent: '#000' } }),
    ).not.toThrow()
    expect(() => editDesign('export const design = base', { palette: { accent: '#000' } })).toThrow(
      /no `export const design/,
    )
  })
})
