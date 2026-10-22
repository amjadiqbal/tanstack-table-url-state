import type { Column, Row, RowData, Table, TableFeatures } from '@tanstack/react-table'

// Loose shapes so export works whichever features the table registered.
type AnyTable = Table<TableFeatures, RowData>
type AnyColumn = Column<TableFeatures, RowData, unknown>
type AnyRow = Row<TableFeatures, RowData>

export interface ExportContext {
  row: AnyRow
  column: AnyColumn
}

export interface ExportOptions {
  /**
   * Which rows: `'filtered'` (default) is every row that passes the filters,
   * in sorted order, across all pages. `'page'` is only the rows on screen.
   * `'all'` ignores filters and sorting.
   */
  rows?: 'filtered' | 'page' | 'all'
  /** Column ids to export. Defaults to the visible columns that have data. */
  columns?: string[]
  /** Header text per column. Defaults to a string `header`, else the column id. */
  header?: (column: AnyColumn) => string
  /** Format a cell value for every column. */
  format?: (value: unknown, context: ExportContext) => unknown
  /** Format a cell value for one column, by column id. Wins over `format`. */
  formatters?: Record<string, (value: unknown, context: ExportContext) => unknown>
}

export interface ExportMatrix {
  headers: string[]
  rows: unknown[][]
}

/** The current view of a table as a header row plus value rows. */
export function getExportMatrix(table: object, options: ExportOptions = {}): ExportMatrix {
  const t = table as AnyTable & Record<string, unknown>
  const columns = pickColumns(t, options.columns)
  const rows = pickRows(t, options.rows ?? 'filtered')
  const header = options.header ?? defaultHeader

  return {
    headers: columns.map((c) => header(c)),
    rows: rows.map((row) =>
      columns.map((column) => {
        const value = row.getValue(column.id)
        const fn = options.formatters?.[column.id] ?? options.format
        return fn ? fn(value, { row, column }) : value
      }),
    ),
  }
}

function pickColumns(t: AnyTable & Record<string, unknown>, ids: string[] | undefined): AnyColumn[] {
  const all = call<AnyColumn[]>(t, 'getAllLeafColumns') ?? []
  if (ids) {
    const byId = new Map(all.map((c) => [c.id, c]))
    return ids.map((id) => byId.get(id)).filter((c): c is AnyColumn => c !== undefined)
  }
  const visible = call<AnyColumn[]>(t, 'getVisibleLeafColumns') ?? all
  // Display columns (checkboxes, actions) have no accessor and no data.
  return visible.filter((c) => typeof (c as { accessorFn?: unknown }).accessorFn === 'function')
}

function pickRows(t: AnyTable & Record<string, unknown>, which: 'filtered' | 'page' | 'all'): AnyRow[] {
  const model =
    which === 'page'
      ? call<{ rows: AnyRow[] }>(t, 'getRowModel')
      : which === 'all'
        ? call<{ rows: AnyRow[] }>(t, 'getCoreRowModel')
        : (call<{ rows: AnyRow[] }>(t, 'getPrePaginatedRowModel') ?? call<{ rows: AnyRow[] }>(t, 'getRowModel'))
  return model?.rows ?? []
}

function call<T>(t: Record<string, unknown>, name: string): T | undefined {
  const fn = t[name]
  return typeof fn === 'function' ? (fn as () => T).call(t) : undefined
}

function defaultHeader(column: AnyColumn): string {
  const h = (column.columnDef as { header?: unknown }).header
  return typeof h === 'string' ? h : column.id
}

/** Turn a cell value into text. Dates become ISO strings, objects JSON. */
export function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Save bytes or text as a file in the browser. */
export function downloadBlob(data: BlobPart, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
