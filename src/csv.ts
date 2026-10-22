import { type ExportOptions, downloadBlob, getExportMatrix, toText } from './matrix'

export type { ExportContext, ExportMatrix, ExportOptions } from './matrix'
export { getExportMatrix } from './matrix'

export interface CsvOptions extends ExportOptions {
  /** Field separator. Default `,`. */
  delimiter?: string
  /** Line ending. Default `\r\n` (RFC 4180). */
  newline?: string
  /** Start with a UTF-8 byte-order mark so Excel opens accents correctly. Default false. */
  bom?: boolean
  /**
   * Prefix text cells that start with `=`, `+`, `-`, `@`, tab or CR with `'`
   * so spreadsheets do not run them as formulas. Numbers are left alone.
   * Default true.
   */
  escapeFormulas?: boolean
}

/** The table's current view as CSV text. */
export function toCsv(table: object, options: CsvOptions = {}): string {
  const { delimiter = ',', newline = '\r\n', bom = false, escapeFormulas = true } = options
  const { headers, rows } = getExportMatrix(table, options)
  const cell = (value: unknown) => {
    let text = toText(value)
    if (escapeFormulas && typeof value !== 'number' && /^[=+\-@\t\r]/.test(text)) text = "'" + text
    return /["\r\n]/.test(text) || text.includes(delimiter) ? '"' + text.replace(/"/g, '""') + '"' : text
  }
  const lines = [headers, ...rows].map((r) => r.map(cell).join(delimiter))
  return (bom ? '﻿' : '') + lines.join(newline)
}

/** Download the table's current view as a `.csv` file. */
export function downloadCsv(table: object, options: CsvOptions & { filename?: string } = {}): void {
  downloadBlob(toCsv(table, options), options.filename ?? 'export.csv', 'text/csv;charset=utf-8')
}
