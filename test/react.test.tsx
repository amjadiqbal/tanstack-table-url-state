import { useEffect, useState } from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useTable } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTableUrlState } from '../src/index'
import { columns, features, orders } from './fixtures'

const setUrl = (search: string) => window.history.replaceState(null, '', '/orders' + search)
const search = () => window.location.search

beforeEach(() => setUrl('?tab=billing'))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useTableUrlState', () => {
  it('reads initial state from the URL', () => {
    setUrl('?sort=-total&page=2&f.status=paid&hide=placed')
    const { result } = renderHook(() => useTableUrlState())
    expect(result.current.state.sorting).toEqual([{ id: 'total', desc: true }])
    expect(result.current.state.pagination.pageIndex).toBe(1)
    expect(result.current.state.columnFilters).toEqual([{ id: 'status', value: 'paid' }])
    expect(result.current.tableOptions.state.columnVisibility).toEqual({ placed: false })
  })

  it('writes sorting and paging at once, keeping other params', () => {
    const { result } = renderHook(() => useTableUrlState())
    act(() => result.current.tableOptions.onSortingChange!([{ id: 'customer', desc: false }]))
    act(() => result.current.tableOptions.onPaginationChange!((p) => ({ ...p, pageIndex: 3 })))
    expect(search()).toBe('?tab=billing&sort=customer&page=4')
  })

  it('debounces filter typing', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useTableUrlState({ debounceMs: 200 }))
    act(() => result.current.tableOptions.onGlobalFilterChange!('ac'))
    act(() => result.current.tableOptions.onGlobalFilterChange!('acme'))
    expect(result.current.state.globalFilter).toBe('acme')
    expect(search()).toBe('?tab=billing')
    act(() => vi.advanceTimersByTime(200))
    expect(search()).toBe('?tab=billing&q=acme')
  })

  it('follows back/forward navigation', () => {
    const { result } = renderHook(() => useTableUrlState())
    act(() => {
      setUrl('?sort=-total')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.state.sorting).toEqual([{ id: 'total', desc: true }])
  })

  it('pushes history entries when asked', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(() => useTableUrlState({ history: 'push' }))
    act(() => result.current.tableOptions.onPaginationChange!({ pageIndex: 1, pageSize: 10 }))
    expect(push).toHaveBeenCalledTimes(1)
    push.mockRestore()
  })

  it('reset clears only its own params', () => {
    setUrl('?tab=billing&sort=-total&f.status=paid')
    const { result } = renderHook(() => useTableUrlState())
    act(() => result.current.reset())
    expect(search()).toBe('?tab=billing')
  })

  it('keeps two prefixed tables apart', () => {
    const { result } = renderHook(() => ({ a: useTableUrlState({ prefix: 'a.' }), b: useTableUrlState({ prefix: 'b.' }) }))
    act(() => result.current.a.tableOptions.onSortingChange!([{ id: 'x', desc: true }]))
    act(() => result.current.b.tableOptions.onPaginationChange!({ pageIndex: 4, pageSize: 10 }))
    expect(search()).toBe('?tab=billing&a.sort=-x&b.page=5')
    expect(result.current.a.state.pagination.pageIndex).toBe(0)
    expect(result.current.b.state.sorting).toEqual([])
  })
})

function OrdersTable() {
  const { tableOptions } = useTableUrlState({ defaults: { pagination: { pageIndex: 0, pageSize: 2 } } })
  const table = useTable({ features, columns, data: orders, getRowId: (r) => r.id, ...tableOptions })
  return (
    <div>
      <button onClick={() => table.getColumn('total')!.toggleSorting(true)}>sort total</button>
      <button onClick={() => table.nextPage()}>next</button>
      <button onClick={() => table.getColumn('placed')!.toggleVisibility(false)}>hide placed</button>
      <ul>
        {table.getRowModel().rows.map((r) => (
          <li key={r.id}>{r.original.customer}</li>
        ))}
      </ul>
    </div>
  )
}

describe('with a real useTable', () => {
  it('drives sorting, paging and visibility through the URL', () => {
    render(<OrdersTable />)
    fireEvent.click(screen.getByText('sort total'))
    expect(search()).toBe('?tab=billing&sort=-total')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Acme Ltd', 'Northwind'])
    fireEvent.click(screen.getByText('next'))
    expect(search()).toBe('?tab=billing&sort=-total&page=2')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Globex', 'Initech, "Inc"'])
    fireEvent.click(screen.getByText('hide placed'))
    expect(search()).toContain('hide=placed')
  })

  it('renders the state from a shared link', () => {
    setUrl('?f.status=open&sort=total')
    render(<OrdersTable />)
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['=HYPERLINK("x")', 'Globex'])
  })
})

