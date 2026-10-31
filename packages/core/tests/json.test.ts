import { describe, expect, test } from 'bun:test'

import { stringsIn } from '../src/json'

describe('stringsIn', () => {
  test('keeps the strings of a list, in order', () => {
    expect(stringsIn(['Tovan', 3, null, 'gonna', ['x']])).toEqual([
      'Tovan',
      'gonna',
    ])
  })

  test('is empty for anything that is not a list', () => {
    expect(stringsIn(undefined)).toEqual([])
    expect(stringsIn('Tovan')).toEqual([])
    expect(stringsIn({ 0: 'Tovan' })).toEqual([])
  })
})
