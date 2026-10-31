import type { WordLevel } from '../types'
import { listedWords, wordKey, writtenWord } from './list'

const ARGUMENT_GAP = /\s+/u

// A list file keeps only what its parser reads back, so an argument must read
// back as itself: `#tag` would be a comment and `a#b` the word `a`.
function isOneWord(word: string): boolean {
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

export type WordsArgs =
  | { readonly kind: 'usage' }
  | { readonly kind: 'notWords'; readonly words: readonly string[] }
  | { readonly kind: 'list' }
  | { readonly kind: 'remove'; readonly words: readonly string[] }
  | {
      readonly kind: 'add'
      readonly level: WordLevel
      readonly words: readonly string[]
    }

export interface AddedWords {
  readonly level: WordLevel
  readonly path: string
  readonly asked: readonly string[]
  readonly added: readonly string[]
  readonly shipped: ReadonlySet<string>
}

export interface WordFileEdit {
  readonly path: string
  readonly removed: readonly string[]
  readonly error?: string
}

export function parseWordsArgs(args: string): WordsArgs {
  const [action = '', ...words] = args.trim().split(ARGUMENT_GAP)
  const isEdit = action === 'add' || action === 'share' || action === 'remove'
  if (action !== '' && (!isEdit || words.length === 0)) {
    return { kind: 'usage' }
  }
  const notWords = words.filter(word => !isOneWord(word))
  if (notWords.length > 0) {
    return { kind: 'notWords', words: notWords }
  }
  if (action === '') {
    return { kind: 'list' }
  }
  return action === 'remove'
    ? { kind: 'remove', words }
    : { kind: 'add', level: action === 'add' ? 'user' : 'project', words }
}

export function askedWords(words: readonly string[]): string[] {
  return listedWords(words.join('\n'))
}

export function notShipped(
  words: readonly string[],
  shipped: ReadonlySet<string>,
): string[] {
  return words.filter(word => !shipped.has(wordKey(word)))
}

export function addReport({
  level,
  path,
  asked,
  added,
  shipped,
}: AddedWords): string {
  const isShipped = (word: string): boolean => shipped.has(wordKey(word))
  const isAdded = (word: string): boolean =>
    added.some(other => wordKey(other) === wordKey(word))
  const already = asked.filter(word => !isShipped(word) && !isAdded(word))
  return [
    ...(added.length > 0 ? [`added ${added.join(', ')} to ${path}`] : []),
    ...(level === 'project' && added.length > 0
      ? ['Commit the file to share it.']
      : []),
    ...(already.length > 0
      ? [`already in ${path}: ${already.join(', ')}`]
      : []),
    ...asked.filter(isShipped).map(word => `${word} ships with typofix`),
  ].join('\n')
}

export function removeReport(
  edits: readonly WordFileEdit[],
  asked: readonly string[],
  shipped: ReadonlySet<string>,
): string {
  const removed = new Set(edits.flatMap(edit => edit.removed).map(wordKey))
  const isListedNowhere = edits.every(edit => edit.error === undefined)
  const missing = asked.filter(
    word => !removed.has(wordKey(word)) && !shipped.has(wordKey(word)),
  )
  return [
    ...edits.flatMap(edit => {
      if (edit.error !== undefined) {
        return [`could not change ${edit.path}: ${edit.error}`]
      }
      return edit.removed.length > 0
        ? [`removed ${edit.removed.join(', ')} from ${edit.path}`]
        : []
    }),
    ...asked
      .filter(word => shipped.has(wordKey(word)))
      .map(word => `${word} ships with typofix, so it stays ignored`),
    ...(isListedNowhere && missing.length > 0
      ? [`not in your lists: ${missing.join(', ')}`]
      : []),
  ].join('\n')
}