function FilterTable() {
  const { tableOptions } = useTableUrlState({ debounceMs: 200 })
  const table = useTable({ features, columns, data: orders, getRowId: (r) => r.id, ...tableOptions })
  return <input aria-label="search" value={(table.state.globalFilter as string) ?? ''} onChange={(e) => table.setGlobalFilter(e.target.value)} />
}

describe('debounce with a real useTable', () => {
  it('stays debounced when Table resets the page on every keystroke', () => {
    vi.useFakeTimers()
    render(<FilterTable />)
    const input = screen.getByLabelText('search')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'ac' } })
    expect(search()).toBe('?tab=billing')
    act(() => vi.advanceTimersByTime(200))
    expect(search()).toBe('?tab=billing&q=ac')
  })
})

function PagedTable({ prefix, history }: { prefix?: string; history?: 'push' | 'replace' }) {
  const { tableOptions } = useTableUrlState({ prefix, history, defaults: { pagination: { pageIndex: 0, pageSize: 2 } } })
  const table = useTable({ features, columns, data: orders, getRowId: (r) => r.id, ...tableOptions })
  return (
    <div>
      <button onClick={() => table.nextPage()}>next {prefix}</button>
      <button onClick={() => table.getColumn('status')!.setFilterValue('paid')}>paid {prefix}</button>
      <output data-testid={'page' + (prefix ?? '')}>{table.state.pagination.pageIndex}</output>
      <ul>
        {table.getRowModel().rows.map((r) => (
          <li key={r.id}>{r.original.customer}</li>
        ))}
      </ul>
    </div>
  )
}

describe('page survives URL-driven changes (Table auto page reset)', () => {
  it('opens a deep link on the linked page', () => {
    setUrl('?sort=-total&page=2')
    render(<PagedTable />)
    expect(screen.getByTestId('page').textContent).toBe('1')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Globex', 'Initech, "Inc"'])
    expect(search()).toBe('?sort=-total&page=2')
  })

  it('back restores the page with two tables on the page', async () => {
    setUrl('')
    render(
      <>
        <PagedTable prefix="o." />
        <PagedTable prefix="a." history="push" />
      </>,
    )
    fireEvent.click(screen.getByText('next a.'))
    fireEvent.click(screen.getByText('next a.'))
    expect(search()).toBe('?a.page=3')
    await act(async () => {
      window.history.back()
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(search()).toBe('?a.page=2')
    expect(screen.getByTestId('pagea.').textContent).toBe('1')
  })

  it('back to an entry with a different filter and page keeps that page', async () => {
    setUrl('')
    render(<PagedTable history="push" />)
    await act(async () => fireEvent.click(screen.getByText('paid')))
    await act(async () => fireEvent.click(screen.getByText('next')))
    expect(search()).toBe('?page=2&f.status=paid')
    // Clearing the filter in a new entry, then going back, changes filter and page at once.
    act(() => {
      window.history.pushState(null, '', '/orders')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByTestId('page').textContent).toBe('0')
    await act(async () => {
      window.history.back()
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(search()).toBe('?page=2&f.status=paid')
    expect(screen.getByTestId('page').textContent).toBe('1')
  })

  it('a filter change by the user still returns to page 1', async () => {
    setUrl('?page=2')
    render(<PagedTable />)
    await act(() => new Promise((r) => setTimeout(r, 10)))
    await act(async () => fireEvent.click(screen.getByText('paid')))
    expect(screen.getByTestId('page').textContent).toBe('0')
    await act(() => new Promise((r) => setTimeout(r, 350)))
    expect(search()).toBe('?f.status=paid')
  })
})

function AsyncTable() {
  const [data, setData] = useState<typeof orders>([])
  useEffect(() => {
    const t = setTimeout(() => setData(orders), 5)
    return () => clearTimeout(t)
  }, [])
  const { tableOptions } = useTableUrlState({ defaults: { pagination: { pageIndex: 0, pageSize: 2 } } })
  const table = useTable({ features, columns, data, getRowId: (r) => r.id, ...tableOptions })
  return (
    <ul>
      {table.getRowModel().rows.map((r) => (
        <li key={r.id}>{r.original.customer}</li>
      ))}
    </ul>
  )
}

describe('data that loads after mount', () => {
  it('keeps the deep-linked page', async () => {
    setUrl('?page=2')
    render(<AsyncTable />)
    await act(() => new Promise((r) => setTimeout(r, 30)))
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Globex', 'Initech, "Inc"'])
    expect(search()).toBe('?page=2')
  })
})

describe('debounce from a later page', () => {
  it('debounces the first keystroke that also returns to page 1', () => {
    vi.useFakeTimers()
    setUrl('?page=3')
    render(<FilterTable />)
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'a' } })
    expect(search()).toBe('?page=3')
    act(() => vi.advanceTimersByTime(300))
    expect(search()).toBe('?q=a')
  })
})
