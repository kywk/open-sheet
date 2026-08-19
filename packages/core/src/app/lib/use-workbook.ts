/** @jsxImportSource react */

import { workbooks as manifest } from 'virtual:open-sheet/manifest'
import { useEffect, useState } from 'react'
import { compile } from '../../compile/compile.js'
import type { CompiledWorkbook } from '../../compile/emit.js'
import { evaluateWorkbook, type ValueMap } from '../../formula/evaluate.js'

export interface LoadedWorkbook {
  id: string
  title: string
  book: CompiledWorkbook
  values: ValueMap
}

export type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; workbook: LoadedWorkbook }
  | { status: 'error'; message: string; stack?: string }

/**
 * Compilation and evaluation both run here, in the browser. The compiler is
 * pure and DOM-free, so there is no server round-trip between an edit and the
 * grid updating — the module reload *is* the update.
 */
export function useWorkbook(id: string | undefined): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!id) {
      setState({ status: 'loading' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })

    const entry = manifest.find((item) => item.id === id)
    if (!entry) {
      setState({ status: 'error', message: `no workbook "${id}"` })
      return
    }

    entry
      .load()
      .then((module) => {
        if (cancelled) return
        const book = compile(module.default, { design: module.design as never })
        const values = evaluateWorkbook(book)
        setState({
          status: 'ready',
          workbook: { id, title: module.meta?.title ?? id, book, values },
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
      })

    return () => {
      cancelled = true
    }
  }, [id])

  return state
}

export function useManifest(): { id: string; title: string }[] {
  const [titles, setTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all(
      manifest.map(async (entry) => {
        try {
          const module = await entry.load()
          return [entry.id, module.meta?.title ?? entry.id] as const
        } catch {
          return [entry.id, entry.id] as const
        }
      }),
    ).then((pairs) => {
      if (!cancelled) setTitles(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return manifest.map((entry) => ({ id: entry.id, title: titles[entry.id] ?? entry.id }))
}
