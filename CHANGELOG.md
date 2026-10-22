# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-22

### Added

- `useTableUrlState()`: two-way sync of TanStack Table v9 sorting, column filters, global
  filter, pagination and column visibility with the URL. Defaults are left out of the URL,
  filter typing is debounced, `prefix`/`keys`/`defaults`/`slices` options, `replace` or `push`
  history, and `reset()`.
- History adapter (`window.history` + `URLSearchParams`) and the `UrlAdapter` interface for
  other routers.
- `/router`: `useTanStackRouterAdapter()` and `validateTableSearch()` for TanStack Router and Start.
- `/core`: the framework-free codec (`encodeState`, `decodeState`, ...).
- CSV export (`toCsv`, `downloadCsv`) of the current view, with formatters, RFC 4180 quoting
  and formula escaping.
- `/xlsx`: XLSX export (`toXlsx`, `downloadXlsx`) as a separate entry with typed cells.
