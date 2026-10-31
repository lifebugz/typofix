import { isList, isRecord } from '../json'
import { APOSTROPHE, isWholeWord, isWordApostrophe } from '../text/boundaries'
import { makeSpan } from '../text/spans'
import type { Checked, LanguageGuess, Span } from '../types'

const PLURAL_END = /s$/iu

export const SCRIPT_WARNING = 'typofix:'
// Only the check requests: a guesses timeout still leaves a right issue list.
export const SPELL_SERVER_TIMEOUT =
  /NSSpellServer dataFromChecking\w* timed out/

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
