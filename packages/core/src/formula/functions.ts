import * as formulajs from '@formulajs/formulajs'
import { isWhitelisted } from './expr.js'

type Implementation = (...args: any[]) => unknown

const LIBRARY = formulajs as unknown as Record<string, Implementation>

/**
 * Dispatch is whitelist-only and resolved through this map — never by looking up
 * an arbitrary name on the library object at call time.
 */
export function lookup(name: string): Implementation | undefined {
  const upper = name.toUpperCase()
  if (!isWhitelisted(upper)) return undefined
  const implementation = LIBRARY[upper]
  return typeof implementation === 'function' ? implementation : undefined
}
