import { isIntact, locate, WORD_LETTER } from './text/boundaries'
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
