import { describe, expect, test } from 'bun:test'

import {
  addReport,
  askedWords,
  notShipped,
  parseWordsArgs,
  removeReport,
} from '../src/words/command'
import {
  addToWordList,
  listedWords,
  mergeWordKeys,
  parseWordList,
  PROJECT_WORDS_HEADER,
  removeFromWordList,
  USER_WORDS_HEADER,
  withoutIgnored,
  withoutWord,
  wordKey,
  wordListHeader,
  writtenWord,
} from '../src/words/list'
import { DRAFT, span } from './helpers'

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

describe('word list steps', () => {
  test('withoutWord drops the spelling spans of one word in any case', () => {
    const teh = span(DRAFT, 'teh')
    const check = span(DRAFT, 'check', 'grammar')
    expect(withoutWord([teh, check], 'Teh')).toEqual([check])
  })

  test('mergeWordKeys joins the lists and the keys of loose words', () => {
    expect(
      mergeWordKeys([new Set(['tovan']), new Set(['gonna'])], ['Kubectl']),
    ).toEqual(new Set(['tovan', 'gonna', 'kubectl']))
  })

  test('wordListHeader is the header of each level', () => {
    expect(wordListHeader('user')).toBe(USER_WORDS_HEADER)
    expect(wordListHeader('project')).toBe(PROJECT_WORDS_HEADER)
  })
})

describe('parseWordsArgs', () => {
  test('lists with no arguments', () => {
    expect(parseWordsArgs('')).toEqual({ kind: 'list' })
    expect(parseWordsArgs('  ')).toEqual({ kind: 'list' })
  })

  test('adds for the user, shares for the project, and removes', () => {
    expect(parseWordsArgs('add Tovan gonna')).toEqual({
      kind: 'add',
      level: 'user',
      words: ['Tovan', 'gonna'],
    })
    expect(parseWordsArgs('share Tovan')).toEqual({
      kind: 'add',
      level: 'project',
      words: ['Tovan'],
    })
    expect(parseWordsArgs(' remove  Tovan ')).toEqual({
      kind: 'remove',
      words: ['Tovan'],
    })
  })

  test('answers usage for an unknown action, or an edit with no words', () => {
    for (const args of ['what', 'add', 'list Tovan', 'what #tag']) {
      expect(parseWordsArgs(args), args).toEqual({ kind: 'usage' })
    }
  })

  test('names the arguments that do not read back as one word', () => {
    expect(parseWordsArgs('add #tag a#b ok 42')).toEqual({
      kind: 'notWords',
      words: ['#tag', 'a#b', '42'],
    })
  })
})

describe('word command reports', () => {
  const shipped = new Set(['kubectl'])

  test('askedWords reads each word once, without edge punctuation', () => {
    expect(askedWords(['Tovan', 'tovan', 'gonna,'])).toEqual(['Tovan', 'gonna'])
  })

  test('notShipped leaves out the words typofix ships', () => {
    expect(notShipped(['Tovan', 'Kubectl'], shipped)).toEqual(['Tovan'])
  })

  test('addReport says what was added, what was there, and what ships', () => {
    expect(
      addReport({
        level: 'project',
        path: '/p/words.txt',
        asked: ['Tovan', 'gonna', 'kubectl'],
        added: ['Tovan'],
        shipped,
      }),
    ).toBe(
      [
        'added Tovan to /p/words.txt',
        'Commit the file to share it.',
        'already in /p/words.txt: gonna',
        'kubectl ships with typofix',
      ].join('\n'),
    )
    expect(
      addReport({
        level: 'user',
        path: '/u/words.txt',
        asked: ['kubectl'],
        added: [],
        shipped,
      }),
    ).toBe('kubectl ships with typofix')
  })

  test('removeReport reports each file, and names missing words only when no file failed', () => {
    expect(
      removeReport(
        [
          { path: '/u/words.txt', removed: ['Tovan'] },
          { path: '/p/words.txt', removed: [], error: 'permission denied' },
        ],
        ['Tovan', 'gonna', 'kubectl'],
        shipped,
      ),
    ).toBe(
      [
        'removed Tovan from /u/words.txt',
        'could not change /p/words.txt: permission denied',
        'kubectl ships with typofix, so it stays ignored',
      ].join('\n'),
    )
    expect(
      removeReport([{ path: '/u/words.txt', removed: [] }], ['gonna'], shipped),
    ).toBe('not in your lists: gonna')
  })
})
