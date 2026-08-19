/** @jsxImportSource react */
import { useEffect, useState } from 'react'

export type View = 'workbooks' | 'themes' | 'assets'

interface ThemeSummary {
  id: string
  name: string
  description?: string
  hasDemo: boolean
}

interface AssetSummary {
  name: string
  bytes: number
  kind: string
  unused: boolean
  importLine: string
}

function useJson<T>(url: string | undefined): T | undefined {
  const [data, setData] = useState<T | undefined>()
  useEffect(() => {
    if (!url) return
    let cancelled = false
    fetch(url)
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled) setData(body as T)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [url])
  return data
}

export function Themes() {
  const data = useJson<{ themes: ThemeSummary[] }>('/__open-sheet/api/themes')
  const [open, setOpen] = useState<string | undefined>()
  const detail = useJson<{ markdown: string }>(
    open ? `/__open-sheet/api/themes?id=${encodeURIComponent(open)}` : undefined,
  )

  if (!data) return <div className="os-status">Loading…</div>

  if (data.themes.length === 0) {
    return (
      <div className="os-status">
        <p>No themes yet.</p>
        <p className="os-muted">
          A theme is a house style in <code>themes/&lt;id&gt;.md</code>. Ask your agent for{' '}
          <code>/create-theme</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="os-gallery">
      {data.themes.map((theme) => (
        <article key={theme.id} className="os-card">
          <h3>{theme.name}</h3>
          {theme.description ? <p>{theme.description}</p> : null}
          <div className="os-card-foot">
            <code>meta.theme: '{theme.id}'</code>
            <button type="button" onClick={() => setOpen(open === theme.id ? undefined : theme.id)}>
              {open === theme.id ? 'Hide' : 'Read'}
            </button>
          </div>
          {open === theme.id ? (
            <pre className="os-markdown">{detail?.markdown ?? 'Loading…'}</pre>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function Assets() {
  const data = useJson<{ assets: AssetSummary[] }>('/__open-sheet/api/assets')
  const [copied, setCopied] = useState<string | undefined>()

  if (!data) return <div className="os-status">Loading…</div>

  if (data.assets.length === 0) {
    return (
      <div className="os-status">
        <p>No assets yet.</p>
        <p className="os-muted">
          Drop images or fonts into an <code>assets/</code> directory beside <code>sheets/</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="os-gallery">
      {data.assets.map((asset) => (
        <article key={asset.name} className="os-card">
          <h3>
            {asset.name}
            {asset.unused ? (
              <span
                className="os-badge"
                title="No workbook or theme mentions this file. A computed path would also look unused, so nothing is removed automatically."
              >
                unused
              </span>
            ) : null}
          </h3>
          <p className="os-muted">
            {asset.kind} · {size(asset.bytes)}
          </p>
          <div className="os-card-foot">
            <code>{asset.importLine}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(asset.importLine)
                setCopied(asset.name)
              }}
            >
              {copied === asset.name ? 'Copied' : 'Copy'}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
