import { describe, expect, test } from 'claude-code/testing'

import type { Span, Token } from '../hooks/core/index'
import { focusShortcut } from '../hooks/keybindings'
import { decorationsFor, fixLetter, typeaheadRows } from '../hooks/render'

const DRAFT = 'Create a mod that check teh typos'

const span = (
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

describe('typeaheadRows', () => {
  const text = 'fix teh, then go'
  const teh = span(text, 'teh')
  const token = (word: string, start: number): Token => ({
    token: word,
    start,
    cursor: start + word.length,
  })

  test('offers the fixes for the word that ends at the cursor', () => {
    expect(typeaheadRows([teh], token('teh', 4))).toEqual([
      { text: 'the', label: 'the', description: 'fixes teh' },
      { text: 'tech', label: 'tech', description: 'fixes teh' },
      { text: 'tea', label: 'tea', description: 'fixes teh' },
    ])
  })

  test('keeps punctuation the token holds around the word', () => {
    expect(typeaheadRows([teh], token('teh,', 4)).map(r => r.text)).toEqual([
      'the,',
      'tech,',
      'tea,',
    ])
  })

  test('offers nothing for a word with no known mistake or one the cursor is not after', () => {
    expect(typeaheadRows([teh], token('then', 9))).toEqual([])
    expect(typeaheadRows([teh], { token: 'te', start: 4, cursor: 6 })).toEqual(
      [],
    )
  })

  test('offers the fixes after a closing quote, and none after more letters', () => {
    const quoted = "says 'Sumbit' now"
    const sumbit = span(quoted, 'Sumbit')
    expect(
      typeaheadRows([sumbit], token("'Sumbit'", 5)).map(r => r.text),
    ).toEqual(["'the'", "'tech'", "'tea'"])
    expect(
      typeaheadRows([sumbit], token('‘Sumbit’', 5)).map(r => r.text),
    ).toEqual(['‘the’', '‘tech’', '‘tea’'])
    expect(typeaheadRows([sumbit], token("'Sumbit's", 5))).toEqual([])
  })

  test('replaces an apostrophe that belongs to the word', () => {
    const talkin = span("stop talkin' now", "talkin'")
    expect(
      typeaheadRows([talkin], token("talkin'", 5)).map(r => r.text),
    ).toEqual(['the', 'tech', 'tea'])
  })
})

describe('focusShortcut', () => {
  const file = (context: string, key: string, action: string): string =>
    JSON.stringify({ bindings: [{ context, bindings: { [key]: action } }] })

  test('finds the key bound to the band focus action', () => {
    expect(focusShortcut(file('Chat', 'ctrl+space', 'abovePrompt:focus'))).toBe(
      'ctrl+space',
    )
    expect(focusShortcut(file('Global', 'alt+k', 'abovePrompt:focus'))).toBe(
      'alt+k',
    )
  })

  test('falls back to ctrl+x tab', () => {
    expect(focusShortcut(undefined)).toBe('ctrl+x tab')
    expect(focusShortcut('not json')).toBe('ctrl+x tab')
    expect(focusShortcut(file('Chat', 'ctrl+t', 'app:toggleTodos'))).toBe(
      'ctrl+x tab',
    )
    expect(focusShortcut(file('Pane', 'ctrl+space', 'abovePrompt:focus'))).toBe(
      'ctrl+x tab',
    )
  })
})

test('fix letters are 22 distinct letters that never use i, r, s or x', () => {
  const letters = Array.from({ length: 30 }, (_, i) => fixLetter(i))
  const used = letters.filter(letter => letter !== undefined)

  expect(used).toHaveLength(22)
  expect(new Set(used).size).toBe(22)
  for (const reserved of ['i', 'r', 's', 'x']) {
    expect(used).not.toContain(reserved)
  }
})

test('decorations underline spelling in the error color and grammar in the warning color', () => {
  expect(
    decorationsFor([span(DRAFT, 'teh'), span(DRAFT, 'check', 'grammar')]),
  ).toEqual([
    { start: 24, end: 27, underline: true, color: 'error' },
    { start: 18, end: 23, underline: true, color: 'warning' },
  ])
})

test('the word whose fixes are offered is also bold', () => {
  const teh = span(DRAFT, 'teh')
  expect(decorationsFor([span(DRAFT, 'check', 'grammar'), teh], teh)).toEqual([
    { start: 18, end: 23, underline: true, color: 'warning' },
    { start: 24, end: 27, underline: true, color: 'error', bold: true },
  ])
})
