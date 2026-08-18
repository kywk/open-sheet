import {
  col,
  div,
  KpiBand,
  mul,
  Note,
  ref,
  Sheet,
  type SheetMeta,
  Stack,
  sub,
  sum,
  Table,
  Workbook,
} from '@open-sheet/core'

export const meta: SheetMeta = {
  title: 'Getting started',
  description: 'A tiny live model — change an assumption and watch it recalculate.',
}

// Data is a plain array. Replace it with yours.
interface Month {
  month: string
  units: number
}

const months: Month[] = [
  { month: 'Jan', units: 1_200 },
  { month: 'Feb', units: 1_350 },
  { month: 'Mar', units: 1_580 },
]

export default (
  <Workbook>
    {/* Every key here becomes an Excel defined name, so exported formulas
        read `=B5*price` rather than `=B5*$B$2`. */}
    <Sheet name="Assumptions">
      <Table
        name="assumptions"
        kind="keyValue"
        title="Assumptions"
        data={[
          { key: 'price', label: 'Unit price', value: 49, format: 'currency2' },
          { key: 'cogsRate', label: 'COGS as % of revenue', value: 0.38, format: 'percent' },
        ]}
      />
    </Sheet>

    <Sheet name="Revenue" freeze="B2">
      <Stack gap={1}>
        <KpiBand
          items={[
            { label: 'Total units', format: 'number', value: sum(ref('sales').column('units')) },
            { label: 'Revenue', format: 'currency', value: sum(ref('sales').column('revenue')) },
            {
              label: 'Gross margin',
              format: 'percent',
              value: div(
                sum(ref('sales').column('grossProfit')),
                sum(ref('sales').column('revenue')),
              ),
            },
          ]}
        />

        <Table
          name="sales"
          title="Monthly sales"
          data={months}
          columns={[
            col('month', { header: 'Month', width: 12 }),
            col('units', { header: 'Units', format: 'number', width: 12, bar: true }),
            col<Month>('revenue', {
              header: 'Revenue',
              format: 'currency',
              width: 14,
              // No cell addresses — a reference to the column, and to an assumption.
              formula: (r) => mul(r.cell('units'), ref('assumptions').get('price')),
            }),
            col<Month>('cogs', {
              header: 'COGS',
              format: 'currency',
              width: 14,
              formula: (r) => mul(r.cell('revenue'), ref('assumptions').get('cogsRate')),
            }),
            col<Month>('grossProfit', {
              header: 'Gross profit',
              format: 'currency',
              width: 14,
              formula: (r) => sub(r.cell('revenue'), r.cell('cogs')),
            }),
            col<Month>('growth', {
              header: 'MoM growth',
              format: 'percent',
              width: 12,
              // r.prev() on the first row is an error, so guard it.
              formula: (r) =>
                r.isFirst ? null : sub(div(r.cell('units'), r.prev().cell('units')), 1),
            }),
          ]}
          total={{ units: 'sum', revenue: 'sum', cogs: 'sum', grossProfit: 'sum' }}
        />

        <Note cols={6}>
          Change <code>price</code> on the Assumptions sheet — here, or in the exported .xlsx — and
          every figure above recalculates.
        </Note>
      </Stack>
    </Sheet>
  </Workbook>
)
