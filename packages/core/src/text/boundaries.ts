import type { Span } from '../types'
import { fillRegions } from './mask'

export const WORD_LETTER = /[\p{L}\p{N}\p{M}_]/u
export const APOSTROPHE = /['’]/u
const LEFT_QUOTE = '‘'
const LEADING_ELISION =
  /^(?:tis|twas|twere|twill|em|til|cause|cuz|cos|bout|nuff|n|kay|fraid|gainst|neath|scuse|cept|twixt)(?![\p{L}\p{N}\p{M}_])/iu
const BLANK_LINE = /\n[ \t]*\n/g

const TRAILING_MARKS = /\p{M}+$/u

export const LETTER = /\p{L}/u
const LATIN = /\p{Script=Latin}/u
export const SPACE = /\s/

export function foldApostrophes(word: string): string {
  return word.replaceAll('’', "'")
}

export function locate(text: string, word: string, near: number): number {
  return locateBy(text, word, near, isWholeWord)
}

export function locateBy(
  text: string,
  word: string,
  near: number,
  isWhole: (text: string, start: number, end: number) => boolean,
): number {
  if (word === '') {
    return -1
  }
  let best = -1
  for (let at = text.indexOf(word); at >= 0; at = text.indexOf(word, at + 1)) {
    if (
      isWhole(text, at, at + word.length) &&
      (best < 0 || Math.abs(at - near) < Math.abs(best - near))
    ) {
      best = at
    }
  }
  return best
}

export function isIntact(text: string, span: Span): boolean {
  return (
    text.slice(span.start, span.end) === span.original &&
    isWholeWord(text, span.start, span.end)
  )
}

export function isWholeWord(text: string, start: number, end: number): boolean {
  const word = text.slice(start, end).replace(TRAILING_MARKS, '')
  return (
    !continuesWord(text, start - 1, word.charAt(0)) &&
    !continuesWord(text, end, word.charAt(word.length - 1))
  )
}

export function hasNoLetterNeighbors(
  text: string,
  start: number,
  end: number,
): boolean {
  const word = text.slice(start, end).replace(TRAILING_MARKS, '')
  return (
    !continuesLetters(text.charAt(start - 1), word.charAt(0)) &&
    !continuesLetters(text.charAt(end), word.charAt(word.length - 1))
  )
}

function continuesWord(text: string, at: number, edge: string): boolean {
  return APOSTROPHE.test(text.charAt(at))
    ? isWordApostrophe(text, at)
    : continuesLetters(text.charAt(at), edge)
}

function continuesLetters(char: string, edge: string): boolean {
  return WORD_LETTER.test(char) && !isScriptChange(char, edge)
}

export function isWordApostrophe(text: string, at: number): boolean {
  return APOSTROPHE.test(text.charAt(at)) && rolesOf(text)[at] === 'word'
}

export function isLeadingElision(text: string, at: number): boolean {
  return LEADING_ELISION.test(text.slice(at + 1, at + 9))
}

type QuoteRole = 'open' | 'close' | 'word' | undefined

// Every span in a draft asks for the same roles on each key press.
let lastRoles:
  { readonly text: string; readonly roles: readonly QuoteRole[] } | undefined

function rolesOf(text: string): readonly QuoteRole[] {
  if (lastRoles?.text === text) {
    return lastRoles.roles
  }
  const roles = quoteRoles(text)
  lastRoles = { text, roles }
  return roles
}

function quoteRoles(text: string): QuoteRole[] {
  // Code counts as one word: its own apostrophes are no quotes, and a quote
  // may still open or close right at it.
  const plain = fillRegions(text, 'code', 'x')
  let roles: QuoteRole[] = []
  let start = 0
  for (const blank of plain.matchAll(BLANK_LINE)) {
    roles = roles.concat(
      paragraphRoles(plain.slice(start, blank.index)),
      Array.from({ length: blank[0].length }, (): QuoteRole => undefined),
    )
    start = blank.index + blank[0].length
  }
  return roles.concat(paragraphRoles(plain.slice(start)))
}

function paragraphRoles(paragraph: string): QuoteRole[] {
  const isLetterAt = (i: number): boolean =>
    WORD_LETTER.test(paragraph.charAt(i))
  const isInWord = (i: number): boolean =>
    isLetterAt(i - 1) &&
    isLetterAt(i + 1) &&
    !isScriptChange(paragraph.charAt(i - 1), paragraph.charAt(i + 1))
  let lastCloser = -1
  for (let i = paragraph.length - 1; i >= 0 && lastCloser < 0; i--) {
    if (
      APOSTROPHE.test(paragraph.charAt(i)) &&
      isLetterAt(i - 1) &&
      !isInWord(i)
    ) {
      lastCloser = i
    }
  }
  let isOpen = false
  return paragraph.split('').map((char, i): QuoteRole => {
    if (char === LEFT_QUOTE) {
      isOpen = true
      return 'open'
    }
    if (!APOSTROPHE.test(char)) {
      return undefined
    }
    if (isInWord(i)) {
      return 'word'
    }
    const isAfterLetter = isLetterAt(i - 1)
    const isBeforeLetter = isLetterAt(i + 1)
    if (isAfterLetter && isBeforeLetter) {
      if (isOpen) {
        isOpen = false
        return 'close'
      }
      if (lastCloser > i) {
        isOpen = true
        return 'open'
      }
      return undefined
    }
    if (isAfterLetter) {
      if (isOpen) {
        isOpen = false
        return 'close'
      }
      return 'word'
    }
    const next = paragraph.charAt(i + 1)
    if (next === '' || SPACE.test(next)) {
      return undefined
    }
    if (isOpen || lastCloser < i || isLeadingElision(paragraph, i)) {
      return isBeforeLetter ? 'word' : undefined
    }
    isOpen = true
    return 'open'
  })
}

export function isScriptChange(a: string, b: string): boolean {
  return LETTER.test(a) && LETTER.test(b) && LATIN.test(a) !== LATIN.test(b)
}
