import type { ColumnFiltersState, ColumnVisibilityState, PaginationState, SortingState } from '@tanstack/react-table'

/** The table state slices this package keeps in the URL. */
export interface UrlTableState {
  sorting: SortingState
  columnFilters: ColumnFiltersState
  globalFilter: unknown
  pagination: PaginationState
  columnVisibility: ColumnVisibilityState
}

export type UrlStateSlice = keyof UrlTableState

export const ALL_SLICES: readonly UrlStateSlice[] = ['sorting', 'columnFilters', 'globalFilter', 'pagination', 'columnVisibility']

/** Search-param names. Every name gets `prefix` in front of it. */
export interface UrlStateKeys {
  sorting: string
  globalFilter: string
  page: string
  pageSize: string
  columnVisibility: string
  /** Each column filter is written as `<columnFilterPrefix><columnId>`. */
  columnFilterPrefix: string
}

export const DEFAULT_KEYS: UrlStateKeys = {
  sorting: 'sort',
  globalFilter: 'q',
  page: 'page',
  pageSize: 'size',
  columnVisibility: 'hide',
  columnFilterPrefix: 'f.',
}

export const DEFAULT_STATE: UrlTableState = {
  sorting: [],
  columnFilters: [],
  globalFilter: '',
  pagination: { pageIndex: 0, pageSize: 10 },
  columnVisibility: {},
}

export interface CodecOptions {
  /** Prepended to every key, e.g. `'orders.'` when two tables share a page. */
  prefix?: string
  /** Override individual search-param names. */
  keys?: Partial<UrlStateKeys>
  /** State that is never written to the URL because it is the default. */
  defaults?: Partial<UrlTableState>
  /** Which slices to sync. Defaults to all five. */
  slices?: readonly UrlStateSlice[]
  /** Larger `size=` values from the URL are capped to this. Default 1000. */
  maxPageSize?: number
  /** Larger `page=` values from the URL are capped to this (1-based). Default 100000. */
  maxPage?: number
}

/** A flat map of search params. `undefined` means "remove this param". */
export type ParamPatch = Record<string, string | undefined>

export interface ResolvedCodec {
  keys: UrlStateKeys
  defaults: UrlTableState
  slices: ReadonlySet<UrlStateSlice>
  maxPageSize: number
  maxPage: number
  /** True when `key` is one of this codec's params. */
  owns: (key: string) => boolean
}

export function resolveCodec(options: CodecOptions = {}): ResolvedCodec {
  const prefix = options.prefix ?? ''
  const base = { ...DEFAULT_KEYS, ...options.keys }
  const keys = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, prefix + v])) as unknown as UrlStateKeys
  const defaults: UrlTableState = {
    ...DEFAULT_STATE,
    ...options.defaults,
    pagination: { ...DEFAULT_STATE.pagination, ...options.defaults?.pagination },
  }
  const slices = new Set(options.slices ?? ALL_SLICES)
  const fixed = new Set([keys.sorting, keys.globalFilter, keys.page, keys.pageSize, keys.columnVisibility])
  return {
    keys,
    defaults,
    slices,
    maxPageSize: options.maxPageSize ?? 1000,
    maxPage: options.maxPage ?? 100_000,
    owns: (key) =>
      (fixed.has(key) && sliceOfKey(keys, key, slices)) ||
      (slices.has('columnFilters') && key.startsWith(keys.columnFilterPrefix) && key.length > keys.columnFilterPrefix.length),
  }
}

function sliceOfKey(keys: UrlStateKeys, key: string, slices: ReadonlySet<UrlStateSlice>): boolean {
  if (key === keys.sorting) return slices.has('sorting')
  if (key === keys.globalFilter) return slices.has('globalFilter')
  if (key === keys.page || key === keys.pageSize) return slices.has('pagination')
  return slices.has('columnVisibility')
}

// ---- values ---------------------------------------------------------------

/**
 * Encode a filter value. Plain strings stay readable (`paid`); anything else,
 * and strings that would read back as another type, is written as JSON.
 */
export function encodeValue(value: unknown): string {
  if (typeof value === 'string' && !looksLikeJson(value)) return value
  return JSON.stringify(value)
}

/** Inverse of {@link encodeValue}. */
export function decodeValue(raw: string): unknown {
  if (!looksLikeJson(raw)) return raw
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function looksLikeJson(s: string): boolean {
  if (s === '') return false
  const c = s[0]
  if (c === '"' || c === '[' || c === '{') return true
  if (s === 'true' || s === 'false' || s === 'null') return true
  return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)
}

// Column ids go into comma-separated lists, so escape the separator.
const escId = (id: string) => id.replace(/%/g, '%25').replace(/,/g, '%2C')
const unescId = (id: string) => id.replace(/%2C/gi, ',').replace(/%25/g, '%')

// ---- state <-> params -----------------------------------------------------

