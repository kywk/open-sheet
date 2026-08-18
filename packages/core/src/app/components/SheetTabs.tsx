/** @jsxImportSource react */
import type { CompiledWorkbook } from '../../compile/emit.js'

interface Props {
  book: CompiledWorkbook
  active: number
  onSelect: (index: number) => void
}

export function SheetTabs({ book, active, onSelect }: Props) {
  return (
    <div className="os-tabs" role="tablist">
      {book.sheets.map((sheet, index) => (
        <button
          key={sheet.name}
          type="button"
          role="tab"
          aria-selected={index === active}
          className={`os-tab${index === active ? ' is-active' : ''}`}
          onClick={() => onSelect(index)}
        >
          {sheet.name}
        </button>
      ))}
    </div>
  )
}
