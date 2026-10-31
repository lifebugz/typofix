import { describe, expect, test } from 'bun:test'

import { maskCode } from '../src/text/mask'

describe('maskCode', () => {
  test('keeps every offset and blanks code, paths, links and names', () => {
    const text =
      'Fix teh `bun tset` in ./src/a.ts, see https://x.io/teh and ~/notes @alice JSON getUser snake_case v2 e.g. teh.'
    const masked = maskCode(text)

    expect(masked).toHaveLength(text.length)
    expect(masked.startsWith('Fix teh ')).toBe(true)
    expect(masked.endsWith(' teh.')).toBe(true)
    for (const hidden of [
      'tset',
      './src',
      'https',
      '~/notes',
      '@alice',
      'JSON',
      'getUser',
      'snake_case',
      'v2',
      'e.g',
    ]) {
      expect(masked.includes(hidden), hidden).toBe(false)
    }
  })

  test('blanks a fenced block, keeps its line breaks, and blanks an unclosed one to the end', () => {
    const text = 'Use this:\n```\nconst teh = 1\n```\nthen teh'
    const masked = maskCode(text)

    expect(masked.split('\n')).toHaveLength(text.split('\n').length)
    expect(masked.includes('const')).toBe(false)
    expect(masked.endsWith('then teh')).toBe(true)
    expect(maskCode('see ```\nteh')).toBe(
      `see ${' '.repeat(3)}\n${' '.repeat(3)}`,
    )
  })
})
