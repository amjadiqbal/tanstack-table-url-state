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
