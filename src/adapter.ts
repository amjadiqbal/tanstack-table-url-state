import type { ParamPatch } from './codec'

/**
 * Where the URL state lives. The React hook only talks to this interface, so
 * any router can be plugged in with a few lines.
 */
export interface UrlAdapter {
  /** Current search params as strings. */
  read: () => Record<string, string>
  /** Apply a patch; `undefined` removes a param. Other params must be kept. */
  write: (patch: ParamPatch, options: { history: 'push' | 'replace' }) => void
  /** Call `listener` whenever the URL may have changed. Returns an unsubscribe. */
  subscribe: (listener: () => void) => () => void
}

const CHANGE_EVENT = 'tanstack-table-url-state:change'

/**
 * Adapter for plain `window.history` and `URLSearchParams`. Works with any
 * router that reads `location.search`, or none. On the server it reads nothing
 * and writes nothing.
 */
export function createHistoryAdapter(): UrlAdapter {
  return {
    read() {
      if (typeof window === 'undefined') return {}
      return Object.fromEntries(new URLSearchParams(window.location.search))
    },
    write(patch, { history }) {
      if (typeof window === 'undefined') return
      const url = new URL(window.location.href)
      applyPatch(url.searchParams, patch)
      const next = url.pathname + url.search + url.hash
      if (next === window.location.pathname + window.location.search + window.location.hash) return
      if (history === 'push') window.history.pushState(window.history.state, '', next)
      else window.history.replaceState(window.history.state, '', next)
      window.dispatchEvent(new Event(CHANGE_EVENT))
    },
    subscribe(listener) {
      if (typeof window === 'undefined') return () => {}
      window.addEventListener('popstate', listener)
      window.addEventListener(CHANGE_EVENT, listener)
      return () => {
        window.removeEventListener('popstate', listener)
        window.removeEventListener(CHANGE_EVENT, listener)
      }
    },
  }
}

/** Apply a patch to `URLSearchParams` in place. */
export function applyPatch(params: URLSearchParams, patch: ParamPatch): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) params.delete(key)
    else params.set(key, value)
  }
}
