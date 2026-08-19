import { unzipSync, zipSync } from 'fflate'
import type { CompiledWorkbook, PlacedChart } from '../compile/emit.js'
import { qualify, rangeToA1 } from '../model/a1.js'
import { type ResolveContext, resolveRef } from '../refs/resolve.js'

const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'

const SERIES_COLORS = ['1D4ED8', '0EA5E9', '16A34A', 'D97706', 'DC2626', '7C3AED']

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (ch) =>
    ch === '<'
      ? '&lt;'
      : ch === '>'
        ? '&gt;'
        : ch === '&'
          ? '&amp;'
          : ch === "'"
            ? '&apos;'
            : '&quot;',
  )
}

interface ResolvedSeries {
  name: string
  range: string
  color: string
  count: number
}

function resolveRange(ref: Parameters<typeof resolveRef>[0], context: ResolveContext) {
  const resolved = resolveRef(ref, context)
  return {
    range: qualify(
      resolved.sheet,
      rangeToA1(resolved.rect, { absoluteRow: true, absoluteCol: true }),
    ),
    count: resolved.rect.rows * resolved.rect.cols,
  }
}

function seriesXml(
  series: ResolvedSeries[],
  categories: string,
  kind: PlacedChart['chart'],
): string {
  return series
    .map((entry, index) => {
      const cat = `<c:cat><c:strRef><c:f>${escapeXml(categories)}</c:f></c:strRef></c:cat>`
      const values = `<c:val><c:numRef><c:f>${escapeXml(entry.range)}</c:f></c:numRef></c:val>`
      const fill =
        kind === 'pie'
          ? ''
          : `<c:spPr><a:solidFill><a:srgbClr val="${entry.color}"/></a:solidFill></c:spPr>`
      const marker = kind === 'line' ? '<c:marker><c:symbol val="none"/></c:marker>' : ''
      return (
        `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>` +
        `<c:tx><c:v>${escapeXml(entry.name)}</c:v></c:tx>` +
        fill +
        marker +
        cat +
        values +
        '</c:ser>'
      )
    })
    .join('')
}

function plotXml(kind: PlacedChart['chart'], series: ResolvedSeries[], categories: string): string {
  const inner = seriesXml(series, categories, kind)
  if (kind === 'pie') {
    return `<c:pieChart><c:varyColors val="1"/>${inner}</c:pieChart>`
  }
  if (kind === 'line') {
    return (
      '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>' +
      inner +
      '<c:marker val="1"/><c:axId val="111111111"/><c:axId val="222222222"/></c:lineChart>'
    )
  }
  return (
    '<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>' +
    inner +
    '<c:gapWidth val="60"/><c:axId val="111111111"/><c:axId val="222222222"/></c:barChart>'
  )
}

function axesXml(kind: PlacedChart['chart']): string {
  if (kind === 'pie') return ''
  return (
    '<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling>' +
    '<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/></c:catAx>' +
    '<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling>' +
    '<c:delete val="0"/><c:axPos val="l"/>' +
    '<c:majorGridlines/><c:crossAx val="111111111"/></c:valAx>'
  )
}

function chartXml(chart: PlacedChart, context: ResolveContext): string {
  const categories = resolveRange(chart.categories, context)
  const series: ResolvedSeries[] = chart.series.map((entry, index) => {
    const resolved = resolveRange(entry.values, context)
    return {
      name: entry.name,
      range: resolved.range,
      count: resolved.count,
      color: SERIES_COLORS[index % SERIES_COLORS.length] as string,
    }
  })

  const title = chart.title
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${escapeXml(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    : '<c:autoTitleDeleted val="1"/>'

  const legend =
    series.length > 1 || chart.chart === 'pie'
      ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>'
      : ''

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
    '<c:chart>' +
    title +
    '<c:plotArea><c:layout/>' +
    plotXml(chart.chart, series, categories.range) +
    axesXml(chart.chart) +
    '</c:plotArea>' +
    legend +
    '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>' +
    '</c:chart></c:chartSpace>'
  )
}

function drawingXml(charts: PlacedChart[]): string {
  const anchors = charts
    .map((chart, index) => {
      const { r, c, rows, cols } = chart.rect
      return (
        '<xdr:twoCellAnchor editAs="oneCell">' +
        `<xdr:from><xdr:col>${c}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:to><xdr:col>${c + cols}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r + rows}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
        '<xdr:graphicFrame macro="">' +
        `<xdr:nvGraphicFramePr><xdr:cNvPr id="${index + 2}" name="Chart ${index + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
        `<c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${index + 1}"/>` +
        '</a:graphicData></a:graphic></xdr:graphicFrame>' +
        '<xdr:clientData/></xdr:twoCellAnchor>'
      )
    })
    .join('')

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}">${anchors}</xdr:wsDr>`
  )
}

