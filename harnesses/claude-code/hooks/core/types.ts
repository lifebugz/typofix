// GENERATED from packages/core - edit there, run `bun run core:sync`
export interface TypoIssue {
  readonly id: string
  readonly original: string
  readonly choices: readonly string[]
  readonly kind: 'spelling' | 'grammar'
}

export type Rephrase =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly rewrites: readonly string[] }
  | { readonly status: 'failed'; readonly reason: string }

export type Span = TypoIssue & { readonly start: number; readonly end: number }

export interface Token {
  readonly token: string
  readonly start: number
  readonly cursor: number
}

export interface Splice {
  readonly start: number
  readonly end: number
  readonly inputText: string
}

export interface LanguageGuess {
  readonly language: string
  readonly confidence: number
}

export interface Checked {
  readonly spans: readonly Span[]
  readonly guess?: LanguageGuess
}

export interface RephraseLimits {
  readonly maxTokens: number
  readonly timeoutMs: number
}
export type RephraseOutcome =
  { readonly rewrites: readonly string[] } | { readonly reason: string }
export type WordLevel = 'user' | 'project'
