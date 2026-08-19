import {
  col,
  div,
  gt,
  if_,
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
  theme: 'corporate-neutral',
  title: 'Departmental budget vs actual',
  description: 'Half-year spend by department, with variance and a contingency draw.',
}

interface Line {
  department: string
  category: string
  budget: number
  actual: number
}

const lines: Line[] = [
  { department: 'Engineering', category: 'Salaries', budget: 4_200_000, actual: 4_318_000 },
  { department: 'Engineering', category: 'Cloud', budget: 860_000, actual: 1_042_000 },
  { department: 'Engineering', category: 'Tooling', budget: 180_000, actual: 156_000 },
  { department: 'Sales', category: 'Salaries', budget: 2_600_000, actual: 2_540_000 },
  { department: 'Sales', category: 'Travel', budget: 340_000, actual: 412_000 },
  { department: 'Sales', category: 'Events', budget: 520_000, actual: 468_000 },
  { department: 'Marketing', category: 'Paid media', budget: 900_000, actual: 1_120_000 },
  { department: 'Marketing', category: 'Content', budget: 260_000, actual: 231_000 },
  { department: 'G&A', category: 'Rent', budget: 720_000, actual: 720_000 },
  { department: 'G&A', category: 'Insurance', budget: 140_000, actual: 152_000 },
]

export default (
  <Workbook>
    <Sheet name="Assumptions">
      <Table
        name="policy"
        kind="keyValue"
        title="Policy"
        data={[
          { key: 'tolerance', label: 'Variance tolerance', value: 0.05, format: 'percent' },
          { key: 'contingency', label: 'Contingency pool', value: 500_000, format: 'currency' },
        ]}
      />
    </Sheet>

    <Sheet name="Variance" freeze="C2">
      <Stack gap={1}>
        <KpiBand
          items={[
            { label: 'Budget', format: 'currency', value: sum(ref('spend').column('budget')) },
            { label: 'Actual', format: 'currency', value: sum(ref('spend').column('actual')) },
            { label: 'Variance', format: 'currency', value: sum(ref('spend').column('variance')) },
            {
              label: 'Contingency left',
              format: 'currency',
              value: sub(ref('policy').get('contingency'), sum(ref('spend').column('overrun'))),
            },
          ]}
        />

        <Table
          name="spend"
          title="Spend by line"
          data={lines}
          columns={[
            col('department', { header: 'Department', width: 16 }),
            col('category', { header: 'Category', width: 14 }),
            col('budget', { header: 'Budget', format: 'currency', width: 14 }),
            col('actual', { header: 'Actual', format: 'currency', width: 14, bar: true }),
            col<Line>('variance', {
              header: 'Variance',
              format: 'currency',
              width: 13,
              formula: (r) => sub(r.cell('actual'), r.cell('budget')),
            }),
            col<Line>('variancePct', {
              header: 'Variance %',
              format: 'percent',
              width: 12,
              formula: (r) => div(r.cell('variance'), r.cell('budget')),
            }),
            col<Line>('overrun', {
              header: 'Overrun',
              format: 'currency',
              width: 13,
              // Only overspend draws on contingency; underspend is not a credit.
              formula: (r) => if_(gt(r.cell('variance'), 0), r.cell('variance'), 0),
            }),
            col<Line>('flag', {
              header: 'Flag',
              width: 12,
              formula: (r) =>
                if_(
                  gt(r.cell('variancePct'), ref('policy').get('tolerance')),
                  'over tolerance',
                  '',
                ),
            }),
          ]}
          total={{ budget: 'sum', actual: 'sum', variance: 'sum', overrun: 'sum' }}
        />

        <Note cols={8}>
          Raise the tolerance on the Assumptions sheet and lines drop out of the flagged set.
        </Note>
      </Stack>
    </Sheet>
  </Workbook>
)
