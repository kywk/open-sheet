/** @jsxImportSource react */
interface Props {
  title: string
  workbookId: string
  notEvaluated: number
}

const FORMATS = [
  { format: 'xlsx', label: 'XLSX' },
  { format: 'csv', label: 'CSV' },
  { format: 'html', label: 'HTML' },
] as const

export function Toolbar({ title, workbookId, notEvaluated }: Props) {
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
