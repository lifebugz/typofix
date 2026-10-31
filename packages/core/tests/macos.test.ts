import { describe, expect, test } from 'bun:test'

import { parseMacResult } from '../src/checkers/macos'
import { DRAFT, span } from './helpers'

describe('parseMacResult', () => {
  test('reads the script output against the draft, with the language guess', () => {
    const json = JSON.stringify({
      language: 'en',
      confidence: 0.51,
      issues: [
        {
          start: 24,
          end: 27,
          kind: 'spelling',
          choices: ['the', 'tech', 'tea', 'tee'],
        },
      ],
    })

    expect(parseMacResult(json, DRAFT)).toEqual({
      spans: [span(DRAFT, 'teh')],
      guess: { language: 'en', confidence: 0.51 },
    })
  })

  test('drops entries out of range or of an unknown kind, and duplicate or unchanged choices', () => {
    const json = JSON.stringify({
      issues: [
        { start: 30, end: 99, kind: 'spelling', choices: ['x'] },
        { start: 0, end: 6, kind: 'style', choices: ['x'] },
        { start: 2.5, end: 6, kind: 'spelling', choices: ['x'] },
        {
          start: 18,
          end: 23,
          kind: 'grammar',
          choices: ['checks', 'check', 'checks', 7],
        },
      ],
    })

    expect(parseMacResult(json, DRAFT)?.spans).toEqual([
      {
        id: 'grammar:18:check',
        original: 'check',
        choices: ['checks'],
        kind: 'grammar',
        start: 18,
        end: 23,
      },
    ])
  })

  test('keeps no guess when the language or the confidence is missing or malformed', () => {
    for (const guess of [
      {},
      { language: 'de' },
      { confidence: 0.99 },
      { language: '', confidence: 0.99 },
      { language: 'de', confidence: '0.99' },
      { language: 7, confidence: 0.99 },
    ]) {
      const checked = parseMacResult(
        JSON.stringify({ ...guess, issues: [] }),
        DRAFT,
      )
      expect(checked, JSON.stringify(guess)).toEqual({ spans: [] })
    }
  })

  const macSpans = (
    text: string,
    start: number,
    end: number,
    choices: readonly string[],
  ): unknown[] =>
    (
      parseMacResult(
        JSON.stringify({ issues: [{ start, end, kind: 'spelling', choices }] }),
        text,
      )?.spans ?? []
    ).map(s => [s.original, s.start, s.choices])

  test('takes in an apostrophe that belongs to the word, and keeps it on a plural fix', () => {
    expect(
      macSpans("stop talkin' and start", 5, 11, ['talking', 'takin']),
    ).toEqual([["talkin'", 5, ['talking', 'takin']]])
    expect(macSpans('I dont’ see the logs', 2, 6, ["don't", 'done'])).toEqual([
      ['dont’', 2, ["don't", 'done']],
    ])
    expect(
      macSpans('the freinds’ house is big', 4, 11, ['friends', "friend's"]),
    ).toEqual([['freinds’', 4, ['friends’', "friend's"]]])
  })

  test('keeps a word in a quote or a quoted phrase, and drops one after a quote that never closes', () => {
    expect(macSpans("the 'Save and clsoe' label", 14, 19, ['close'])).toEqual([
      ['clsoe', 14, ['close']],
    ])
    expect(macSpans("use the 'Sumbit'ボタン here", 9, 15, ['Submit'])).toEqual([
      ['Sumbit', 9, ['Submit']],
    ])
    expect(macSpans("please press the 'Sumbit", 18, 24, ['Submit'])).toEqual([])
  })

  test('keeps a word in a quote that starts with a symbol, such as a path or a mention', () => {
    expect(
      macSpans("the dialog says '@admin must aprove'", 29, 35, ['approve']),
    ).toEqual([['aprove', 29, ['approve']]])
    expect(
      macSpans("the log says '/tmp/cache is mising'", 28, 34, ['missing']),
    ).toEqual([['mising', 28, ['missing']]])
  })

  test('pairs a quote across a line break, but not across a blank line', () => {
    expect(
      macSpans("the hint says 'run it\nagian' now", 22, 27, ['again']),
    ).toEqual([['agian', 22, ['again']]])
    expect(
      macSpans("the hint says 'run it\n\nagian' now", 23, 28, ['again']),
    ).toEqual([["agian'", 23, ['again']]])
  })

  test('never opens a quote with an elision such as ’tis or ’em', () => {
    expect(macSpans("'tis the 'Sumbit' button", 10, 16, ['Submit'])).toEqual([
      ['Sumbit', 10, ['Submit']],
    ])
    expect(
      macSpans("send 'em to the uesrs' inbox", 16, 21, ['users', "user's"]),
    ).toEqual([["uesrs'", 16, ["users'", "user's"]]])
  })

  test('leaves the apostrophes inside code out of the quote pairing', () => {
    expect(
      macSpans("use `split(' ')` and click 'Sumbit' now", 28, 34, ['Submit']),
    ).toEqual([['Sumbit', 28, ['Submit']]])
    expect(
      macSpans("the status line shows '`main` is ahaed'", 33, 38, ['ahead']),
    ).toEqual([['ahaed', 33, ['ahead']]])
  })

  test('answers undefined for output with no list of issues', () => {
    expect(parseMacResult('oops', DRAFT)).toBeUndefined()
    expect(parseMacResult('[]', DRAFT)).toBeUndefined()
    expect(parseMacResult('{"language": "en"}', DRAFT)).toBeUndefined()
    expect(parseMacResult('{"issues": {}}', DRAFT)).toBeUndefined()
  })
})
