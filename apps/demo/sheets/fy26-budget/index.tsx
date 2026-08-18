import {
  col,
  type DesignSystem,
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
  title: 'FY26 Budget',
  description: 'A four-quarter P&L driven by two assumptions.',
  createdAt: '2026-08-18T00:00:00.000Z',
}

export const design: DesignSystem = {
  palette: { accent: '#1d4ed8', header: '#0f172a', band: '#f8fafc' },
  formats: { currency: '#,##0', percent: '0.0%' },
}

interface Quarter {
  quarter: string
  revenue: number
  cogs: number
  opex: number
}

const quarters: Quarter[] = [
  { quarter: 'Q1', revenue: 12_400_000, cogs: 5_100_000, opex: 4_200_000 },
  { quarter: 'Q2', revenue: 13_900_000, cogs: 5_600_000, opex: 4_400_000 },
  { quarter: 'Q3', revenue: 15_200_000, cogs: 6_050_000, opex: 4_650_000 },
  { quarter: 'Q4', revenue: 16_800_000, cogs: 6_400_000, opex: 4_900_000 },
]

export default (
  <Workbook>
    <Sheet name="Assumptions">
      <Table
        name="assumptions"
        kind="keyValue"
        title="Model assumptions"
        data={[
          { key: 'growth', label: 'QoQ revenue growth', value: 0.08, format: 'percent' },
          { key: 'taxRate', label: 'Effective tax rate', value: 0.2, format: 'percent' },
        ]}
      />
    </Sheet>

    <Sheet name="P&L" freeze="B2">
      <Stack gap={1}>
        <KpiBand
          items={[
            { label: 'FY Revenue', format: 'currency', value: sum(ref('pl').column('revenue')) },
            {
              label: 'Gross margin',
              format: 'percent',
              value: div(sum(ref('pl').column('grossProfit')), sum(ref('pl').column('revenue'))),
            },
            {
              label: 'FY Net income',
              format: 'currency',
              value: sum(ref('pl').column('netIncome')),
            },
          ]}
        />

        <Table
          name="pl"
          title="Profit & loss"
          data={quarters}
          columns={[
            col('quarter', { header: 'Quarter', width: 12 }),
            col('revenue', { header: 'Revenue', format: 'currency', width: 14 }),
            col('cogs', { header: 'COGS', format: 'currency', width: 14 }),
            col('opex', { header: 'Opex', format: 'currency', width: 14 }),
            col<Quarter>('grossProfit', {
              header: 'Gross profit',
              format: 'currency',
              width: 14,
              formula: (r) => sub(r.cell('revenue'), r.cell('cogs')),
            }),
            col<Quarter>('operatingIncome', {
              header: 'Operating income',
              format: 'currency',
              width: 16,
              formula: (r) => sub(r.cell('grossProfit'), r.cell('opex')),
            }),
            col<Quarter>('netIncome', {
              header: 'Net income',
              format: 'currency',
              width: 14,
              formula: (r) =>
                mul(r.cell('operatingIncome'), sub(1, ref('assumptions').get('taxRate'))),
            }),
            col<Quarter>('qoq', {
              header: 'QoQ growth',
              format: 'percent',
              width: 12,
              formula: (r) =>
                r.isFirst ? null : sub(div(r.cell('revenue'), r.prev().cell('revenue')), 1),
            }),
          ]}
          total={{
            revenue: 'sum',
            cogs: 'sum',
            opex: 'sum',
            grossProfit: 'sum',
            operatingIncome: 'sum',
            netIncome: 'sum',
          }}
        />

        <Note cols={8}>
          Change <code>taxRate</code> or <code>growth</code> on the Assumptions sheet and every
          figure above recalculates — in this viewer and in Excel.
        </Note>
      </Stack>
    </Sheet>
  </Workbook>
)
