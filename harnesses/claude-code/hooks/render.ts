import type {
  PromptAutocompleteSuggestion,
  PromptDecoration,
} from 'claude-code'

import { offeredSpan, type Span, type Token } from './core/index'

const FIX_LETTERS = 'abcdefghjklmnopqtuvwyz'

export function typeaheadRows(
  spans: readonly Span[],
  at: Token,
): PromptAutocompleteSuggestion[] {
  const span = offeredSpan(spans, at)
  if (span === undefined) {
    return []
  }

  const head = at.token.slice(0, span.start - at.start)
  const tail = at.token.slice(span.end - at.start)
  return span.choices.map(choice => ({
    text: head + choice + tail,
    label: choice,
    description: `fixes ${span.original}`,
  }))
}

export function fixLetter(index: number): string | undefined {
  return FIX_LETTERS[index]
}

export function decorationsFor(
  spans: readonly Span[],
  offered?: Span,
): PromptDecoration[] {
  return spans.map(span => ({
    start: span.start,
    end: span.end,
    underline: true,
    color: span.kind === 'spelling' ? 'error' : 'warning',
    ...(span === offered && { bold: true }),
  }))
}
