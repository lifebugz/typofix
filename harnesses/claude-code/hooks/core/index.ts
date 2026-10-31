// GENERATED from packages/core - edit there, run `bun run core:sync`
export { MACOS_SCRIPT, SHIPPED_WORDS_FILE } from './assets'
export {
  BACKENDS,
  CHECK_DELAY_MS,
  extraBackend,
  MAX_HUNSPELL_MISSES,
  SPELL_TIMEOUT_MS,
} from './checkers/backends'
export type { Backend } from './checkers/backends'
export {
  hunspellDictionary,
  isDictionaryLanguage,
  mergeSpans,
} from './checkers/language'
export { SCRIPT_WARNING, SPELL_SERVER_TIMEOUT } from './checkers/macos'
export { applyChoice, listSignature, offeredSpan, toIssue } from './fixes'
export { isList, isRecord } from './json'
export {
  buildRewriteRequest,
  IDLE,
  parseRewriteReply,
  rephraseLimits,
  REWRITE_LABELS,
} from './rephrase'
export { maskCode } from './text/mask'
export { diffSplice, shiftSpans, tokenAt } from './text/spans'
export type {
  Checked,
  LanguageGuess,
  Rephrase,
  RephraseLimits,
  RephraseOutcome,
  Span,
  Splice,
  Token,
  TypoIssue,
  WordLevel,
} from './types'
export { ARGUMENT_GAP, describeList, isOneWord } from './words/command'
export {
  addToWordList,
  listedWords,
  parseWordList,
  PROJECT_WORDS_HEADER,
  removeFromWordList,
  USER_WORDS_HEADER,
  withoutIgnored,
  wordKey,
  WORDS_FILE,
  writtenWord,
} from './words/list'
