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

        {/* Keyed by id so switching workbooks resets the sheet and selection,
            rather than an effect racing the new compile. */}
        {view === 'workbooks' && state.status === 'ready' ? (
          <WorkbookView key={state.workbook.id} workbook={state.workbook} />
        ) : null}
      </main>
    </div>
  )
}

function WorkbookView({ workbook }: { workbook: LoadedWorkbook }) {
  const [sheetIndex, setSheetIndex] = useState(0)
  const [selection, setSelection] = useState<Selection>({ r: 0, c: 0 })
  const [panel, setPanel] = useState<'none' | 'inspect' | 'design'>('none')

  const sheet = workbook.book.sheets[sheetIndex]
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
        sheetIndex={sheetIndex}
        selection={selection}
      />
      <div className="os-body">
        {sheet ? (
          <Grid
            key={sheetIndex}
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
      <SheetTabs book={workbook.book} active={sheetIndex} onSelect={setSheetIndex} />
    </>
  )
}

function countSkipped(values: Map<string, unknown>): number {
  let count = 0
  for (const value of values.values()) if (isNotEvaluated(value)) count += 1
  return count
}
