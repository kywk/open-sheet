/** @jsxImportSource react */
import { useEffect, useState } from 'react'
import { toA1 } from '../../model/a1.js'
import type { Selection } from './Grid.js'

interface InspectResult {
  origin?: { block: string; kind: string; column?: string; row?: number; part: string }
  formula?: string
  value?: string
  editable: boolean
  current?: string
  location?: string
  reason?: string
  hash?: string
}

interface Props {
  workbookId: string
  sheet: string
  selection: Selection
  onClose: () => void
}

async function post<T>(route: string, body: unknown): Promise<T> {
  const response = await fetch(`/__open-sheet/api/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error((payload as { error?: string }).error ?? response.statusText)
  return payload as T
}

/**
 * The author never wrote an address, so when a number looks wrong the useful
 * answer is not "cell B7" — it is *which construct produced it*. This panel
 * leads with that, then offers the two things that can be done about it.
 */
export function Inspector({ workbookId, sheet, selection, onClose }: Props) {
  const [state, setState] = useState<InspectResult | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const cell = toA1(selection)

  useEffect(() => {
    let cancelled = false
    setError(undefined)
    post<InspectResult>('inspect', { id: workbookId, sheet, cell })
      .then((result) => {
        if (cancelled) return
        setState(result)
        setDraft(result.current ?? '')
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught))
      })
    return () => {
      cancelled = true
    }
  }, [workbookId, sheet, cell])

  const apply = async (route: 'edit' | 'comment') => {
    setBusy(true)
    setError(undefined)
    try {
      await post(route, {
        id: workbookId,
        sheet,
        cell,
        hash: state?.hash,
        ...(route === 'edit' ? { value: draft, expected: state?.current } : { text: note }),
      })
      if (route === 'comment') setNote('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="os-inspector">
      <header>
        <strong>{cell}</strong>
        <button type="button" className="os-close" onClick={onClose} aria-label="Close inspector">
          ×
        </button>
      </header>

      {state?.origin ? (
        <dl className="os-origin">
          <dt>Came from</dt>
          <dd>
            <code>{state.origin.block}</code>
            {state.origin.column ? (
              <>
                {' · column '}
                <code>{state.origin.column}</code>
              </>
            ) : null}
            {state.origin.row !== undefined ? ` · row ${state.origin.row + 1}` : null}
            {state.origin.part !== 'data' ? ` · ${state.origin.part}` : null}
          </dd>
          {state.location ? (
            <>
              <dt>Source</dt>
              <dd className="os-path">{state.location}</dd>
            </>
          ) : null}
          {state.formula ? (
            <>
              <dt>Formula</dt>
              <dd className="os-mono">{state.formula}</dd>
            </>
          ) : null}
          <dt>Value</dt>
          <dd className="os-mono">{state.value || '—'}</dd>
        </dl>
      ) : (
        <p className="os-muted">{state?.reason ?? 'Loading…'}</p>
      )}

      {state?.editable ? (
        <section>
          <label htmlFor="os-edit">Value in source</label>
          <input
            id="os-edit"
            className="os-mono"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="button" disabled={busy} onClick={() => void apply('edit')}>
            Write it back
          </button>
        </section>
      ) : state?.reason ? (
        <p className="os-muted os-why">{state.reason}</p>
      ) : null}

      {state?.origin ? (
        <section>
          <label htmlFor="os-note">Note for your agent</label>
          <textarea
            id="os-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. should this be net of returns?"
          />
          <button
            type="button"
            disabled={busy || !note.trim()}
            onClick={() => void apply('comment')}
          >
            Leave a note
          </button>
          <p className="os-muted">
            Stored in the source as <code>@sheet-comment</code>. Ask your agent for{' '}
            <code>/apply-comments</code>.
          </p>
        </section>
      ) : null}

      {error ? <p className="os-error">{error}</p> : null}
    </aside>
  )
}
