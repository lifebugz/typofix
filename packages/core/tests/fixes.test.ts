import { describe, expect, test } from 'bun:test'

import {
  applyChoice,
  isNewList,
  offeredAtCursor,
  offeredSpan,
  planChoice,
  spanSignature,
} from '../src/fixes'
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

describe('offeredAtCursor', () => {
  test('is the span with fixes that ends at the cursor', () => {
    const text = 'fix teh wiht'
    const teh = span(text, 'teh')
    expect(offeredAtCursor([teh], text, 7)).toBe(teh)
    expect(offeredAtCursor([teh], text, 3)).toBeUndefined()
  })
})

describe('spanSignature', () => {
  test('reads the kind, the word in lower case and the fixes', () => {
    expect(spanSignature([span(DRAFT, 'teh')])).toBe(
      'spelling:teh>the|tech|tea',
    )
  })

  test('ignores where a word stands', () => {
    const moved = span(`so ${DRAFT}`, 'teh')
    expect(spanSignature([moved])).toBe(spanSignature([span(DRAFT, 'teh')]))
  })
})

describe('isNewList', () => {
  const teh = span(DRAFT, 'teh')
  const check = span(DRAFT, 'check', 'grammar')

  test('is false while nothing is hidden, or for the hidden list itself', () => {
    expect(isNewList(undefined, [teh])).toBe(false)
    expect(isNewList(spanSignature([teh]), [teh])).toBe(false)
  })

  test('is true once the list differs from the hidden one', () => {
    expect(isNewList(spanSignature([teh]), [teh, check])).toBe(true)
  })
})

describe('planChoice', () => {
  const text = 'fix teh bug wiht tests'
  const teh = span(text, 'teh')
  const wiht = span(text, 'wiht')

  test('is gone when no span has the id', () => {
    expect(planChoice([teh, wiht], 'spelling:0:nope', text, 'the')).toEqual({
      kind: 'gone',
    })
  })

  test('is moved, with the other spans, when the word left the draft', () => {
    expect(
      planChoice([teh, wiht], teh.id, 'fix tea bug wiht tests', 'the'),
    ).toEqual({ kind: 'moved', rest: [wiht] })
  })

  test('is applied, with the new draft and the other spans moved', () => {
    const fixed = planChoice([teh, wiht], wiht.id, text, 'with')
    expect(fixed).toEqual({
      kind: 'applied',
      text: 'fix teh bug with tests',
      spans: [teh],
    })
  })
})
