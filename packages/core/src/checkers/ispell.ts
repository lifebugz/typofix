import {
  foldApostrophes,
  hasNoLetterNeighbors,
  isLeadingElision,
  isScriptChange,
  isWordApostrophe,
  LETTER,
  locateBy,
} from '../text/boundaries'
import { makeSpan } from '../text/spans'
import type { Span } from '../types'

interface IspellWord {
  readonly original: string
  readonly start: number
  readonly choices: readonly string[]
}

const EDGE_APOSTROPHES = /^['’]+|['’]+$/gu

const ISPELL_MISS = /^& (\S+) \d+ (\d+): (.*)$/
const ISPELL_NONE = /^# (\S+) (\d+)$/

export function toIspellInput(text: string): string {
  return `${text
    .split('\n')
    .map(line => `^${line}`)
    .join('\n')}\n`
}

export function parseIspell(output: string, text: string): Span[] {
  const lines = text.split('\n')
  const lineStarts: number[] = []
  let offset = 0
  for (const line of lines) {
    lineStarts.push(offset)
    offset += line.length + 1
  }

  const spans: Span[] = []
  let row = 0
  for (const out of output.split('\n')) {
    if (out.startsWith('@')) {
      continue
    }
    if (out === '') {
      row += 1
      continue
    }
    const miss = ISPELL_MISS.exec(out)
    const none = miss === null ? ISPELL_NONE.exec(out) : null
    const word = miss?.[1] ?? none?.[1]
    const reported = Number(miss?.[2] ?? none?.[2])
    const line = lines[row]
    const lineStart = lineStarts[row]
    if (word === undefined || line === undefined || lineStart === undefined) {
      continue
    }

    const bare = withoutEdgeApostrophes(word)
    const index = locateBy(
      line,
      bare,
      byteOffsetToIndex(`^${line}`, reported) - 1 + word.indexOf(bare),
      hasNoLetterNeighbors,
    )
    if (index < 0) {
      continue
    }
    const read = readIspellWord(
      text,
      word,
      lineStart + index,
      miss?.[3]?.split(', ') ?? [],
    )
    if (read !== undefined) {
      spans.push(makeSpan(read.original, read.start, 'spelling', read.choices))
    }
  }
  return spans
}

function readIspellWord(
  text: string,
  word: string,
  index: number,
  suggested: readonly string[],
): IspellWord | undefined {
  const bare = withoutEdgeApostrophes(word)
  if (bare.length < 2 || mixesScripts(bare)) {
    return undefined
  }
  const bareEnd = index + bare.length
  const start = isWordApostrophe(text, index - 1) ? index - 1 : index
  const end = isWordApostrophe(text, bareEnd) ? bareEnd + 1 : bareEnd
  if (start < index && isLeadingElision(text, start)) {
    return undefined
  }
  const isQuoteOnlyFault =
    suggested.some(choice => isSameWord(choice, bare)) &&
    !(end > bareEnd && restoresContraction(suggested[0], bare))
  const tokenStart = index - word.indexOf(bare)
  const tokenEnd = tokenStart + word.length
  if (
    isQuoteOnlyFault ||
    text.slice(tokenStart, tokenEnd) !== word ||
    start < tokenStart ||
    end > tokenEnd
  ) {
    return undefined
  }
  return { original: text.slice(start, end), start, choices: suggested }
}

function restoresContraction(
  choice: string | undefined,
  bare: string,
): boolean {
  return (
    bare.endsWith('t') &&
    choice?.replaceAll('’', "'") === `${bare.slice(0, -1)}'t`
  )
}

function mixesScripts(word: string): boolean {
  const letters = word.split('').filter(char => LETTER.test(char))
  return letters.some((char, i) => isScriptChange(letters[i - 1] ?? '', char))
}

function isSameWord(choice: string, word: string): boolean {
  const plain = (text: string): string =>
    foldApostrophes(withoutEdgeApostrophes(text))
  return plain(choice) === plain(word)
}

function withoutEdgeApostrophes(word: string): string {
  return word.replace(EDGE_APOSTROPHES, '')
}

function byteOffsetToIndex(line: string, byteOffset: number): number {
  const bytes = new TextEncoder().encode(line)
  if (
    !Number.isInteger(byteOffset) ||
    byteOffset < 0 ||
    byteOffset > bytes.length
  ) {
    return byteOffset
  }
  return new TextDecoder().decode(bytes.slice(0, byteOffset)).length
}
