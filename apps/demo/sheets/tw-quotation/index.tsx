import {
  Cell,
  col,
  mul,
  Note,
  Row,
  ref,
  round,
  Sheet,
  type SheetMeta,
  Stack,
  sub,
  sum,
  Table,
  Workbook,
} from '@open-sheet/core'

export const meta: SheetMeta = {
  title: '報價單 Quotation',
  description: '含稅額與折扣的報價單，稅率改一個數字就整張重算。',
}

interface Item {
  no: number
  name: string
  spec: string
  qty: number
  unit: string
  price: number
}

const items: Item[] = [
  { no: 1, name: '網站前端開發', spec: '含 RWD 與無障礙檢測', qty: 1, unit: '式', price: 480_000 },
  { no: 2, name: 'API 介接', spec: '第三方金流 × 2', qty: 2, unit: '式', price: 90_000 },
  { no: 3, name: '教育訓練', spec: '半日、含教材', qty: 3, unit: '場', price: 25_000 },
  { no: 4, name: '維運支援', spec: '每月 8 小時', qty: 12, unit: '月', price: 18_000 },
]

export default (
  <Workbook>
    <Sheet name="條件">
      <Table
        name="terms"
        kind="keyValue"
        title="報價條件"
        data={[
          { key: 'taxRate', label: '營業稅率', value: 0.05, format: 'percent' },
          { key: 'discount', label: '整案折扣', value: 0.03, format: 'percent' },
          { key: 'validDays', label: '報價有效天數', value: 30, format: 'number' },
        ]}
      />
    </Sheet>

    <Sheet name="報價單">
      <Stack gap={1}>
        <Row gap={1}>
          <Cell value="報價單" span={{ rows: 1, cols: 3 }} style="tableTitle" />
        </Row>

        <Table
          name="quote"
          data={items}
          columns={[
            col('no', { header: '項次', width: 6 }),
            col('name', { header: '品名', width: 20 }),
            col('spec', { header: '規格說明', width: 26 }),
            col('qty', { header: '數量', format: 'number', width: 8 }),
            col('unit', { header: '單位', width: 7 }),
            col('price', { header: '單價', format: 'currency', width: 12 }),
            col<Item>('amount', {
              header: '小計',
              format: 'currency',
              width: 13,
              bar: true,
              formula: (r) => mul(r.cell('qty'), r.cell('price')),
            }),
          ]}
          total={{ amount: 'sum' }}
        />

        <Table
          name="totals"
          kind="keyValue"
          title="金額計算"
          data={[
            {
              key: 'subtotal',
              label: '小計',
              value: sum(ref('quote').column('amount')),
              format: 'currency',
            },
            {
              key: 'discountAmount',
              label: '折扣',
              value: round(mul(ref('totals').get('subtotal'), ref('terms').get('discount')), 0),
              format: 'currency',
            },
            {
              key: 'taxable',
              label: '未稅金額',
              value: sub(ref('totals').get('subtotal'), ref('totals').get('discountAmount')),
              format: 'currency',
            },
            {
              key: 'tax',
              label: '營業稅',
              value: round(mul(ref('totals').get('taxable'), ref('terms').get('taxRate')), 0),
              format: 'currency',
            },
            {
              key: 'grandTotal',
              label: '總計（含稅）',
              value: sum(ref('totals').get('taxable'), ref('totals').get('tax')),
              format: 'currency',
            },
          ]}
        />

        <Note cols={7}>
          本報價自報價日起 <code>validDays</code> 天內有效。改「條件」分頁的稅率或折扣，
          整張報價單即時重算 —— 在此檢視器與 Excel 中皆然。
        </Note>
      </Stack>
    </Sheet>
  </Workbook>
)
