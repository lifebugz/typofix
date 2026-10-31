// GENERATED from packages/core - edit there, run `bun run core:sync`
import { foldApostrophes, LETTER } from '../text/boundaries'
import type { Span } from '../types'

export const WORDS_FILE = 'typofix-words.txt'

const SPACES = /\s+/u
const EDGE_NON_WORD = /^[^\p{L}\p{N}\p{M}]+|[^\p{L}\p{N}\p{M}]+$/gu
// No `$` anchor: `.` stops at the `\r` that ends a CRLF line, and `$` would not.
const WORD_LIST_COMMENT = /#.*/u
const WORD_LIST_FORMAT = '# One word a line. Text after # is a comment.'

export const USER_WORDS_HEADER: readonly string[] = [
  '# Words typofix never lists as typos, in all your projects.',
  WORD_LIST_FORMAT,
]
export const PROJECT_WORDS_HEADER: readonly string[] = [
  '# Words typofix never lists as typos in this project. Commit this file to share them.',
  WORD_LIST_FORMAT,
]

export function writtenWord(word: string): string {
  return word.normalize('NFC').replace(EDGE_NON_WORD, '')
}

// Engines cut one word differently (macOS `freinds’`, hunspell `freinds`),
// so a word list matches by this key, never by the text as written.
export function wordKey(word: string): string {
  return foldApostrophes(writtenWord(word)).toLowerCase().normalize('NFC')
}

export function isWord(word: string): boolean {
  return LETTER.test(word)
}

function lineWords(line: string): string[] {
  return line
    .replace(WORD_LIST_COMMENT, '')
    .split(SPACES)
    .map(writtenWord)
    .filter(isWord)
}

export function listedWords(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split('\n')
    .flatMap(lineWords)
    .filter(word => {
      const key = wordKey(word)
      const isNew = !seen.has(key)
      seen.add(key)
      return isNew
    })
}

export function parseWordList(text: string): Set<string> {
  return new Set(listedWords(text).map(wordKey))
}

export function withoutIgnored(
  spans: readonly Span[],
  keys: ReadonlySet<string>,
): Span[] {
  return spans.filter(
    span => span.kind !== 'spelling' || !keys.has(wordKey(span.original)),
  )
}

export function addToWordList(
  text: string,
  words: readonly string[],
  header: readonly string[],
): { text: string; added: string[] } {
  const keys = parseWordList(text)
  const added = words.map(writtenWord).filter(word => {
    const key = wordKey(word)
    const isNew = isWord(word) && !keys.has(key)
    keys.add(key)
    return isNew
  })
  if (added.length === 0) {
    return { text, added }
  }
  const lines = text === '' ? [...header, ...added] : added
  const base = text === '' || text.endsWith('\n') ? text : `${text}\n`
  return { text: `${base}${lines.join('\n')}\n`, added }
}

export function removeFromWordList(
  text: string,
  keys: ReadonlySet<string>,
): { text: string; removed: string[] } {
  const removed: string[] = []
  const lines = text.split('\n').flatMap(line => {
    const words = lineWords(line)
    const isRemoved = (word: string): boolean => keys.has(wordKey(word))
    if (!words.some(isRemoved)) {
      return [line]
    }
    removed.push(...words.filter(isRemoved))
    const comment = WORD_LIST_COMMENT.exec(line)?.[0] ?? ''
    const kept = [...words.filter(word => !isRemoved(word)), comment]
      .filter(part => part !== '')
      .join(' ')
    return kept === '' ? [] : [kept]
  })
  return { text: lines.join('\n'), removed }
}
