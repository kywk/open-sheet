/** @jsxImportSource react */
import type { View } from './Workspace.js'

interface Props {
  workbooks: { id: string; title: string }[]
  active: string | undefined
  view: View
  onView: (view: View) => void
  onSelect: (id: string) => void
}

const VIEWS: { view: View; label: string }[] = [
  { view: 'workbooks', label: 'Workbooks' },
  { view: 'themes', label: 'Themes' },
  { view: 'assets', label: 'Assets' },
]

export function Sidebar({ workbooks, active, view, onView, onSelect }: Props) {
  return (
    <aside className="os-sidebar">
      <div className="os-brand">
        <span className="os-mark" aria-hidden="true" />
        open-sheet
      </div>

      <nav className="os-views">
        {VIEWS.map((entry) => (
          <button
            key={entry.view}
            type="button"
            className={`os-view${view === entry.view ? ' is-active' : ''}`}
            aria-pressed={view === entry.view}
            onClick={() => onView(entry.view)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {view === 'workbooks' ? (
        <nav className="os-nav">
          {workbooks.length === 0 ? (
            <p className="os-empty">
              No workbooks yet. Create <code>sheets/&lt;id&gt;/index.tsx</code>.
            </p>
          ) : (
            workbooks.map((workbook) => (
              <button
                key={workbook.id}
                type="button"
                className={`os-nav-item${workbook.id === active ? ' is-active' : ''}`}
                onClick={() => onSelect(workbook.id)}
              >
                {workbook.title}
              </button>
            ))
          )}
        </nav>
      ) : null}
    </aside>
  )
}
