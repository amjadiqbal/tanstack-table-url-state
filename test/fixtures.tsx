import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
} from '@tanstack/react-table'

export type Order = { id: string; customer: string; status: string; total: number; placed: Date }

export const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
})

const helper = createColumnHelper<typeof features, Order>()
export const columns = helper.columns([
  helper.display({ id: 'select', header: '' }),
  helper.accessor('customer', { header: 'Customer', filterFn: 'includesString' }),
  helper.accessor('status', { header: 'Status', filterFn: 'equalsString' }),
  helper.accessor('total', { header: 'Total' }),
  helper.accessor('placed', { header: 'Placed', enableGlobalFilter: false }),
])

export const orders: Order[] = [
  { id: '1', customer: 'Acme Ltd', status: 'paid', total: 4210, placed: new Date('2026-01-02T03:04:05Z') },
  { id: '2', customer: 'Northwind', status: 'paid', total: 2980.5, placed: new Date('2026-02-03T00:00:00Z') },
  { id: '3', customer: 'Globex', status: 'open', total: 1145, placed: new Date('2026-03-04T00:00:00Z') },
  { id: '4', customer: 'Initech, "Inc"', status: 'paid', total: 860.25, placed: new Date('2026-04-05T00:00:00Z') },
  { id: '5', customer: '=HYPERLINK("x")', status: 'open', total: -5, placed: new Date('2026-05-06T00:00:00Z') },
]
