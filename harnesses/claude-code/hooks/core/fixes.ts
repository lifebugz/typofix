// GENERATED from packages/core - edit there, run `bun run core:sync`
import { isIntact, locate, WORD_LETTER } from './text/boundaries'
import { shiftSpans, tokenAt } from './text/spans'
import type { Span, Splice, Token, TypoIssue } from './types'

export function offeredSpan(
  spans: readonly Span[],
  at: Token,
): Span | undefined {
  return spans.findLast(
    s =>
      s.choices.length > 0 &&
      s.start >= at.start &&
      s.end <= at.cursor &&
      !WORD_LETTER.test(at.token.slice(s.end - at.start)),
  )
}

export function applyChoice(
  text: string,
  span: Span,
  choice: string,
): { text: string; splice: Splice } | undefined {
  const start = isIntact(text, span)
    ? span.start
    : locate(text, span.original, span.start)
  if (start < 0) {
    return undefined
  }
  const end = start + span.original.length
  return {
    text: text.slice(0, start) + choice + text.slice(end),
    splice: { start, end, inputText: choice },
  }
}

export function toIssue({ id, original, choices, kind }: Span): TypoIssue {
  return { id, original, choices, kind }
}

export function issueKey(issue: TypoIssue): string {
  return `${issue.kind}:${issue.original.toLowerCase()}`
}

export function listSignature(issues: readonly TypoIssue[]): string {
  return issues
    .map(issue => `${issueKey(issue)}>${issue.choices.join('|')}`)
    .join('\n')
}

export type ChoicePlan =
  | { readonly kind: 'gone' }
  | { readonly kind: 'moved'; readonly rest: readonly Span[] }
  | {
      readonly kind: 'applied'
      readonly text: string
      readonly spans: readonly Span[]
    }

export function offeredAtCursor(
  spans: readonly Span[],
  text: string,
  cursor: number,
): Span | undefined {
  return offeredSpan(spans, tokenAt(text, cursor))
}

export function spanSignature(spans: readonly Span[]): string {
  return listSignature(spans.map(toIssue))
}

export function isNewList(
  hiddenFor: string | undefined,
  spans: readonly Span[],
): boolean {
  return hiddenFor !== undefined && spanSignature(spans) !== hiddenFor
}

export function planChoice(
  spans: readonly Span[],
  id: string,
  text: string,
  choice: string,
): ChoicePlan {
  const target = spans.find(span => span.id === id)
  if (target === undefined) {
    return { kind: 'gone' }
  }
  const rest = spans.filter(span => span.id !== id)
  const applied = applyChoice(text, target, choice)
  if (applied === undefined) {
    return { kind: 'moved', rest }
  }
  return {
    kind: 'applied',
    text: applied.text,
    spans: shiftSpans(rest, applied.splice, applied.text),
  }
}