/** Turn table state into a param patch. Slices equal to their default are removed. */
export function encodeState(state: Partial<UrlTableState>, codec: ResolvedCodec): ParamPatch {
  const { keys, defaults, slices } = codec
  const out: ParamPatch = {}

  if (slices.has('sorting') && state.sorting) {
    out[keys.sorting] = equal(state.sorting, defaults.sorting)
      ? undefined
      : state.sorting.map((s) => (s.desc ? '-' : '') + escId(s.id)).join(',')
  }

  if (slices.has('globalFilter') && 'globalFilter' in state) {
    const v = state.globalFilter
    const d = defaults.globalFilter
    // An empty search over a non-empty default is written as `q=` so it reads back as empty.
    out[keys.globalFilter] = equal(v, d) || (isEmpty(v) && isEmpty(d)) ? undefined : isEmpty(v) ? '' : encodeValue(v)
  }

  if (slices.has('pagination') && state.pagination) {
    const { pageIndex, pageSize } = state.pagination
    out[keys.page] = pageIndex === defaults.pagination.pageIndex ? undefined : String(pageIndex + 1)
    out[keys.pageSize] = pageSize === defaults.pagination.pageSize ? undefined : String(pageSize)
  }

  if (slices.has('columnVisibility') && state.columnVisibility) {
    const hidden = hiddenIds(state.columnVisibility)
    out[keys.columnVisibility] = equal(hidden, hiddenIds(defaults.columnVisibility))
      ? undefined
      : hidden.map(escId).join(',')
  }

  if (slices.has('columnFilters') && state.columnFilters) {
    if (!equal(state.columnFilters, defaults.columnFilters)) {
      for (const f of state.columnFilters) {
        if (!isEmpty(f.value)) out[keys.columnFilterPrefix + f.id] = encodeValue(f.value)
      }
      // A default filter the user cleared is written empty (`f.status=`) so the default does not come back.
      for (const d of defaults.columnFilters) {
        if (!(keys.columnFilterPrefix + d.id in out)) out[keys.columnFilterPrefix + d.id] = ''
      }
    }
  }

  return out
}

/**
 * Read table state from params. Missing params fall back to the defaults;
 * malformed params are ignored rather than thrown.
 */
export function decodeState(params: Record<string, string>, codec: ResolvedCodec): UrlTableState {
  const { keys, defaults, slices } = codec
  const state: UrlTableState = structuredCloneState(defaults)

  const sort = params[keys.sorting]
  if (slices.has('sorting') && sort !== undefined) {
    state.sorting = sort
      .split(',')
      .filter(Boolean)
      .map((part) => (part.startsWith('-') ? { id: unescId(part.slice(1)), desc: true } : { id: unescId(part), desc: false }))
      .filter((s) => s.id !== '')
  }

  const q = params[keys.globalFilter]
  if (slices.has('globalFilter') && q !== undefined) state.globalFilter = decodeValue(q)

  if (slices.has('pagination')) {
    const page = toInt(params[keys.page])
    const size = toInt(params[keys.pageSize])
    if (page !== undefined && page >= 1) state.pagination.pageIndex = Math.min(page, codec.maxPage) - 1
    if (size !== undefined && size >= 1) state.pagination.pageSize = Math.min(size, codec.maxPageSize)
  }

  const hide = params[keys.columnVisibility]
  if (slices.has('columnVisibility') && hide !== undefined) {
    const vis: ColumnVisibilityState = {}
    // Columns hidden by default but absent from the list were shown by the user.
    for (const id of hiddenIds(defaults.columnVisibility)) vis[id] = true
    for (const id of hide.split(',').filter(Boolean)) vis[unescId(id)] = false
    state.columnVisibility = vis
  }

  if (slices.has('columnFilters')) {
    const filters: ColumnFiltersState = []
    let present = false
    for (const [key, raw] of Object.entries(params)) {
      if (key.startsWith(keys.columnFilterPrefix) && key.length > keys.columnFilterPrefix.length) {
        present = true
        // `f.status=` marks a cleared default filter.
        if (raw !== '') filters.push({ id: key.slice(keys.columnFilterPrefix.length), value: decodeValue(raw) })
      }
    }
    if (present) state.columnFilters = filters
  }

  return state
}

/** Only this codec's params, as a plain record. */
export function pickParams(source: URLSearchParams | Record<string, string>, codec: ResolvedCodec): Record<string, string> {
  const out: Record<string, string> = {}
  const entries = source instanceof URLSearchParams ? source.entries() : Object.entries(source)
  for (const [k, v] of entries) if (codec.owns(k)) out[k] = v
  return out
}

/**
 * The full patch to move the URL to `state`: every param this codec owns is
 * either set or removed, so stale column filters disappear too.
 */
export function diffParams(current: Record<string, string>, state: Partial<UrlTableState>, codec: ResolvedCodec): ParamPatch {
  const next = encodeState(state, codec)
  const patch: ParamPatch = {}
  if (state.columnFilters && codec.slices.has('columnFilters')) {
    for (const k of Object.keys(current)) {
      if (k.startsWith(codec.keys.columnFilterPrefix) && !(k in next)) patch[k] = undefined
    }
  }
  for (const [k, v] of Object.entries(next)) if (current[k] !== v) patch[k] = v
  return patch
}

// ---- helpers --------------------------------------------------------------

function hiddenIds(vis: ColumnVisibilityState): string[] {
  return Object.keys(vis)
    .filter((id) => vis[id] === false)
    .sort()
}

function toInt(s: string | undefined): number | undefined {
  if (s === undefined || !/^\d+$/.test(s)) return undefined
  return Number(s)
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
}

function structuredCloneState(s: UrlTableState): UrlTableState {
  return {
    sorting: s.sorting.map((x) => ({ ...x })),
    columnFilters: s.columnFilters.map((x) => ({ ...x })),
    globalFilter: s.globalFilter,
    pagination: { ...s.pagination },
    columnVisibility: { ...s.columnVisibility },
  }
}

/** Structural equality for plain JSON-like values. */
export function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
