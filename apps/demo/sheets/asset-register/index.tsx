import {
  col,
  count,
  div,
  gt,
  if_,
  KpiBand,
  max,
  min,
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
  title: 'Fixed asset register',
  description: 'Straight-line depreciation over a register you can keep adding rows to.',
}

interface Asset {
  tag: string
  description: string
  acquired: string
  cost: number
  lifeYears: number
  yearsHeld: number
}

const assets: Asset[] = [
  {
    tag: 'IT-0142',
    description: 'Laptop fleet (12)',
    acquired: '2024-03-11',
    cost: 720_000,
    lifeYears: 3,
    yearsHeld: 2,
  },
  {
    tag: 'IT-0155',
    description: 'Server rack',
    acquired: '2023-08-02',
    cost: 1_480_000,
    lifeYears: 5,
    yearsHeld: 3,
  },
  {
    tag: 'FF-0031',
    description: 'Office fit-out',
    acquired: '2022-01-17',
    cost: 3_200_000,
    lifeYears: 10,
    yearsHeld: 4,
  },
  {
    tag: 'VE-0009',
    description: 'Delivery van',
    acquired: '2021-06-30',
    cost: 980_000,
    lifeYears: 6,
    yearsHeld: 5,
  },
  {
    tag: 'IT-0168',
    description: 'Network switches',
    acquired: '2025-02-20',
    cost: 260_000,
    lifeYears: 5,
    yearsHeld: 1,
  },
]

export default (
  <Workbook>
    <Sheet name="Assumptions">
      <Table
        name="policy"
        kind="keyValue"
        title="Depreciation policy"
        data={[
          { key: 'residual', label: 'Residual value rate', value: 0.05, format: 'percent' },
          { key: 'writeOff', label: 'Write-off threshold', value: 50_000, format: 'currency' },
        ]}
      />
    </Sheet>

    <Sheet name="Register" freeze="C2">
      <Stack gap={1}>
        <KpiBand
          items={[
            { label: 'Assets', format: 'number', value: count(ref('assets').column('tag')) },
            { label: 'Cost', format: 'currency', value: sum(ref('assets').column('cost')) },
            {
              label: 'Accumulated',
              format: 'currency',
              value: sum(ref('assets').column('accumulated')),
            },
            {
              label: 'Net book value',
              format: 'currency',
              value: sum(ref('assets').column('nbv')),
            },
          ]}
        />

        <Table
          name="assets"
          title="Fixed assets"
          data={assets}
          columns={[
            col('tag', { header: 'Tag', width: 11 }),
            col('description', { header: 'Description', width: 22 }),
            col('acquired', { header: 'Acquired', width: 12 }),
            col('cost', { header: 'Cost', format: 'currency', width: 14, bar: true }),
            col('lifeYears', { header: 'Life (yr)', format: 'number', width: 10 }),
            col('yearsHeld', { header: 'Held (yr)', format: 'number', width: 10 }),
            col<Asset>('residual', {
              header: 'Residual',
              format: 'currency',
              width: 13,
              formula: (r) => mul(r.cell('cost'), ref('policy').get('residual')),
            }),
            col<Asset>('annual', {
              header: 'Annual charge',
              format: 'currency',
              width: 14,
              formula: (r) => div(sub(r.cell('cost'), r.cell('residual')), r.cell('lifeYears')),
            }),
            col<Asset>('accumulated', {
              header: 'Accumulated',
              format: 'currency',
              width: 14,
              // Depreciation stops at end of life, so cap the years charged.
              formula: (r) => mul(r.cell('annual'), min(r.cell('yearsHeld'), r.cell('lifeYears'))),
            }),
            col<Asset>('nbv', {
              header: 'Net book value',
              format: 'currency',
              width: 15,
              formula: (r) => max(sub(r.cell('cost'), r.cell('accumulated')), r.cell('residual')),
            }),
            col<Asset>('status', {
              header: 'Status',
              width: 13,
              formula: (r) =>
                if_(gt(r.cell('nbv'), ref('policy').get('writeOff')), 'in service', 'write off'),
            }),
          ]}
          total={{ tag: 'count', cost: 'sum', accumulated: 'sum', nbv: 'sum' }}
        />

        <Note cols={8}>
          Add a row to the <code>assets</code> array and every formula, total, and KPI above
          re-resolves — no addresses to fix.
        </Note>
      </Stack>
    </Sheet>
  </Workbook>
)
