import { describe, expect, test } from 'bun:test'

import {
  diffSplice,
  respan,
  shiftSpans,
  stillMatching,
  tokenAt,
} from '../src/text/spans'
import { DRAFT, span } from './helpers'

describe('shiftSpans', () => {
  const teh = span(DRAFT, 'teh')

  test('moves a span when text goes in before it', () => {
    const text = `Please ${DRAFT}`
    const [moved] = shiftSpans(
      [teh],
      { start: 0, end: 0, inputText: 'Please ' },
      text,
    )

    expect(moved?.start).toBe(text.indexOf('teh'))
  })

  test('keeps a span when a space follows it, and drops it when a letter does', () => {
    const at = teh.end
    expect(
      shiftSpans(
        [teh],
        { start: at, end: at, inputText: ' ' },
        `${DRAFT.slice(0, at)}  ${DRAFT.slice(at + 1)}`,
      ),
    ).toHaveLength(1)
    expect(
      shiftSpans(
        [teh],
        { start: at, end: at, inputText: 'n' },
        `${DRAFT.slice(0, at)}n${DRAFT.slice(at)}`,
      ),
    ).toHaveLength(0)
  })

  test('drops a span the edit touches, or that a deletion joins to the next word', () => {
    expect(
      shiftSpans(
        [teh],
        { start: teh.start + 1, end: teh.start + 2, inputText: '' },
        'x',
      ),
    ).toHaveLength(0)
    const joined = DRAFT.slice(0, teh.end) + DRAFT.slice(teh.end + 1)
    expect(
      shiftSpans(
        [teh],
        { start: teh.end, end: teh.end + 1, inputText: '' },
        joined,
      ),
    ).toHaveLength(0)
  })

  const kept = (text: string, word: string): number =>
    shiftSpans(
      [span(text, word)],
      { start: text.length, end: text.length, inputText: ' ok' },
      `${text} ok`,
    ).length

  test('keeps a word in quotes, or between Chinese or Japanese letters', () => {
    expect(kept("the button says 'Sumbit' and the form", 'Sumbit')).toBe(1)
    expect(kept('the button says ‘Sumbit’ and the form', 'Sumbit')).toBe(1)
    expect(kept('我想recieve这个文件 and more', 'recieve')).toBe(1)
    expect(kept('この関数はrecieveを呼ぶ and more', 'recieve')).toBe(1)
    const accented = `recieve${String.fromCodePoint(0x301)}`
    expect(kept(`我想${accented}这个文件 and more`, accented)).toBe(1)
  })

  test('keeps a quoted word when the closing quote touches Japanese letters, and drops a word an unclosed quote starts', () => {
    expect(kept("use the 'Sumbit'ボタン here", 'Sumbit')).toBe(1)
    expect(kept("please press the 'Sumbit", 'Sumbit')).toBe(0)
  })

  test('reads a listed elision only as a whole word', () => {
    expect(kept("'Tis the 'Sumbit' button", 'Sumbit')).toBe(1)
    expect(kept("the 'em' tag and the 'Sumbit' button", 'Sumbit')).toBe(1)
    expect(kept("the 'Emti' event fires twice", 'Emti')).toBe(1)
    expect(kept("the 'tisue' sample is here", 'tisue')).toBe(1)
    expect(kept("use 'round robni' scheduling", 'robni')).toBe(1)
    expect(kept("the 'Sign in' and 'Lgo out' buttons", 'Lgo')).toBe(1)
  })

  test('drops a part of a word that a digit or an underscore joins to', () => {
    expect(kept('call recieve2 now', 'recieve')).toBe(0)
    expect(kept('my_recieve here', 'recieve')).toBe(0)
  })

  test('drops a part of a word that an apostrophe joins to more letters', () => {
    expect(kept("look at Sumbit's label", 'Sumbit')).toBe(0)
    expect(kept("je pense que l'adrresse est", 'adrresse')).toBe(0)
    expect(kept('je pense que l’adrresse est', 'adrresse')).toBe(0)
  })
})

describe('diffSplice', () => {
  test('finds the one changed run between two drafts', () => {
    expect(diffSplice('fix teh typo', 'fix tech typo')).toEqual({
      start: 6,
      end: 6,
      inputText: 'c',
    })
    expect(diffSplice('', 'new draft')).toEqual({
      start: 0,
      end: 0,
      inputText: 'new draft',
    })
    expect(diffSplice('aaa', 'aa')).toEqual({ start: 2, end: 3, inputText: '' })
  })

  test('feeds shiftSpans so a fix taken from the typeahead drops its span only', () => {
    const text = 'fix teh bug wiht tests'
    const before = [span(text, 'teh'), span(text, 'wiht')]
    const after = 'fix the bug wiht tests'
    const kept = shiftSpans(before, diffSplice(text, after), after)

    expect(kept.map(s => [s.original, s.start])).toEqual([
      ['wiht', after.indexOf('wiht')],
    ])
  })
})

describe('tokenAt', () => {
  test('is the run of non-space text that ends at the cursor', () => {
    expect(tokenAt('fix teh, now', 8)).toEqual({
      token: 'teh,',
      start: 4,
      cursor: 8,
    })
    expect(tokenAt('fix teh ', 8)).toEqual({ token: '', start: 8, cursor: 8 })
    expect(tokenAt('teh', 3)).toEqual({ token: 'teh', start: 0, cursor: 3 })
  })

  test('stays fast with a long run of text with no spaces before the cursor', () => {
    const run = 'x'.repeat(100_000)
    const text = `${run} fix teh`
    const startedAt = Date.now()
    const after = tokenAt(text, text.length)
    const inside = tokenAt(run, run.length)
    const elapsedMs = Date.now() - startedAt

    expect(after).toEqual({
      token: 'teh',
      start: text.length - 3,
      cursor: text.length,
    })
    expect(inside).toEqual({ token: run, start: 0, cursor: run.length })
    expect(elapsedMs).toBeLessThan(50)
  })
})

describe('stillMatching', () => {
  test('keeps the spans whose text is still in place', () => {
    const before = 'fix teh bug wiht tests'
    const teh = span(before, 'teh')
    const wiht = span(before, 'wiht')
    expect(stillMatching([teh, wiht], 'fix tea bug wiht tests')).toEqual([wiht])
  })
})

describe('respan', () => {
  test('moves the spans across the one change between two drafts', () => {
    const before = 'fix teh bug wiht tests'
    const after = 'so fix the bug wiht tests'
    const moved = respan(
      [span(before, 'teh'), span(before, 'wiht')],
      before,
      after,
    )
    expect(moved.map(s => [s.original, s.start])).toEqual([
      ['wiht', after.indexOf('wiht')],
    ])
  })
})
