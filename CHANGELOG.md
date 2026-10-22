# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] - 2026-10-23

### Fixed

- A non-empty default global filter or column filter could not be cleared through the URL: the
  cleared value wrote no param, so a reload brought the default back. It is now written empty
  (`q=`, `f.status=`).
- `size=` and `page=` from the URL had no upper bound. They are now capped by the new
  `maxPageSize` (default 1000) and `maxPage` (default 100000) options.

### Added

- `notifyUrlChange()` for apps that change the URL with `history.pushState` / `replaceState`
  outside the hook.

### Changed (docs)

- README states exactly how the XLSX entry is split, which rows and values CSV exports, how
  formula escaping works, the default page size, and what the history adapter listens to.
- The 0.1.0 entry no longer says the Router adapter is for TanStack Start (not tested there).

## [0.1.0] - 2026-10-22

### Added

- `useTableUrlState()`: two-way sync of TanStack Table v9 sorting, column filters, global
  filter, pagination and column visibility with the URL. Defaults are left out of the URL,
  filter typing is debounced, `prefix`/`keys`/`defaults`/`slices` options, `replace` or `push`
  history, and `reset()`. Turns off Table's `autoResetPageIndex` and resets the page itself on
  user sorting and filtering, so links, back/forward and late data keep the page.
- History adapter (`window.history` + `URLSearchParams`) and the `UrlAdapter` interface for
  other routers.
- `/router`: `useTanStackRouterAdapter()` and `validateTableSearch()` for TanStack Router.
- `/core`: the framework-free codec (`encodeState`, `decodeState`, ...).
- CSV export (`toCsv`, `downloadCsv`) of the current view, with formatters, RFC 4180 quoting
  and formula escaping.
- `/xlsx`: XLSX export (`toXlsx`, `downloadXlsx`) as a separate entry with typed cells.
