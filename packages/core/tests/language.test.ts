import { describe, expect, test } from 'bun:test'

import {
  hunspellDictionary,
  isDictionaryLanguage,
  mergeSpans,
} from '../src/checkers/language'
import { span } from './helpers'

describe('isDictionaryLanguage', () => {
  test('the language option decides when it is set', () => {
    const sure = { language: 'en', confidence: 0.99 }
    expect(isDictionaryLanguage('en_US', 'de', sure)).toBe(false)
    expect(isDictionaryLanguage('en_US', 'en', undefined)).toBe(true)
    expect(isDictionaryLanguage('en_US', 'en_GB', undefined)).toBe(true)
  })

  test('without the option, only a sure guess in another language skips the dictionary', () => {
    expect(
      isDictionaryLanguage('en_US', '', { language: 'de', confidence: 0.99 }),
    ).toBe(false)
    expect(
      isDictionaryLanguage('en_US', '', { language: 'en', confidence: 0.99 }),
    ).toBe(true)
    expect(
      isDictionaryLanguage('en_US', '', { language: 'id', confidence: 0.51 }),
    ).toBe(true)
    expect(
      isDictionaryLanguage('en_US', '', { language: 'de', confidence: 0.9 }),
    ).toBe(false)
  })

  test('an unknown language keeps the dictionary', () => {
    expect(isDictionaryLanguage('en_US', '', undefined)).toBe(true)
  })

  test('compares base codes, so en_GB, en-GB and en match', () => {
    expect(
      isDictionaryLanguage('en_GB', '', { language: 'en', confidence: 0.99 }),
    ).toBe(true)
    expect(isDictionaryLanguage('en-GB', 'EN_us', undefined)).toBe(true)
    expect(
      isDictionaryLanguage('de_DE', '', { language: 'en', confidence: 0.99 }),
    ).toBe(false)
  })
})

describe('hunspellDictionary', () => {
  test('takes a plain dictionary name from the option', () => {
    expect(hunspellDictionary('en_US')).toBe('en_US')
    expect(hunspellDictionary(' en_GB ')).toBe('en_GB')
  })

  test('is off for an empty option, a path, or a value that is not a string', () => {
    expect(hunspellDictionary('')).toBeUndefined()
    expect(hunspellDictionary('../../etc/passwd')).toBeUndefined()
    expect(hunspellDictionary(true)).toBeUndefined()
    expect(hunspellDictionary(undefined)).toBeUndefined()
  })

  test('is off for the word off or none, in any case', () => {
    expect(hunspellDictionary('off')).toBeUndefined()
    expect(hunspellDictionary('OFF')).toBeUndefined()
    expect(hunspellDictionary(' none ')).toBeUndefined()
    expect(hunspellDictionary('en_US')).toBe('en_US')
  })
})

describe('mergeSpans', () => {
  const text = 'whaat do youu say λάθοςς'

  test('adds Latin words the first checker missed, sorted by position', () => {
    const merged = mergeSpans(
      [span(text, 'youu')],
      [span(text, 'whaat'), span(text, 'youu')],
    )
    expect(merged.map(s => s.original)).toEqual(['whaat', 'youu'])
  })

  test('never adds a word in another script', () => {
    expect(mergeSpans([], [span(text, 'λάθοςς')])).toEqual([])
  })
})
