import { div, sub, sum } from '../formula/expr.js'
import { ref } from '../refs/ref.js'
import {
  Cell,
  col,
  KpiBand,
  Note,
  Row,
  Sheet,
  Spacer,
  Stack,
  Table,
  Workbook,
} from './components.js'
import type { WorkbookNode } from './nodes.js'

export interface Quarter {
  quarter: string
  revenue: number
  cogs: number
}

export const QUARTERS: Quarter[] = [
  { quarter: 'Q1', revenue: 12_400_000, cogs: 5_100_000 },
  { quarter: 'Q2', revenue: 13_900_000, cogs: 5_600_000 },
  { quarter: 'Q3', revenue: 15_200_000, cogs: 6_050_000 },
  { quarter: 'Q4', revenue: 16_800_000, cogs: 6_400_000 },
]

export function budget(quarters: Quarter[] = QUARTERS): WorkbookNode {
  return (
    <Workbook>
      <Sheet name="Assumptions">
        <Table
          name="assumptions"
          kind="keyValue"
          title="Model assumptions"
          data={[
            { key: 'growth', label: 'QoQ growth', value: 0.08, format: 'percent' },
            { key: 'taxRate', label: 'Tax rate', value: 0.2, format: 'percent' },
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
            ]}
          />

          <Table
            name="pl"
            data={quarters}
            columns={[
              col('quarter', { header: 'Quarter', width: 12 }),
              col('revenue', { header: 'Revenue', format: 'currency' }),
              col('cogs', { header: 'COGS', format: 'currency' }),
              col<Quarter>('grossProfit', {
                header: 'Gross profit',
                format: 'currency',
                formula: (r) => sub(r.cell('revenue'), r.cell('cogs')),
              }),
              col<Quarter>('qoq', {
                header: 'QoQ',
                format: 'percent',
                formula: (r) =>
                  r.isFirst ? null : sub(div(r.cell('revenue'), r.prev().cell('revenue')), 1),
              }),
            ]}
            total={{ revenue: 'sum', cogs: 'sum', grossProfit: 'sum' }}
          />

          <Note>
            Forecast beyond Q4 uses <code>growth</code> from Assumptions.
          </Note>
        </Stack>
      </Sheet>
    </Workbook>
  )
}

export function sideBySide(): WorkbookNode {
  return (
    <Workbook>
      <Sheet name="Two up">
        <Row gap={2}>
          <Stack gap={0}>
            <Cell value="left" />
            <Cell value="left again" />
          </Stack>
          <Table name="right" data={[{ a: 1 }, { a: 2 }]} columns={[col('a', { header: 'A' })]} />
        </Row>
        <Spacer rows={2} />
        <Cell value="below" />
      </Sheet>
    </Workbook>
  )
}
