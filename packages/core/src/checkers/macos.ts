import { isList, isRecord } from '../json'
import { APOSTROPHE, isWholeWord, isWordApostrophe } from '../text/boundaries'
import { makeSpan } from '../text/spans'
import type { Checked, LanguageGuess, Span } from '../types'

const PLURAL_END = /s$/iu

const SCRIPT_WARNING = 'typofix:'
// Only the check requests: a guesses timeout still leaves a right issue list.
const SPELL_SERVER_TIMEOUT = /NSSpellServer dataFromChecking\w* timed out/

export function parseMacResult(
  json: string,
  text: string,
): Checked | undefined {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return undefined
  }
  if (!isRecord(data)) {
    return undefined
  }
  const list = data['issues']
  if (!isList(list)) {
    return undefined
  }

  const spans = list.flatMap((item: unknown) => {
    const span = toSpan(item, text)
    return span === undefined ? [] : [span]
  })
  const guess = toGuess(data['language'], data['confidence'])
  return guess === undefined ? { spans } : { spans, guess }
}

function toGuess(
  language: unknown,
  confidence: unknown,
): LanguageGuess | undefined {
  if (typeof language !== 'string' || language === '') {
    return undefined
  }
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    return undefined
  }
  return { language, confidence }
}

function toSpan(item: unknown, text: string): Span | undefined {
  if (!isRecord(item)) {
    return undefined
  }
  const { start, end, kind, choices } = item
  if (typeof start !== 'number' || typeof end !== 'number') {
    return undefined
  }
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return undefined
  }
  if (start < 0 || end <= start || end > text.length) {
    return undefined
  }
  if (kind !== 'spelling' && kind !== 'grammar') {
    return undefined
  }
  if (!Array.isArray(choices)) {
    return undefined
  }

  const apostrophe = isWordApostrophe(text, end) ? text.charAt(end) : ''
  const spanEnd = end + apostrophe.length
  if (!isWholeWord(text, start, spanEnd)) {
    return undefined
  }

  const original = text.slice(start, spanEnd)
  const strings = choices
    .filter((c: unknown): c is string => typeof c === 'string')
    .map(choice => withApostrophe(choice, apostrophe))
  return makeSpan(original, start, kind, strings)
}

function withApostrophe(choice: string, apostrophe: string): string {
  return apostrophe !== '' &&
    PLURAL_END.test(choice) &&
    !APOSTROPHE.test(choice)
    ? choice + apostrophe
    : choice
}

export function scriptWarning(stderr: string): string | undefined {
  const warning = stderr
    .split('\n')
    .find(line => line.startsWith(SCRIPT_WARNING))
  return warning?.slice(SCRIPT_WARNING.length).trim()
}

export function isSpellServerTimeout(backend: string, stderr: string): boolean {
  return backend === 'osascript' && SPELL_SERVER_TIMEOUT.test(stderr)
}

// A spell server that is still starting answers "no typos", so after a timeout
// only a list with typos is worth keeping.
export function keptAfterServerTimeout(
  checked: Checked | undefined,
): Checked | undefined {
  return checked !== undefined && checked.spans.length > 0 ? checked : undefined
}

export function describeGuess(guess: LanguageGuess | undefined): string {
  return guess === undefined
    ? ''
    : ` (macOS reads ${guess.language}, ${String(guess.confidence)})`
}
