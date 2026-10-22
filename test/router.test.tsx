import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { afterEach, describe, expect, it } from 'vitest'
import { useTableUrlState } from '../src/index'
import { useTanStackRouterAdapter, validateTableSearch } from '../src/router'
import { columns, features, orders } from './fixtures'

afterEach(cleanup)

function Orders() {
  const adapter = useTanStackRouterAdapter()
  const { tableOptions } = useTableUrlState({ adapter, debounceMs: 0, defaults: { pagination: { pageIndex: 0, pageSize: 2 } } })
  const table = useTable({ features, columns, data: orders, getRowId: (r) => r.id, ...tableOptions })
  return (
    <div>
      <button onClick={() => table.getColumn('total')!.toggleSorting(true)}>sort total</button>
      <button onClick={() => table.nextPage()}>next</button>
      <button onClick={() => table.getColumn('status')!.setFilterValue('42')}>filter</button>
      <ul>
        {table.getRowModel().rows.map((r) => (
          <li key={r.id}>{r.original.customer}</li>
        ))}
      </ul>
    </div>
  )
}

function setup(url: string) {
  const tableSearch = validateTableSearch()
  const rootRoute = createRootRoute()
  const ordersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/orders',
    validateSearch: (s: Record<string, unknown>) => ({ ...tableSearch(s), tab: s.tab as string | undefined }),
    component: Orders,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([ordersRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

const rows = () => screen.getAllByRole('listitem').map((li) => li.textContent)

describe('TanStack Router adapter', () => {
  it('reads the route search and writes through navigate', async () => {
    const router = setup('/orders?tab=billing&page=2')
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
    expect(rows()).toEqual(['Globex', 'Initech, "Inc"'])

    // Sorting sends the table back to page 1 (Table's autoResetPageIndex), then "next" moves to page 2.
    await act(async () => fireEvent.click(screen.getByText('sort total')))
    expect(router.state.location.search).not.toHaveProperty('page')
    await act(async () => fireEvent.click(screen.getByText('next')))
    expect(router.state.location.pathname).toBe('/orders')
    expect(router.state.location.search).toMatchObject({ tab: 'billing', sort: '-total', page: 2 })
    expect(rows()).toEqual(['Globex', 'Initech, "Inc"'])
    expect(router.state.location.searchStr).toContain('sort=-total')
  })

  it('round-trips a string filter that looks like a number', async () => {
    const router = setup('/orders')
    await screen.findAllByRole('listitem')
    await act(async () => fireEvent.click(screen.getByText('filter')))
    expect(router.state.location.search).toMatchObject({ 'f.status': '42' })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('follows history.back()', async () => {
    const router = setup('/orders')
    await screen.findAllByRole('listitem')
    await act(async () => {
      await router.navigate({ to: '/orders', search: { sort: 'customer' } as never })
    })
    expect(rows()).toEqual(['=HYPERLINK("x")', 'Acme Ltd'])
    await act(async () => {
      router.history.back()
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(rows()).toEqual(['Acme Ltd', 'Northwind'])
  })
})
