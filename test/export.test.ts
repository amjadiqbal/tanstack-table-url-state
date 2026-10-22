import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { getExportMatrix, toCsv } from '../src/csv'
import { toXlsx } from '../src/xlsx'
import { columns, features, orders } from './fixtures'

function makeTable() {
  return constructTable({
    features: { ...features, coreReactivityFeature: storeReactivityBindings() },
    columns,
    data: orders,
    getRowId: (r: { id: string }) => r.id,
    initialState: {
      sorting: [{ id: 'total', desc: true }],
      columnFilters: [{ id: 'status', value: 'paid' }],
      pagination: { pageIndex: 0, pageSize: 2 },
      columnVisibility: { placed: false },
    },
  } as never) as object
}

describe('export matrix', () => {
  it('uses visible data columns and filtered, sorted rows across pages', () => {
    const m = getExportMatrix(makeTable())
    expect(m.headers).toEqual(['Customer', 'Status', 'Total'])
    expect(m.rows).toEqual([
      ['Acme Ltd', 'paid', 4210],
      ['Northwind', 'paid', 2980.5],
      ['Initech, "Inc"', 'paid', 860.25],
    ])
  })

  it('can export only the current page or every row', () => {
    expect(getExportMatrix(makeTable(), { rows: 'page' }).rows).toHaveLength(2)
    expect(getExportMatrix(makeTable(), { rows: 'all' }).rows).toHaveLength(5)
  })

  it('applies formatters and explicit columns', () => {
    const m = getExportMatrix(makeTable(), {
      columns: ['customer', 'placed'],
      formatters: { placed: (v) => (v as Date).toISOString().slice(0, 10) },
      rows: 'page',
    })
    expect(m.headers).toEqual(['Customer', 'Placed'])
    expect(m.rows[0]).toEqual(['Acme Ltd', '2026-01-02'])
  })
})

describe('csv', () => {
  it('quotes per RFC 4180', () => {
    expect(toCsv(makeTable())).toBe(
      'Customer,Status,Total\r\nAcme Ltd,paid,4210\r\nNorthwind,paid,2980.5\r\n"Initech, ""Inc""",paid,860.25',
    )
  })

  it('neutralises formulas but not negative numbers', () => {
    const csv = toCsv(makeTable(), { rows: 'all', columns: ['customer', 'total'], newline: '\n' })
    expect(csv).toContain(`"'=HYPERLINK(""x"")",-5`)
  })

  it('supports delimiter and BOM', () => {
    const csv = toCsv(makeTable(), { delimiter: ';', bom: true, rows: 'page' })
    expect(csv.startsWith('﻿Customer;Status;Total')).toBe(true)
  })
})

describe('xlsx', () => {
  it('writes a valid workbook with typed cells', () => {
    const files = unzipSync(toXlsx(makeTable(), { columns: ['customer', 'total', 'placed'], sheetName: 'Orders/2026' }))
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ])
    expect(strFromU8(files['xl/workbook.xml'])).toContain('name="Orders 2026"')
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Customer</t></is></c>')
    expect(sheet).toContain('<c r="B2"><v>4210</v></c>')
    expect(sheet).toContain('<c r="C2" s="2"><v>46024.12783564815</v></c>')
    expect(sheet).toContain('Initech, &quot;Inc&quot;')
  })
})
