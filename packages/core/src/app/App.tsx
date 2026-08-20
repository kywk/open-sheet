/** @jsxImportSource react */
import { useEffect, useState } from 'react'
import { isNotEvaluated } from '../formula/value.js'
import { toA1 } from '../model/a1.js'
import { DesignPanel } from './components/DesignPanel.js'
import { FormulaBar } from './components/FormulaBar.js'
import { Grid, type Selection } from './components/Grid.js'
import { Inspector } from './components/Inspector.js'
import { SheetTabs } from './components/SheetTabs.js'
import { Sidebar } from './components/Sidebar.js'
import { Toolbar } from './components/Toolbar.js'
import { Assets, Themes, type View } from './components/Workspace.js'
import { type LoadedWorkbook, useManifest, useWorkbook } from './lib/use-workbook.js'

function idFromLocation(): string | undefined {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '')
  return path === '' ? undefined : decodeURIComponent(path)
}

export function App() {
  const workbooks = useManifest()
  const [activeId, setActiveId] = useState<string | undefined>(idFromLocation)
  const [view, setView] = useState<View>('workbooks')
  const resolvedId = activeId ?? workbooks[0]?.id
  const state = useWorkbook(view === 'workbooks' ? resolvedId : undefined)

  const select = (id: string) => {
    setActiveId(id)
    setView('workbooks')
    window.history.pushState({}, '', `/${encodeURIComponent(id)}`)
  }

  return (
    <div className="os-shell">
      <Sidebar
        workbooks={workbooks}
        active={resolvedId}
        view={view}
        onView={setView}
        onSelect={select}
      />
      <main className="os-main">
        {view === 'themes' ? <Themes /> : null}
        {view === 'assets' ? <Assets /> : null}

        {view === 'workbooks' && state.status === 'loading' ? (
          <div className="os-status">Compiling…</div>
        ) : null}

        {view === 'workbooks' && state.status === 'error' ? (
          <div className="os-status os-status-error">
            <h2>This workbook did not compile</h2>
            <pre>{state.message}</pre>
            {state.stack ? <pre className="os-stack">{state.stack}</pre> : null}
          </div>
        ) : null}

        {/* Keyed by id, not by the workbook object: an edit written back from
            the Inspector reloads the module and produces a new object, and
            remounting on that threw the reader back to the first sheet with the
            panel closed — losing your place on every single-cell edit. */}
        {view === 'workbooks' && state.status === 'ready' ? (
          <WorkbookView key={state.workbook.id} workbook={state.workbook} />
        ) : null}
      </main>
    </div>
  )
}

/**
 * Writing an edit back through the Inspector changes the workbook source, which
 * Vite answers with a full page reload — nothing in the graph accepts the HMR
 * update. Without this, every single-cell edit threw the reader back to the
 * first sheet with the panel closed, which makes editing several cells in a row
 * far more annoying than the edit itself is worth.
 */
interface Place {
  sheetIndex: number
  selection: Selection
  panel: 'none' | 'inspect' | 'design'
}

function placeKey(id: string): string {
  return `open-sheet:place:${id}`
}

function readPlace(id: string): Place | undefined {
  try {
    const raw = sessionStorage.getItem(placeKey(id))
    return raw ? (JSON.parse(raw) as Place) : undefined
  } catch {
    return undefined
  }
}

function WorkbookView({ workbook }: { workbook: LoadedWorkbook }) {
  const restored = readPlace(workbook.id)
  const [sheetIndex, setSheetIndex] = useState(restored?.sheetIndex ?? 0)
  const [selection, setSelection] = useState<Selection>(restored?.selection ?? { r: 0, c: 0 })
  const [panel, setPanel] = useState<'none' | 'inspect' | 'design'>(restored?.panel ?? 'none')

  useEffect(() => {
    try {
      sessionStorage.setItem(
        placeKey(workbook.id),
        JSON.stringify({ sheetIndex, selection, panel }),
      )
    } catch {
      // a viewer that cannot remember where you were is still a working viewer
    }
  }, [workbook.id, sheetIndex, selection, panel])

  const safeIndex = Math.min(sheetIndex, Math.max(workbook.book.sheets.length - 1, 0))
  const sheet = workbook.book.sheets[safeIndex]
  const sheetName = sheet?.name

  // Publish where the reader is, so /current-sheet can answer "this one".
  useEffect(() => {
    const body = JSON.stringify({ id: workbook.id, sheet: sheetName, cell: toA1(selection) })
    const timer = setTimeout(() => {
      void fetch('/__open-sheet/api/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }).catch(() => undefined)
    }, 250)
    return () => clearTimeout(timer)
  }, [workbook.id, sheetName, selection])

  return (
    <>
      <Toolbar
        title={workbook.title}
        workbookId={workbook.id}
        notEvaluated={countSkipped(workbook.values)}
        inspecting={panel === 'inspect'}
        designing={panel === 'design'}
        onToggleInspect={() => setPanel((p) => (p === 'inspect' ? 'none' : 'inspect'))}
        onToggleDesign={() => setPanel((p) => (p === 'design' ? 'none' : 'design'))}
      />
      <FormulaBar
        book={workbook.book}
        values={workbook.values}
        sheetIndex={safeIndex}
        selection={selection}
      />
      <div className="os-body">
        {sheet ? (
          <Grid
            key={safeIndex}
            sheet={sheet}
            values={workbook.values}
            selection={selection}
            onSelect={setSelection}
          />
        ) : null}
        {panel === 'inspect' && sheetName ? (
          <Inspector
            workbookId={workbook.id}
            sheet={sheetName}
            selection={selection}
            onClose={() => setPanel('none')}
          />
        ) : null}
        {panel === 'design' ? (
          <DesignPanel workbookId={workbook.id} onClose={() => setPanel('none')} />
        ) : null}
      </div>
      <SheetTabs book={workbook.book} active={safeIndex} onSelect={setSheetIndex} />
    </>
  )
}

function countSkipped(values: Map<string, unknown>): number {
  let count = 0
  for (const value of values.values()) if (isNotEvaluated(value)) count += 1
  return count
}