function drawingRels(count: number, firstChart: number): string {
  const rels = Array.from({ length: count }, (_, i) => {
    const target = `../charts/chart${firstChart + i}.xml`
    return `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="${target}"/>`
  }).join('')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
  )
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()

/**
 * ExcelJS has no chart support, and an embedded image would go stale the moment
 * a number changed — so the chart parts are written into the package it
 * produced. Everything here is bound to cell ranges, which is what keeps the
 * chart live.
 */
export function injectCharts(zip: Buffer, book: CompiledWorkbook): Buffer {
  const withCharts = book.sheets
    .map((sheet, index) => ({ sheet, index }))
    .filter(({ sheet }) => sheet.charts.length > 0)

  if (withCharts.length === 0) return zip

  const files = unzipSync(new Uint8Array(zip))
  let chartNumber = 1

  for (const { sheet, index } of withCharts) {
    const sheetNumber = index + 1
    const drawingNumber = sheetNumber
    const firstChart = chartNumber

    const context: ResolveContext = {
      registry: book.registry,
      definedNames: book.definedNames,
      sheet: sheet.name,
    }

    for (const chart of sheet.charts) {
      files[`xl/charts/chart${chartNumber}.xml`] = encoder.encode(chartXml(chart, context))
      chartNumber += 1
    }

    files[`xl/drawings/drawing${drawingNumber}.xml`] = encoder.encode(drawingXml(sheet.charts))
    files[`xl/drawings/_rels/drawing${drawingNumber}.xml.rels`] = encoder.encode(
      drawingRels(sheet.charts.length, firstChart),
    )

    const sheetPath = `xl/worksheets/sheet${sheetNumber}.xml`
    const relsPath = `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`
    const relId = addSheetRel(files, relsPath, drawingNumber)
    files[sheetPath] = encoder.encode(addDrawingElement(text(files[sheetPath]), relId))
  }

  files['[Content_Types].xml'] = encoder.encode(
    addContentTypes(text(files['[Content_Types].xml']), chartNumber - 1, withCharts.length),
  )

  return Buffer.from(zipSync(files))
}

function text(data: Uint8Array | undefined): string {
  if (!data) throw new Error('the workbook package is missing a part charts need')
  return decoder.decode(data)
}

function addSheetRel(
  files: Record<string, Uint8Array>,
  relsPath: string,
  drawingNumber: number,
): string {
  const existing = files[relsPath]
  const target = `../drawings/drawing${drawingNumber}.xml`
  const type = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing'

  if (!existing) {
    const id = 'rId1'
    files[relsPath] = encoder.encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`,
    )
    return id
  }

  const xml = decoder.decode(existing)
  // Continue the sheet's own numbering; colliding with an existing id makes the
  // file open to an error dialog rather than a chart.
  const used = [...xml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]))
  const id = `rId${Math.max(0, ...used) + 1}`
  files[relsPath] = encoder.encode(
    xml.replace(
      '</Relationships>',
      `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`,
    ),
  )
  return id
}

/** `<drawing/>` has a fixed position in the sheet schema; misplacing it invalidates the file. */
const AFTER_DRAWING = ['</legacyDrawing>', '</picture>', '</oleObjects>']

function addDrawingElement(sheetXml: string, relId: string): string {
  const element = `<drawing r:id="${relId}"/>`
  if (sheetXml.includes('<drawing ')) return sheetXml

  for (const marker of AFTER_DRAWING) {
    const at = sheetXml.indexOf(marker)
    if (at !== -1)
      return sheetXml.slice(0, at + marker.length) + element + sheetXml.slice(at + marker.length)
  }
  return sheetXml.replace('</worksheet>', `${element}</worksheet>`)
}

function addContentTypes(xml: string, charts: number, drawings: number): string {
  const parts: string[] = []
  if (!xml.includes('Extension="xml"')) {
    parts.push('<Default Extension="xml" ContentType="application/xml"/>')
  }
  for (let i = 1; i <= charts; i += 1) {
    parts.push(
      `<Override PartName="/xl/charts/chart${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
    )
  }
  for (let i = 1; i <= drawings; i += 1) {
    if (xml.includes(`/xl/drawings/drawing${i}.xml"`)) continue
    parts.push(
      `<Override PartName="/xl/drawings/drawing${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
    )
  }
  return xml.replace('</Types>', `${parts.join('')}</Types>`)
}
