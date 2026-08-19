/** @jsxImportSource react */
interface Props {
  title: string
  workbookId: string
  notEvaluated: number
  inspecting: boolean
  designing: boolean
  onToggleInspect: () => void
  onToggleDesign: () => void
}

const FORMATS = [
  { format: 'xlsx', label: 'XLSX' },
  { format: 'csv', label: 'CSV' },
  { format: 'html', label: 'HTML' },
] as const

export function Toolbar({
  title,
  workbookId,
  notEvaluated,
  inspecting,
  designing,
  onToggleInspect,
  onToggleDesign,
}: Props) {
  return (
    <header className="os-toolbar">
      <h1>{title}</h1>
      {notEvaluated > 0 ? (
        <span
          className="os-badge"
          title="These export as live formulas; open-sheet did not compute them here."
        >
          {notEvaluated} not evaluated
        </span>
      ) : null}
      <div className="os-spacer" />
      <button
        type="button"
        className={`os-toggle${designing ? ' is-active' : ''}`}
        aria-pressed={designing}
        onClick={onToggleDesign}
      >
        Design
      </button>
      <button
        type="button"
        className={`os-toggle${inspecting ? ' is-active' : ''}`}
        aria-pressed={inspecting}
        onClick={onToggleInspect}
      >
        Inspect
      </button>
      <div className="os-downloads">
        {FORMATS.map(({ format, label }) => (
          <a
            key={format}
            className="os-download"
            href={`/__open-sheet/api/export?id=${encodeURIComponent(workbookId)}&format=${format}`}
          >
            {label}
          </a>
        ))}
      </div>
    </header>
  )
}
