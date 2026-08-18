import { asRuns } from './compile/children.js'
import type { InlineRun } from './compile/nodes.js'

type Props = Record<string, unknown> & { children?: unknown }

const EMPHASIS: Record<string, InlineRun['emphasis']> = {
  b: 'bold',
  strong: 'bold',
  i: 'italic',
  em: 'italic',
  code: 'code',
}

function intrinsic(tag: string, props: Props): InlineRun {
  const emphasis = EMPHASIS[tag]
  if (!emphasis) {
    throw new TypeError(
      `<${tag}> is not an open-sheet element. Inline markup is limited to <b>, <i>, and <code>.`,
    )
  }
  const text = asRuns(props.children)
    .map((run) => run.text)
    .join('')
  return { text, emphasis }
}

export function jsx(type: unknown, props: Props): unknown {
  if (typeof type === 'function') return (type as (p: Props) => unknown)(props)
  if (typeof type === 'string') return intrinsic(type, props)
  throw new TypeError(`unsupported JSX element type: ${typeof type}`)
}

export const jsxs = jsx
export const jsxDEV = jsx

export function Fragment(props: Props): unknown {
  return props.children
}

export declare namespace JSX {
  type Element = any
  type ElementType = any
  interface ElementChildrenAttribute {
    children: unknown
  }
  interface IntrinsicElements {
    b: { children?: unknown }
    strong: { children?: unknown }
    i: { children?: unknown }
    em: { children?: unknown }
    code: { children?: unknown }
  }
}
