import { describe, expect, test } from 'bun:test'

import { applyChoice, offeredSpan } from '../src/fixes'
import { tokenAt } from '../src/text/spans'
import { DRAFT, span } from './helpers'

describe('applyChoice', () => {
  test('replaces the word where it stands', () => {
    const applied = applyChoice(DRAFT, span(DRAFT, 'teh'), 'the')

    expect(applied?.text).toBe('Create a mod that check the typos')
    expect(applied?.splice).toEqual({ start: 24, end: 27, inputText: 'the' })
  })

  test('finds a word that moved, and gives up when it is gone', () => {
    const moved = `Now: ${DRAFT}`
    expect(applyChoice(moved, span(DRAFT, 'teh'), 'tea')?.text).toBe(
      'Now: Create a mod that check tea typos',
    )
    expect(
      applyChoice('Create a mod', span(DRAFT, 'teh'), 'the'),
    ).toBeUndefined()
  })

  test('keeps the quotes or the letters around the word it fixes', () => {
    const fix = (text: string, word: string, choice: string): unknown =>
      applyChoice(text, span(text, word), choice)?.text

    expect(fix("says 'Sumbit' now", 'Sumbit', 'Submit')).toBe(
      "says 'Submit' now",
    )
    expect(fix('says ‘Sumbit’ now', 'Sumbit', 'Submit')).toBe(
      'says ‘Submit’ now',
    )
    expect(fix('我想recieve这个文件', 'recieve', 'receive')).toBe(
      '我想receive这个文件',
    )
  })
})

test('the offered word is the one that ends at the cursor and has fixes', () => {
  const text = 'fix teh wiht'
  const teh = span(text, 'teh')
  const wiht = { ...span(text, 'wiht'), choices: [] }

  expect(offeredSpan([teh, wiht], tokenAt(text, 7))).toBe(teh)
  expect(offeredSpan([teh, wiht], tokenAt(text, 12))).toBeUndefined()
  expect(offeredSpan([teh, wiht], tokenAt(text, 3))).toBeUndefined()
})
