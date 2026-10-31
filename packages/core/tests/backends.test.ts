import { describe, expect, test } from 'bun:test'

import {
  BACKENDS,
  checkerInput,
  chooseCandidates,
  isRefusedRun,
  type Backend,
} from '../src/checkers/backends'

const named = (name: string): Backend => {
  const found = BACKENDS.find(backend => backend.name === name)
  if (found === undefined) {
    throw new Error(`no backend ${name}`)
  }
  return found
}

describe('chooseCandidates', () => {
  const own: Backend = {
    name: 'own',
    argv: () => ['own'],
    input: text => text,
    parse: () => undefined,
  }

  test('tries every backend until one is chosen, then only that one', () => {
    expect(chooseCandidates(undefined)).toBe(BACKENDS)
    expect(chooseCandidates(own)).toEqual([own])
  })

  test('tries none once every backend was missing', () => {
    expect(chooseCandidates(null)).toEqual([])
  })
})

describe('checkerInput', () => {
  test('masks code before the backend shapes the input', () => {
    const blank = ' '.repeat(5)
    expect(checkerInput(named('osascript'), 'fix `teh` now')).toBe(
      `fix ${blank} now`,
    )
    expect(checkerInput(named('hunspell'), 'fix `teh`\nnow')).toBe(
      `^fix ${blank}\n^now\n`,
    )
  })
})

describe('isRefusedRun', () => {
  test('is a failed exit that printed nothing', () => {
    expect(isRefusedRun(1, '')).toBe(true)
    expect(isRefusedRun(127, ' \n')).toBe(true)
  })

  test('is not a clean exit, or a failed exit that printed a result', () => {
    expect(isRefusedRun(0, '')).toBe(false)
    expect(isRefusedRun(1, '{"issues": []}')).toBe(false)
  })
})
