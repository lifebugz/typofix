import { describe, expect, test } from 'bun:test'

import { parseIspell, toIspellInput } from '../src/checkers/ispell'
import { applyChoice } from '../src/fixes'

describe('ispell fallback', () => {
  const text = 'café über teh\n\nsecond line wiht a typo'
  const hunspell = [
    '@(#) International Ispell Version 3.2.06 (but really Hunspell 1.7.5)',
    '& café 2 1: cafe, caff',
    '& über 1 7: beer',
    '& teh 10 13: the, eh, tech, tee, tea, ten, tel, ted, meh, t eh',
    '',
    '',
    '*',
    '*',
    '& wiht 6 13: whit, with, wit, wight, wist, wilt',
    '*',
    '*',
    '',
    '',
  ].join('\n')

  test('prefixes every line so no line reads as a command', () => {
    expect(toIspellInput('a\n*b')).toBe('^a\n^*b\n')
  })

  test('turns byte offsets that count the ^ prefix into string indexes', () => {
    const spans = parseIspell(hunspell, text)

    expect(spans.map(s => [s.original, s.start])).toEqual([
      ['café', text.indexOf('café')],
      ['über', text.indexOf('über')],
      ['teh', text.indexOf('teh')],
      ['wiht', text.indexOf('wiht')],
    ])
    expect(spans[2]?.choices).toEqual(['the', 'eh', 'tech'])
  })

  test('finds the word near a character offset too', () => {
    const spans = parseIspell(
      '@(#) enchant\n& teh 1 11: the\n# zzq 15\n',
      'café über teh zzq',
    )

    expect(spans.map(s => [s.original, s.start, s.choices])).toEqual([
      ['teh', 10, ['the']],
      ['zzq', 14, []],
    ])
  })

  const read = (output: string, line: string): unknown[] =>
    parseIspell(`@(#) Hunspell\n${output}\n\n`, line).map(s => [
      s.original,
      s.start,
      s.choices,
    ])
  const fixFirst = (output: string, line: string): string | undefined => {
    const [found] = parseIspell(`@(#) Hunspell\n${output}\n\n`, line)
    const choice = found?.choices[0]
    return found === undefined || choice === undefined
      ? undefined
      : applyChoice(line, found, choice)?.text
  }

  test('finds a word in quotes, and trims a quote hunspell keeps on the word', () => {
    expect(
      read(
        '& Sumbit 4 18: Submit, Summit',
        "the button says 'Sumbit' and the form",
      ),
    ).toEqual([['Sumbit', 17, ['Submit', 'Summit']]])
    expect(
      read('& Sumbit’ 1 20: Summit', 'the button says ‘Sumbit’ and the form'),
    ).toEqual([['Sumbit', 17, ['Summit']]])
    expect(read("& ’Sumbit’ 1 5: habit's", 'the ’Sumbit’ button')).toEqual([
      ['Sumbit', 5, ["habit's"]],
    ])
    expect(
      read("& Sumbit's 4 9: Summit's, Suit's", "look at Sumbit's label"),
    ).toEqual([["Sumbit's", 8, ["Summit's", "Suit's"]]])
  })

  test('drops a word whose only fault is the quote hunspell keeps on it', () => {
    expect(
      read('& Cancel’ 2 8: Cancel, Cancels', 'the ‘Cancel’ button'),
    ).toEqual([])
    expect(
      read("& users’ 3 12: user's, users, user", 'it’s the users’ files'),
    ).toEqual([])
    expect(
      read("& don’t’ 2 12: don't, doesn't", 'he said ‘don’t’ there'),
    ).toEqual([])
    expect(
      read(
        "& cant’ 5 8: can't, cant, cant's, cants, canto",
        'the ‘cant’ of politics is old',
      ),
    ).toEqual([])
  })

  test('keeps an apostrophe that belongs to the word, so a fix leaves none behind', () => {
    expect(fixFirst('& goin’ 1 7: going', 'I was goin’ home')).toBe(
      'I was going home',
    )
    expect(fixFirst("& freinds’ 1 5: friend's", 'the freinds’ house')).toBe(
      "the friend's house",
    )
    expect(
      fixFirst("& freinds’ 1 12: friend's", '’tis the freinds’ house'),
    ).toBe("’tis the friend's house")
    expect(
      fixFirst(
        "& cant’ 5 3: can't, cant, cant's, cants, canto",
        'I cant’ see the logs',
      ),
    ).toBe("I can't see the logs")
  })

  test('reads a typo on the second line of a draft', () => {
    expect(
      read('\n& agian 2 1: again, avian', "the hint says 'run it\nagian'"),
    ).toEqual([['agian', 22, ['again', 'avian']]])
  })

  test('reads a typo at the end of a quoted phrase, and keeps the quote', () => {
    expect(read('& clsoe 1 15: close', "the 'Save and clsoe' label")).toEqual([
      ['clsoe', 14, ['close']],
    ])
    expect(read('& clsoe’ 1 17: close', 'the ‘Save and clsoe’ label')).toEqual([
      ['clsoe', 14, ['close']],
    ])
  })

  test('skips a one-letter word, and a word hunspell glued to another script', () => {
    expect(read("& ’n’ 1 6: don't", 'rock ’n’ roll is fun')).toEqual([])
    expect(read("& ’y’ 1 7: sec'y", 'press ’y’ to go on')).toEqual([])
    expect(
      read("& Submit'ボタン 1 10: Submitting", "use the 'Submit'ボタン here"),
    ).toEqual([])
    expect(
      read('& button日本 1 5: button', 'the button日本 is broken'),
    ).toEqual([])
  })

  test('skips an elision, and a word hunspell read without an apostrophe that belongs to it', () => {
    expect(
      read('& goin 11 1: goon, gin, groin, going', "goin' home now"),
    ).toEqual([])
    expect(read('& tis 1 2: tees', "'tis the season")).toEqual([])
    expect(read('& tis 1 2: tees', "'tis the 'Save' button")).toEqual([])
    expect(
      read('& ello 5 2: ell, cello, hello, ells, ell o', "'ello there mate"),
    ).toEqual([])
    expect(
      read("& ’tis 4 5: it's, ti's, Otis, isn't", 'get ’tis done'),
    ).toEqual([])
  })
})
