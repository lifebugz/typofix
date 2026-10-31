import { describe, expect, test } from 'bun:test'

import {
  addToWordList,
  listedWords,
  parseWordList,
  removeFromWordList,
  withoutIgnored,
  wordKey,
  writtenWord,
} from '../src/words/list'
import { span } from './helpers'

describe('word lists', () => {
  const HEADER = ['# my words', '# one a line']

  test('wordKey makes the cuts and spellings of one word the same key', () => {
    const nfd = 'café'.normalize('NFD')
    expect(nfd).not.toBe('café'.normalize('NFC'))
    for (const [a, b] of [
      ['freinds’', 'freinds'],
      ["'freinds'", 'freinds'],
      ['Tovan', 'tovan'],
      ['TOVAN', 'tovan'],
      ['tovan’s', "Tovan's"],
      [nfd, 'café'.normalize('NFC')],
      ['ok,', 'ok'],
      ['‘ok’', 'ok'],
    ]) {
      expect(wordKey(a ?? '')).toBe(wordKey(b ?? ''))
    }
    expect(wordKey('e-mial')).not.toBe(wordKey('mial'))
    expect(wordKey("tovan's")).not.toBe(wordKey('tovan'))
  })

  test('writtenWord keeps the case and inner marks, and drops edge punctuation', () => {
    expect(writtenWord('Tovan’s’')).toBe('Tovan’s')
    expect(writtenWord('(e-mail),')).toBe('e-mail')
    expect(writtenWord('café'.normalize('NFD'))).toBe('café'.normalize('NFC'))
    expect(writtenWord('--')).toBe('')
  })

  test('a list reads one word a line, skips comments and blank lines, and splits a line on spaces', () => {
    const text = [
      '# a comment',
      '',
      'Tovan',
      '  teh  # a typo I like',
      'webhook webhooks',
      'tovan',
      '---',
      '123',
      'ok\r',
      '',
    ].join('\n')
    expect(listedWords(text)).toEqual([
      'Tovan',
      'teh',
      'webhook',
      'webhooks',
      'ok',
    ])
    expect(parseWordList(text)).toEqual(
      new Set(['tovan', 'teh', 'webhook', 'webhooks', 'ok']),
    )
    expect(parseWordList('')).toEqual(new Set())
  })

  test('a file with Windows line ends keeps its comments as comments', () => {
    const text = [
      '# my words',
      'webhook webhooks # api terms',
      '# just a note on teh',
      'foo',
      '',
    ].join('\r\n')
    expect(listedWords(text)).toEqual(['webhook', 'webhooks', 'foo'])
    expect(parseWordList(text).has('teh')).toBe(false)
    expect(removeFromWordList(text, new Set(['webhooks'])).text).toBe(
      '# my words\r\nwebhook # api terms\n# just a note on teh\r\nfoo\r\n',
    )
    expect(addToWordList(text, ['terms'], HEADER).added).toEqual(['terms'])
  })

  test('only spelling issues are taken out, by key', () => {
    const text = 'Tovan go to teh park'
    const spans = [
      span(text, 'Tovan'),
      span(text, 'go', 'grammar'),
      span(text, 'teh'),
    ]
    expect(
      withoutIgnored(spans, new Set(['tovan', 'go'])).map(s => s.original),
    ).toEqual(['go', 'teh'])
  })

  test('a new list starts with its header', () => {
    expect(addToWordList('', ['Tovan', 'teh'], HEADER)).toEqual({
      text: '# my words\n# one a line\nTovan\nteh\n',
      added: ['Tovan', 'teh'],
    })
  })

  test('adding keeps every line there and skips words the list has in any spelling', () => {
    const text = '# mine\nTovan  # a name\nteh'
    expect(
      addToWordList(
        text,
        ['tovan', 'Brevik', 'brevik', '‘wiht’,', '12'],
        HEADER,
      ),
    ).toEqual({
      text: '# mine\nTovan  # a name\nteh\nBrevik\nwiht\n',
      added: ['Brevik', 'wiht'],
    })
    expect(addToWordList(text, ['TEH'], HEADER)).toEqual({ text, added: [] })
  })

  test('removing drops the word in any spelling and keeps the rest of its line', () => {
    const text = '# mine\nTovan\nteh tovan’s # names\nbrevik\n'
    expect(removeFromWordList(text, new Set(['tovan', "tovan's"]))).toEqual({
      text: '# mine\nteh # names\nbrevik\n',
      removed: ['Tovan', 'tovan’s'],
    })
    expect(removeFromWordList(text, new Set(['wiht']))).toEqual({
      text,
      removed: [],
    })
  })
})
