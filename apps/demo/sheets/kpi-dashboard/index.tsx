import {
  col,
  div,
  gte,
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
  title: 'SaaS KPI dashboard',
  description: 'Monthly funnel and retention, driven by three assumptions.',
}

interface MonthRow {
  month: string
  visitors: number
  trials: number
  paid: number
  churned: number
}

const months: MonthRow[] = [
  { month: '2026-01', visitors: 48_200, trials: 1_930, paid: 268, churned: 41 },
  { month: '2026-02', visitors: 51_600, trials: 2_120, paid: 305, churned: 46 },
  { month: '2026-03', visitors: 57_400, trials: 2_460, paid: 361, churned: 52 },
  { month: '2026-04', visitors: 55_100, trials: 2_310, paid: 338, churned: 61 },
  { month: '2026-05', visitors: 62_800, trials: 2_780, paid: 402, churned: 58 },
  { month: '2026-06', visitors: 68_300, trials: 3_090, paid: 455, churned: 64 },
]

export default (
  <Workbook>
    <Sheet name="Assumptions">
      <Table
        name="targets"
        kind="keyValue"
        title="Targets"
        data={[
          { key: 'trialTarget', label: 'Target visitor → trial', value: 0.045, format: 'percent' },
          { key: 'paidTarget', label: 'Target trial → paid', value: 0.15, format: 'percent' },
          { key: 'arpu', label: 'ARPU (monthly)', value: 42, format: 'currency2' },
        ]}
      />
    </Sheet>

    <Sheet name="Funnel" freeze="B2">
      <Stack gap={1}>
        <KpiBand
          items={[
            { label: 'Visitors', format: 'number', value: sum(ref('funnel').column('visitors')) },
            {
              label: 'Visitor → trial',
              format: 'percent',
              value: div(
                sum(ref('funnel').column('trials')),
                sum(ref('funnel').column('visitors')),
              ),
            },
            {
              label: 'Trial → paid',
              format: 'percent',
              value: div(sum(ref('funnel').column('paid')), sum(ref('funnel').column('trials'))),
            },
            { label: 'Net adds', format: 'number', value: sum(ref('funnel').column('netAdds')) },
            {
              label: 'MRR added',
              format: 'currency',
              value: sum(ref('funnel').column('mrrAdded')),
            },
          ]}
        />

        <Table
          name="funnel"
          title="Monthly funnel"
          data={months}
          columns={[
            col('month', { header: 'Month', width: 11 }),
            col('visitors', { header: 'Visitors', format: 'number', width: 12, bar: true }),
            col('trials', { header: 'Trials', format: 'number', width: 10 }),
            col<MonthRow>('trialRate', {
              header: 'Trial rate',
              format: 'percent',
              width: 11,
              formula: (r) => div(r.cell('trials'), r.cell('visitors')),
            }),
            col<MonthRow>('vsTarget', {
              header: 'vs target',
              format: 'percent',
              width: 11,
              formula: (r) => sub(r.cell('trialRate'), ref('targets').get('trialTarget')),
            }),
            col('paid', { header: 'Paid', format: 'number', width: 9 }),
            col('churned', { header: 'Churned', format: 'number', width: 10 }),
            col<MonthRow>('netAdds', {
              header: 'Net adds',
              format: 'number',
              width: 11,
              formula: (r) => sub(r.cell('paid'), r.cell('churned')),
            }),
            col<MonthRow>('mrrAdded', {
              header: 'MRR added',
              format: 'currency',
              width: 12,
              formula: (r) => mul(r.cell('netAdds'), ref('targets').get('arpu')),
            }),
            col<MonthRow>('churnRate', {
              header: 'Churn',
              format: 'percent',
              width: 10,
              // No prior month to divide by, so the first row is deliberately blank.
              formula: (r) => (r.isFirst ? null : div(r.cell('churned'), r.prev().cell('paid'))),
            }),
            col<MonthRow>('status', {
              header: 'On target?',
              width: 12,
              formula: (r) =>
                if_(
                  gte(r.cell('trialRate'), ref('targets').get('trialTarget')),
                  'on target',
                  'below',
                ),
            }),
          ]}
          total={{
            visitors: 'sum',
            trials: 'sum',
            paid: 'sum',
            churned: 'sum',
            netAdds: 'sum',
            mrrAdded: 'sum',
          }}
        />

        <Note cols={8}>
          Change a target on the Assumptions sheet and both the “vs target” and “On target?” columns
          move with it — in this viewer and in Excel.
        </Note>
      </Stack>
    </Sheet>
  </Workbook>
)
