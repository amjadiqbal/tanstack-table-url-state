// Framework-free URL state: the codec and the history adapter. No React import.
export {
  ALL_SLICES,
  DEFAULT_KEYS,
  DEFAULT_STATE,
  decodeState,
  decodeValue,
  diffParams,
  encodeState,
  encodeValue,
  pickParams,
  resolveCodec,
} from './codec'
export type { CodecOptions, ParamPatch, ResolvedCodec, UrlStateKeys, UrlStateSlice, UrlTableState } from './codec'
export { applyPatch, createHistoryAdapter, notifyUrlChange } from './adapter'
export type { UrlAdapter } from './adapter'
