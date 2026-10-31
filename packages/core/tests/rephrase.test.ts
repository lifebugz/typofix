import { describe, expect, test } from 'bun:test'

import { buildRewriteRequest, parseRewriteReply } from '../src/rephrase'

describe('rewrites', () => {
  test('sends the draft inside tags', () => {
    expect(buildRewriteRequest('He go').prompt).toBe('<draft>\nHe go\n</draft>')
  })

  test('reads three rewrites, also from a fenced reply', () => {
    const reply =
      '```json\n{"rewrites": [" He goes. ", "He is going.", "He goes."]}\n```'
    expect(parseRewriteReply(reply)).toEqual([
      'He goes.',
      'He is going.',
      'He goes.',
    ])
  })

  test('refuses a reply with the wrong count, an empty rewrite, or no JSON', () => {
    expect(parseRewriteReply('{"rewrites": ["a", "b"]}')).toBeUndefined()
    expect(parseRewriteReply('{"rewrites": ["a", " ", "c"]}')).toBeUndefined()
    expect(parseRewriteReply('Sure! Here you go.')).toBeUndefined()
  })
})
