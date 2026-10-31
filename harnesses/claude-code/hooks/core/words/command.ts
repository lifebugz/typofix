// GENERATED from packages/core - edit there, run `bun run core:sync`
import { listedWords, writtenWord } from './list'

export const ARGUMENT_GAP = /\s+/u

// A list file keeps only what its parser reads back, so an argument must read
// back as itself: `#tag` would be a comment and `a#b` the word `a`.
export function isOneWord(word: string): boolean {
  const parsed = listedWords(word)
  return parsed.length === 1 && parsed[0] === writtenWord(word)
}

export function describeList(
  name: string,
  path: string,
  words: readonly string[],
): string {
  const count = `${String(words.length)} ${words.length === 1 ? 'word' : 'words'}`
  const list = words.length > 0 ? `\n  ${words.join(', ')}` : ''
  return `${name}: ${count} in ${path}${list}`
}
