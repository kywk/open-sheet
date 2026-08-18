/** @jsxImportSource react */
interface Props {
  workbooks: { id: string; title: string }[]
  active: string | undefined
  onSelect: (id: string) => void
}

export function Sidebar({ workbooks, active, onSelect }: Props) {
  return (
    <aside className="os-sidebar">
      <div className="os-brand">
        <span className="os-mark" aria-hidden="true" />
        open-sheet
      </div>
      <nav className="os-nav">
        <div className="os-nav-label">Workbooks</div>
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
    </aside>
  )
}
