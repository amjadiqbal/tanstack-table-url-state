import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ColumnFiltersState,
  ColumnVisibilityState,
  OnChangeFn,
  PaginationState,
  SortingState,
  Updater,
} from '@tanstack/react-table'
import { createHistoryAdapter, type UrlAdapter } from './adapter'
import {
  type CodecOptions,
  type UrlStateSlice,
  type UrlTableState,
  decodeState,
  diffParams,
  equal,
  pickParams,
  resolveCodec,
} from './codec'

export interface UseTableUrlStateOptions extends CodecOptions {
  /** Where the state is stored. Defaults to `window.history` + `URLSearchParams`. */
  adapter?: UrlAdapter
  /**
   * Delay before typing in a filter reaches the URL, in ms. Sorting, paging and
   * visibility changes are written at once. Default 300.
   */
  debounceMs?: number
  /** `'replace'` (default) keeps the back button clean; `'push'` adds history entries. */
  history?: 'push' | 'replace'
}

/** Options to pass straight into `useTable`. Only the synced slices are present. */
export interface UrlTableOptions {
  state: Partial<UrlTableState>
  onSortingChange?: OnChangeFn<SortingState>
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
  onGlobalFilterChange?: OnChangeFn<any>
  onPaginationChange?: OnChangeFn<PaginationState>
  onColumnVisibilityChange?: OnChangeFn<ColumnVisibilityState>
}

export interface UseTableUrlStateResult {
  /** Current values of all five slices (defaults for slices that are not synced). */
  state: UrlTableState
  /** Spread into `useTable({ features, columns, data, ...tableOptions })`. */
  tableOptions: UrlTableOptions
  /** Back to the defaults; removes this table's params from the URL. */
  reset: () => void
}

const FILTER_SLICES: ReadonlySet<UrlStateSlice> = new Set(['globalFilter', 'columnFilters'])
let sharedHistoryAdapter: UrlAdapter | undefined

/**
 * Two-way sync between TanStack Table v9 state and the URL.
 *
 * ```tsx
 * const { tableOptions } = useTableUrlState()
 * const table = useTable({ features, columns, data, ...tableOptions })
 * ```
 */
export function useTableUrlState(options: UseTableUrlStateOptions = {}): UseTableUrlStateResult {
  const { adapter: givenAdapter, debounceMs = 300, history = 'replace', prefix, keys, defaults, slices } = options
  const adapter = givenAdapter ?? (sharedHistoryAdapter ??= createHistoryAdapter())

  // Callers usually pass inline objects, so key the codec on their content.
  const codecKey = JSON.stringify([prefix, keys, defaults, slices])
  const codec = useMemo(() => resolveCodec({ prefix, keys, defaults, slices }), [codecKey])

  const [state, setState] = useState<UrlTableState>(() => decodeState(pickParams(adapter.read(), codec), codec))

  const stateRef = useRef(state)
  const prevRef = useRef<UrlTableState | null>(null)
  const fromUrlRef = useRef(false)
  const lastSeenRef = useRef(serialize(pickParams(adapter.read(), codec)))
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const historyRef = useRef(history)
  historyRef.current = history

  const cancelPending = () => {
    if (timerRef.current !== undefined) clearTimeout(timerRef.current)
    timerRef.current = undefined
  }

  // URL -> state, for back/forward and links that change the params.
  useEffect(() => {
    const sync = () => {
      const params = pickParams(adapter.read(), codec)
      const seen = serialize(params)
      if (seen === lastSeenRef.current) return
      lastSeenRef.current = seen
      cancelPending()
      fromUrlRef.current = true
      setState(decodeState(params, codec))
    }
    sync()
    return adapter.subscribe(sync)
  }, [adapter, codec])

  // state -> URL.
  useEffect(() => {
    stateRef.current = state
    const prev = prevRef.current
    prevRef.current = state
    if (fromUrlRef.current) {
      fromUrlRef.current = false
      return
    }
    const write = () => {
      timerRef.current = undefined
      const current = pickParams(adapter.read(), codec)
      const patch = diffParams(current, stateRef.current, codec)
      if (Object.keys(patch).length === 0) return
      const next = { ...current }
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete next[k]
        else next[k] = v
      }
      lastSeenRef.current = serialize(next)
      adapter.write(patch, { history: historyRef.current })
    }
    cancelPending()
    const onlyFilters = prev !== null && changedSlices(prev, state).every((s) => FILTER_SLICES.has(s))
    if (onlyFilters && debounceMs > 0) timerRef.current = setTimeout(write, debounceMs)
    else write()
  }, [state, adapter, codec, debounceMs])

  // Leaving the page drops a pending write instead of writing onto the next route.
  useEffect(() => cancelPending, [])

  const setSlice = useCallback(<K extends UrlStateSlice>(slice: K, updater: Updater<UrlTableState[K]>) => {
    setState((prev) => {
      const value = typeof updater === 'function' ? (updater as (old: UrlTableState[K]) => UrlTableState[K])(prev[slice]) : updater
      // Table sends fresh but equal objects (e.g. its page reset); keep the old state then.
      return equal(value, prev[slice]) ? prev : { ...prev, [slice]: value }
    })
  }, [])

  const handlers = useMemo(
    () => ({
      onSortingChange: (u: Updater<SortingState>) => setSlice('sorting', u),
      onColumnFiltersChange: (u: Updater<ColumnFiltersState>) => setSlice('columnFilters', u),
      onGlobalFilterChange: (u: Updater<any>) => setSlice('globalFilter', u),
      onPaginationChange: (u: Updater<PaginationState>) => setSlice('pagination', u),
      onColumnVisibilityChange: (u: Updater<ColumnVisibilityState>) => setSlice('columnVisibility', u),
    }),
    [setSlice],
  )

  const tableOptions = useMemo<UrlTableOptions>(() => {
    const out: UrlTableOptions = { state: {} }
    const s = codec.slices
    if (s.has('sorting')) Object.assign(out, { onSortingChange: handlers.onSortingChange }).state.sorting = state.sorting
    if (s.has('columnFilters')) Object.assign(out, { onColumnFiltersChange: handlers.onColumnFiltersChange }).state.columnFilters = state.columnFilters
    if (s.has('globalFilter')) Object.assign(out, { onGlobalFilterChange: handlers.onGlobalFilterChange }).state.globalFilter = state.globalFilter
    if (s.has('pagination')) Object.assign(out, { onPaginationChange: handlers.onPaginationChange }).state.pagination = state.pagination
    if (s.has('columnVisibility'))
      Object.assign(out, { onColumnVisibilityChange: handlers.onColumnVisibilityChange }).state.columnVisibility = state.columnVisibility
    return out
  }, [state, codec, handlers])

  const reset = useCallback(() => setState(decodeState({}, codec)), [codec])

  return { state, tableOptions, reset }
}

function changedSlices(a: UrlTableState, b: UrlTableState): UrlStateSlice[] {
  return (Object.keys(b) as UrlStateSlice[]).filter((k) => !equal(a[k], b[k]))
}

function serialize(params: Record<string, string>): string {
  return JSON.stringify(Object.keys(params).sort().map((k) => [k, params[k]]))
}
