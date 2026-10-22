import { useMemo } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { UrlAdapter } from './adapter'
import { type CodecOptions, decodeValue, encodeValue, resolveCodec } from './codec'

/**
 * Adapter for TanStack Router. Reads the router's parsed search and writes
 * through `router.navigate`, so loaders, `useSearch` and devtools all see the
 * change. Works the same in TanStack Start.
 *
 * ```tsx
 * const adapter = useTanStackRouterAdapter()
 * const { tableOptions } = useTableUrlState({ adapter })
 * ```
 */
export function useTanStackRouterAdapter(): UrlAdapter {
  const router = useRouter()
  return useMemo<UrlAdapter>(
    () => ({
      read: () => toStrings(router.state.location.search as Record<string, unknown>),
      write(patch, { history }) {
        // Start from the raw location search, not the route's validated search,
        // so params a strict validateSearch drops are not lost.
        const next: Record<string, unknown> = { ...(router.state.location.search as Record<string, unknown>) }
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) delete next[key]
          else next[key] = decodeValue(value)
        }
        void router.navigate({
          to: '.',
          search: next as never,
          replace: history === 'replace',
          resetScroll: false,
        } as never)
      },
      subscribe: (listener) => router.subscribe('onResolved', listener),
    }),
    [router],
  )
}

/**
 * The router parses search values as JSON, so turn them back into the same
 * strings the codec writes. `?page=3` arrives as the number 3 and leaves as "3".
 */
function toStrings(search: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined) out[key] = encodeValue(value)
  }
  return out
}

/** The shape this package keeps in a route's search, for typing `useSearch`. */
export type TableSearch = Record<string, string | number | boolean | null | unknown[] | Record<string, unknown> | undefined>

/**
 * A `validateSearch` that keeps only this table's params. Compose it with
 * your own schema so a strict validator does not strip them:
 *
 * ```ts
 * const tableSearch = validateTableSearch()
 * validateSearch: (search) => ({ ...tableSearch(search), ...mySchema.parse(search) })
 * ```
 */
export function validateTableSearch(options: CodecOptions = {}): (search: Record<string, unknown>) => TableSearch {
  const codec = resolveCodec(options)
  return (search) => {
    const out: TableSearch = {}
    for (const [key, value] of Object.entries(search)) {
      if (codec.owns(key) && value !== undefined) out[key] = value as TableSearch[string]
    }
    return out
  }
}
