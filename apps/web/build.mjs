import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile, evaluateWorkbook, toHtml } from '@open-sheet/core'
import book from './sheet.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')

/**
 * The sheet on the page is compiled by the framework the page is advertising,
 * and the code beside it is lifted out of the file that produced it. Neither
 * can drift from the other, or from the release, without the build noticing.
 */
function excerpt() {
  const source = readFileSync(join(here, 'sheet.mjs'), 'utf8')
  const body = source.split('// #region shown')[1]?.split('// #endregion shown')[0]
  if (!body) throw new Error('sheet.mjs has lost its // #region shown marker')
  return body
    .replace(/^\s*const columns = \[\n/, '')
    .replace(/\n\]\s*$/, '')
    .split('\n')
    .map((line) => line.replace(/^ {2}/, ''))
    .join('\n')
    .trim()
}

const KEYWORDS = [
  'col',
  'sub',
  'div',
  'formula',
  'header',
  'format',
  'scale',
  'highlight',
  'above',
  'fill',
  'bold',
  'bar',
]

function code(text) {
  let out = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  out = out.replace(/('[^']*')/g, '<i class="s">$1</i>')
  for (const word of KEYWORDS) {
    out = out.replace(new RegExp(`\\b${word}\\b(?![^<]*</i>)`, 'g'), `<i class="k">${word}</i>`)
  }
  return out.replace(/\b(r)\.(cell|prev|isFirst)\b/g, '<i class="v">$1</i>.<i class="m">$2</i>')
}

/** The sheet, lifted out of a full HTML export and restyled by the page. */
function sheetMarkup() {
  const compiled = compile(book)
  const html = toHtml(compiled, { title: 'P&L', values: evaluateWorkbook(compiled) })
  const body = /<body>([\s\S]*)<\/body>/.exec(html)[1]
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)[1]
  return { body, style }
}

const { body, style } = sheetMarkup()
const version = JSON.parse(
  readFileSync(join(here, '..', '..', 'packages', 'core', 'package.json'), 'utf8'),
).version

const page = readFileSync(join(here, 'index.html'), 'utf8')
  .replace('/* SHEET_STYLE */', style)
  .replace('<!-- SHEET -->', body)
  .replace('<!-- CODE -->', code(excerpt()))
  .replaceAll('<!--version-->', version)

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
writeFileSync(join(dist, 'index.html'), page)
cpSync(join(here, 'public'), dist, { recursive: true })

console.log(`built dist/ for @open-sheet/core ${version}`)
