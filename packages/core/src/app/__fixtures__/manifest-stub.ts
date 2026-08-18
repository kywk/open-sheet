import { budget } from '../../compile/fixtures.js'

export const workbooks = [
  {
    id: 'fixture-budget',
    load: async () => ({ default: budget(), meta: { title: 'Fixture Budget' } }),
  },
]

export const sheetsDir = 'sheets'
