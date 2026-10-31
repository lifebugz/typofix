// GENERATED from packages/core - edit there, run `bun run core:sync`
import type { Span, Splice, Token, TypoIssue } from '../types'
import { isIntact, SPACE } from './boundaries'

const MAX_CHOICES = 3

export function makeSpan(
  original: string,
  start: number,
  kind: TypoIssue['kind'],
  choices: readonly string[],
): Span {
  const unique = [...new Set(choices.map(c => c.trim()))].filter(
    c => c !== '' && c !== original,
  )
  return {
    id: `${kind}:${String(start)}:${original}`,
    original,
    choices: unique.slice(0, MAX_CHOICES),
    kind,
    start,
    end: start + original.length,
  }
}

export function shiftSpans(
  spans: readonly Span[],
  edit: Splice,
  text: string,
): Span[] {
  const delta = edit.inputText.length - (edit.end - edit.start)
  return spans.flatMap(span => {
    const isBefore = span.end <= edit.start
    const isAfter = span.start >= edit.end
    if (!isBefore && !isAfter) {
      return []
    }
    const start = isBefore ? span.start : span.start + delta
    const moved = { ...span, start, end: start + span.original.length }
    return isIntact(text, moved) ? [moved] : []
  })
}

export function diffSplice(before: string, after: string): Splice {
  const limit = Math.min(before.length, after.length)
  let start = 0
  while (start < limit && before[start] === after[start]) {
    start += 1
  }
  let tail = 0
  while (
    tail < limit - start &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail += 1
  }
  return {
    start,
    end: before.length - tail,
    inputText: after.slice(start, after.length - tail),
  }
}

export function tokenAt(text: string, cursor: number): Token {
  let start = cursor
  while (start > 0 && !SPACE.test(text.charAt(start - 1))) {
    start -= 1
  }
  return { token: text.slice(start, cursor), start, cursor }
}

export function stillMatching(spans: readonly Span[], text: string): Span[] {
  return spans.filter(
    span => text.slice(span.start, span.end) === span.original,
  )
}

export function respan(
  spans: readonly Span[],
  before: string,
  after: string,
): Span[] {
  return shiftSpans(spans, diffSplice(before, after), after)
}
