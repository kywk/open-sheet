/** @jsxImportSource react */
import { useEffect, useState } from 'react'
import { DESIGN_TOKENS } from '../../style/design.js'

type Patch = Record<string, Record<string, string | number>>

interface DesignResult {
  hash: string
  design?: Patch
  editable: boolean
  reason?: string
}

interface Props {
  workbookId: string
  onClose: () => void
}

const FORMAT_CHOICES: Record<string, { value: string; label: string }[]> = {
  currency: [
    { value: '#,##0', label: '12,400,000' },
    { value: '#,##0.00', label: '12,400,000.00' },
    { value: '#,##0,,"M"', label: '12M' },
    { value: '_(* #,##0_);_(* (#,##0);_(* "-"_);_(@_)', label: 'accounting' },
  ],
  percent: [
    { value: '0%', label: '60%' },
    { value: '0.0%', label: '60.3%' },
    { value: '0.00%', label: '60.29%' },
  ],
}

const FONT_CHOICES = ['Calibri', 'Arial', 'Helvetica Neue', 'Georgia', 'Times New Roman']

/**
 * Writes back into the workbook's `design` literal. A workbook whose design is
 * built from a spread or an import has nothing to splice, and the panel says so
 * rather than rewriting it — that would discard whatever it was spreading.
 */
export function DesignPanel({ workbookId, onClose }: Props) {
  const [state, setState] = useState<DesignResult | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/__open-sheet/api/design?id=${encodeURIComponent(workbookId)}`)
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled) setState(body as DesignResult)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught))
      })
    return () => {
      cancelled = true
    }
  }, [workbookId])

  const apply = async (group: string, key: string, value: string | number) => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch('/__open-sheet/api/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workbookId,
          patch: { [group]: { [key]: value } },
          hash: state?.hash,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error((body as { error?: string }).error ?? response.statusText)
      setState((current) =>
        current
          ? {
              ...current,
              hash: (body as { hash: string }).hash,
              design: {
                ...current.design,
                [group]: { ...current.design?.[group], [key]: value },
              },
            }
          : current,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  const tokenValue = (group: string, key: string): string =>
    String(state?.design?.[group]?.[key] ?? '')

  return (
    <aside className="os-inspector">
      <header>
        <strong>Design</strong>
        <button
          type="button"
          className="os-close"
          onClick={onClose}
          aria-label="Close design panel"
        >
          ×
        </button>
      </header>

      {!state ? <p className="os-muted">Loading…</p> : null}

      {state && !state.editable ? (
        <div className="os-why">
          <p className="os-muted">{state.reason}</p>
          <p className="os-muted">Add one to the workbook, then reload:</p>
          <pre className="os-markdown">{`export const design: DesignSystem = {
  palette: { accent: '#1d4ed8' },
  formats: { currency: '#,##0' },
}`}</pre>
          <p className="os-muted">
            Or ask your agent for <code>/create-theme</code>.
          </p>
        </div>
      ) : null}

      {state?.editable
        ? DESIGN_TOKENS.map((token) => {
            const current = tokenValue(token.group, token.key)
            const set = current !== ''

            if (token.kind === 'color') {
              return (
                <section key={`${token.group}.${token.key}`}>
                  <label htmlFor={`os-d-${token.key}`}>
                    {token.label}
                    {/* An unset colour must not be shown as black — it falls
                        through to the theme, and a swatch claiming #000000 says
                        the opposite. */}
                    {set ? null : <span className="os-unset">theme default</span>}
                  </label>
                  <input
                    id={`os-d-${token.key}`}
                    type="color"
                    className={`os-color${set ? '' : ' is-unset'}`}
                    disabled={busy}
                    value={set ? current : '#ffffff'}
                    onChange={(event) => void apply(token.group, token.key, event.target.value)}
                  />
                </section>
              )
            }

            const choices =
              token.kind === 'font'
                ? FONT_CHOICES.map((font) => ({ value: font, label: font }))
                : (FORMAT_CHOICES[token.key] ?? [])
            // A value the list does not know about is still set. Dropping to
            // "(theme default)" tells the author their setting did not take,
            // and sends them debugging something that is working.
            const known = choices.some((choice) => choice.value === current)

            return (
              <section key={`${token.group}.${token.key}`}>
                <label htmlFor={`os-d-${token.key}`}>{token.label}</label>
                <select
                  id={`os-d-${token.key}`}
                  disabled={busy}
                  value={current}
                  onChange={(event) => void apply(token.group, token.key, event.target.value)}
                >
                  <option value="">(theme default)</option>
                  {set && !known ? (
                    <option value={current}>{current} — set in this workbook</option>
                  ) : null}
                  {choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </section>
            )
          })
        : null}

      {state?.editable ? (
        <p className="os-muted">
          Written straight into <code>export const design</code>. Reload to see the grid follow.
        </p>
      ) : null}

      {error ? <p className="os-error">{error}</p> : null}
    </aside>
  )
}
