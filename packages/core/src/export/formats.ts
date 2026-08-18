/**
 * Named formats resolve to Excel number-format codes. Anything that already
 * looks like a format code is passed through, so a workbook can use a code we
 * have no name for without waiting on the framework.
 */
const NAMED: Record<string, string> = {
  general: 'General',
  number: '#,##0',
  decimal: '#,##0.00',
  currency: '#,##0',
  currency2: '#,##0.00',
  accounting: '_(* #,##0_);_(* (#,##0);_(* "-"_);_(@_)',
  percent: '0.0%',
  percent0: '0%',
  percent2: '0.00%',
  millions: '#,##0,,"M"',
  thousands: '#,##0,"K"',
  date: 'yyyy-mm-dd',
  datetime: 'yyyy-mm-dd hh:mm',
  text: '@',
}

export function numberFormat(format: string | undefined): string | undefined {
  if (!format) return undefined
  const named = NAMED[format]
  if (named) return named
  return format
}

export function isNamedFormat(format: string): boolean {
  return format in NAMED
}

export const NAMED_FORMATS = Object.freeze({ ...NAMED })
