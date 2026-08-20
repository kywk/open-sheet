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
  Spacer,
  Stack,
  sub,
  sum,
  Table,
  Workbook,
} from '@open-sheet/core'

export const meta: SheetMeta = {
  title: '請款單 Invoice',
  theme: 'corporate-neutral',
  description: '直式列印的表單：跨欄抬頭、簽章欄、保留款計算。',
}

interface Line {
  no: number
  item: string
  spec: string
  qty: number
  unit: string
  price: number
}

const lines: Line[] = [
  {
    no: 1,
    item: '系統建置服務',
    spec: '第一期：需求訪談與架構設計',
    qty: 1,
    unit: '式',
    price: 380_000,
  },
  { no: 2, item: '系統建置服務', spec: '第二期：核心模組開發', qty: 1, unit: '式', price: 620_000 },
  { no: 3, item: '教育訓練', spec: '管理者 4 小時 × 2 場', qty: 2, unit: '場', price: 28_000 },
  { no: 4, item: '維運支援', spec: '每月 16 小時，含例假日', qty: 6, unit: '月', price: 45_000 },
]

export default (
  <Workbook>
    <Sheet name="條件">
      <Table
        name="terms"
        kind="keyValue"
        title="請款條件"
        data={[
          { key: 'taxRate', label: '營業稅率', value: 0.05, format: 'percent' },
          { key: 'retention', label: '保留款比例', value: 0.1, format: 'percent' },
        ]}
      />
    </Sheet>

    <Sheet
      name="請款單"
      print={{ orientation: 'portrait', size: 'A4', fitToWidth: true, repeatHeader: true }}
    >
      <Stack gap={1}>
        {/* 抬頭：跨欄置中的標題 + 右上角單號 */}
        <Cell value="請  款  單" span={{ rows: 1, cols: 7 }} style="tableTitle" />

        <Row gap={0}>
          <Cell value="買受人：" />
          <Cell value="台灣示範股份有限公司" span={{ rows: 1, cols: 3 }} />
          <Cell value="單號：" />
          <Cell value="INV-2026-0819" span={{ rows: 1, cols: 2 }} />
        </Row>
        <Row gap={0}>
          <Cell value="統一編號：" />
          <Cell value="12345678" span={{ rows: 1, cols: 3 }} />
          <Cell value="日期：" />
          <Cell value="2026-08-19" span={{ rows: 1, cols: 2 }} />
        </Row>

        <Spacer rows={1} />

        <Table
          name="items"
          data={lines}
          columns={[
            col('no', { header: '項次', width: 6 }),
            col('item', { header: '品項', width: 18 }),
            col('spec', { header: '說明', width: 30 }),
            col('qty', { header: '數量', format: 'number', width: 8 }),
            col('unit', { header: '單位', width: 7 }),
            col('price', { header: '單價', format: 'currency', width: 12 }),
            col<Line>('amount', {
              header: '金額',
              format: 'currency',
              width: 14,
              formula: (r) => mul(r.cell('qty'), r.cell('price')),
            }),
          ]}
          total={{ amount: 'sum' }}
        />

        <Table
          name="totals"
          kind="keyValue"
          data={[
            {
              key: 'subtotal',
              label: '小計',
              value: sum(ref('items').column('amount')),
              format: 'currency',
            },
            {
              key: 'tax',
              label: '營業稅',
              format: 'currency',
              value: round(mul(ref('totals').get('subtotal'), ref('terms').get('taxRate')), 0),
            },
            {
              key: 'grand',
              label: '本期應付',
              format: 'currency',
              value: sum(ref('totals').get('subtotal'), ref('totals').get('tax')),
            },
            {
              key: 'retained',
              label: '保留款',
              format: 'currency',
              value: round(mul(ref('totals').get('grand'), ref('terms').get('retention')), 0),
            },
            {
              key: 'payable',
              label: '本次實付',
              format: 'currency',
              value: sub(ref('totals').get('grand'), ref('totals').get('retained')),
            },
          ]}
        />

        <Spacer rows={2} />

        {/* 簽章欄：三個並排的空白區塊 */}
        <Row gap={1}>
          <Cell value="承辦人" />
          <Cell value="" span={{ rows: 3, cols: 1 }} />
          <Cell value="主管核准" />
          <Cell value="" span={{ rows: 3, cols: 1 }} />
          <Cell value="用印" />
          <Cell value="" span={{ rows: 3, cols: 1 }} />
        </Row>

        <Note cols={7}>付款條件：驗收合格後 30 日內匯款。保留款於保固期滿無息退還。</Note>
      </Stack>
    </Sheet>
  </Workbook>
)
