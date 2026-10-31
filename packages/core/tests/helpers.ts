import type { Span } from '../src/types'

export const DRAFT = 'Create a mod that check teh typos'

export const span = (
  text: string,
  word: string,
  kind: Span['kind'] = 'spelling',
): Span => {
  const start = text.indexOf(word)
  return {
    id: `${kind}:${String(start)}:${word}`,
    original: word,
    choices: ['the', 'tech', 'tea'],
    kind,
    start,
    end: start + word.length,
  }
}
