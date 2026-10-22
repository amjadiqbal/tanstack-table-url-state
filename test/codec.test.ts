import { describe, expect, it } from 'vitest'
import { decodeState, decodeValue, diffParams, encodeState, encodeValue, pickParams, resolveCodec } from '../src/core'

const codec = resolveCodec()

describe('value codec', () => {
  it.each([['paid'], ['42'], ['true'], [''], [42], [true], [null], [[10, 50]], [{ min: 1 }], ['[x'], ['-total']])(
    'round-trips %j',
    (v) => expect(decodeValue(encodeValue(v))).toEqual(v),
  )
  it('keeps plain strings readable', () => {
    expect(encodeValue('paid')).toBe('paid')
    expect(encodeValue('42')).toBe('"42"')
    expect(encodeValue([10, 50])).toBe('[10,50]')
  })
})

describe('state codec', () => {
  it('omits defaults', () => {
    expect(
      encodeState(
        { sorting: [], columnFilters: [], globalFilter: '', pagination: { pageIndex: 0, pageSize: 10 }, columnVisibility: {} },
        codec,
      ),
    ).toEqual({ sort: undefined, q: undefined, page: undefined, size: undefined, hide: undefined })
  })

  it('writes compact params and reads them back', () => {
    const state = {
      sorting: [
        { id: 'total', desc: true },
        { id: 'customer', desc: false },
      ],
      columnFilters: [
        { id: 'status', value: 'paid' },
        { id: 'total', value: [100, 5000] },
      ],
      globalFilter: 'acme',
      pagination: { pageIndex: 2, pageSize: 25 },
      columnVisibility: { placed: false, total: true },
    }
    const params = encodeState(state, codec)
    expect(params).toEqual({
      sort: '-total,customer',
      q: 'acme',
      page: '3',
      size: '25',
      hide: 'placed',
      'f.status': 'paid',
      'f.total': '[100,5000]',
    })
    const back = decodeState(params as Record<string, string>, codec)
    expect(back.sorting).toEqual(state.sorting)
    expect(back.columnFilters).toEqual(state.columnFilters)
    expect(back.globalFilter).toBe('acme')
    expect(back.pagination).toEqual({ pageIndex: 2, pageSize: 25 })
    expect(back.columnVisibility).toEqual({ placed: false })
  })

  it('escapes commas in column ids', () => {
    const params = encodeState({ sorting: [{ id: 'a,b', desc: true }] }, codec)
    expect(decodeState(params as Record<string, string>, codec).sorting).toEqual([{ id: 'a,b', desc: true }])
  })

  it('ignores malformed params', () => {
    const s = decodeState({ page: 'abc', size: '0', sort: ',,-' }, codec)
    expect(s.pagination).toEqual({ pageIndex: 0, pageSize: 10 })
    expect(s.sorting).toEqual([])
  })

  it('uses custom defaults and treats them as absent', () => {
    const c = resolveCodec({ defaults: { pagination: { pageIndex: 0, pageSize: 50 }, columnVisibility: { email: false } } })
    expect(encodeState({ pagination: { pageIndex: 0, pageSize: 50 }, columnVisibility: { email: false } }, c)).toEqual({
      page: undefined,
      size: undefined,
      hide: undefined,
    })
    // Showing a column hidden by default writes an empty list.
    expect(encodeState({ columnVisibility: { email: true } }, c)).toEqual({ hide: '' })
    expect(decodeState({ hide: '' }, c).columnVisibility).toEqual({ email: true })
    expect(decodeState({}, c).columnVisibility).toEqual({ email: false })
  })

  it('supports a prefix and custom keys', () => {
    const c = resolveCodec({ prefix: 'orders.', keys: { globalFilter: 'search' } })
    const params = encodeState({ globalFilter: 'x', columnFilters: [{ id: 'status', value: 'open' }] }, c)
    expect(params).toEqual({ 'orders.search': 'x', 'orders.f.status': 'open' })
    expect(c.owns('orders.search')).toBe(true)
    expect(c.owns('search')).toBe(false)
  })

  it('syncs only the chosen slices', () => {
    const c = resolveCodec({ slices: ['pagination'] })
    expect(encodeState({ sorting: [{ id: 'a', desc: false }], pagination: { pageIndex: 1, pageSize: 10 } }, c)).toEqual({
      page: '2',
      size: undefined,
    })
    expect(c.owns('sort')).toBe(false)
    expect(c.owns('f.status')).toBe(false)
  })

  it('removes stale column filters and keeps foreign params', () => {
    const current = pickParams(new URLSearchParams('tab=billing&f.status=paid&f.total=5'), codec)
    expect(current).toEqual({ 'f.status': 'paid', 'f.total': '5' })
    expect(diffParams(current, { columnFilters: [{ id: 'status', value: 'open' }] }, codec)).toEqual({
      'f.total': undefined,
      'f.status': 'open',
    })
  })
})

describe('clearing a non-empty default (0.1.1)', () => {
  const c = resolveCodec({ defaults: { globalFilter: 'acme', columnFilters: [{ id: 'status', value: 'paid' }] } })

  it('writes q= for an empty search and reads it back as empty', () => {
    const params = encodeState({ globalFilter: '' }, c)
    expect(params).toEqual({ q: '' })
    expect(decodeState(params as Record<string, string>, c).globalFilter).toBe('')
    expect(decodeState({}, c).globalFilter).toBe('acme')
  })

  it('writes f.status= for a cleared default filter', () => {
    const params = encodeState({ columnFilters: [] }, c)
    expect(params).toEqual({ 'f.status': '' })
    expect(decodeState(params as Record<string, string>, c).columnFilters).toEqual([])
    expect(decodeState({}, c).columnFilters).toEqual([{ id: 'status', value: 'paid' }])
  })

  it('keeps other filters and marks only the cleared default', () => {
    const params = encodeState({ columnFilters: [{ id: 'customer', value: 'ac' }] }, c)
    expect(params).toEqual({ 'f.customer': 'ac', 'f.status': '' })
    expect(decodeState(params as Record<string, string>, c).columnFilters).toEqual([{ id: 'customer', value: 'ac' }])
  })

  it('writes nothing when the state equals the defaults', () => {
    expect(encodeState({ globalFilter: 'acme', columnFilters: [{ id: 'status', value: 'paid' }] }, c)).toEqual({ q: undefined })
  })

  it('still writes nothing for empty values over empty defaults', () => {
    expect(encodeState({ globalFilter: '', columnFilters: [] }, codec)).toEqual({ q: undefined })
  })
})

describe('page bounds (0.1.1)', () => {
  it('caps size and page from the URL', () => {
    expect(decodeState({ size: '1000000', page: '99999999999' }, codec).pagination).toEqual({ pageIndex: 99_999, pageSize: 1000 })
    const c = resolveCodec({ maxPageSize: 100, maxPage: 50 })
    expect(decodeState({ size: '500', page: '80' }, c).pagination).toEqual({ pageIndex: 49, pageSize: 100 })
  })

  it('defaults to page size 10', () => {
    expect(decodeState({}, codec).pagination).toEqual({ pageIndex: 0, pageSize: 10 })
  })
})
