import { expect, test } from 'claude-code/testing'

import type { Rephrase, TypoIssue } from '../hooks/core/index'
import type {
  Rephrase as StateRephrase,
  TypoIssue as StateIssue,
} from '../types'

// types/index.d.ts must stay self-contained, so it repeats these core shapes.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

test('the plugin state holds the same shapes core works with', () => {
  const issue: Same<StateIssue, TypoIssue> = true
  const rephrase: Same<StateRephrase, Rephrase> = true
  expect([issue, rephrase]).toEqual([true, true])
})
