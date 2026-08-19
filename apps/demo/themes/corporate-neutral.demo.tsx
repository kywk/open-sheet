import {
  col,
  div,
  KpiBand,
  mul,
  ref,
  Sheet,
  type SheetMeta,
  Stack,
  sum,
  Table,
  Workbook,
} from '@open-sheet/core'

export const meta: SheetMeta = {
  title: 'Corporate neutral — preview',
  theme: 'corporate-neutral',
}

const rows = [
  { region: 'North', units: 1_240, price: 49 },
  { region: 'South', units: 980, price: 49 },
  { region: 'East', units: 1_610, price: 52 },
  { region: 'West', units: 1_105, price: 47 },
]

export default (
  <Workbook>
    <Sheet name="Preview" freeze="B2">
      <Stack gap={1}>
        <KpiBand
          items={[
            { label: 'Units', format: 'number', value: sum(ref('sales').column('units')) },
            { label: 'Revenue', format: 'currency', value: sum(ref('sales').column('revenue')) },
            {
              label: 'Avg price',
              format: 'currency2',
              value: div(sum(ref('sales').column('revenue')), sum(ref('sales').column('units'))),
            },
          ]}
        />
        <Table
          name="sales"
          title="Sales by region"
          data={rows}
          columns={[
            col('region', { header: 'Region', width: 20 }),
            col('units', { header: 'Units', format: 'number', width: 13, bar: true }),
            col('price', { header: 'Unit price', format: 'currency2', width: 13 }),
            col('revenue', {
              header: 'Revenue',
              format: 'currency',
              width: 15,
              formula: (r) => mul(r.cell('units'), r.cell('price')),
            }),
          ]}
          total={{ units: 'sum', revenue: 'sum' }}
        />
      </Stack>
    </Sheet>
  </Workbook>
)
