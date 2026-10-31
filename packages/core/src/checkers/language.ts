import type { LanguageGuess, Span } from '../types'

const SURE_GUESS = 0.9

const LATIN_WORD = /^[\p{Script=Latin}\p{M}'’]+$/u
const DICTIONARY_NAME = /^[A-Za-z0-9_-]+$/
const NO_DICTIONARY = /^(?:off|none)$/i

const LANGUAGE_SUBTAG = /[-_]/

export function hunspellDictionary(option: unknown): string | undefined {
  if (typeof option !== 'string') {
    return undefined
  }
  const name = option.trim()
  return DICTIONARY_NAME.test(name) && !NO_DICTIONARY.test(name)
    ? name
    : undefined
}

export function isDictionaryLanguage(
  dictionary: string,
  configured: string,
  guess: LanguageGuess | undefined,
): boolean {
  if (configured !== '') {
    return baseLanguage(configured) === baseLanguage(dictionary)
  }
  if (guess === undefined || guess.confidence < SURE_GUESS) {
    return true
  }
  return baseLanguage(guess.language) === baseLanguage(dictionary)
}

function baseLanguage(code: string): string {
  return (code.split(LANGUAGE_SUBTAG)[0] ?? '').toLowerCase()
}

export function mergeSpans(
  primary: readonly Span[],
  extra: readonly Span[],
): Span[] {
  const added = extra.filter(
    span =>
      LATIN_WORD.test(span.original) &&
      !primary.some(p => p.start < span.end && span.start < p.end),
  )
  return [...primary, ...added].sort((a, b) => a.start - b.start)
}
