import type { ModelCompleteResult } from 'claude-code'

import type { RephraseLimits } from './core/index'

const ENGINE_OP = /^\$\.[\w.]+(?:\([^)]*\))?:? /

export function failureOf(
  reply: ModelCompleteResult,
  limits: RephraseLimits,
): string {
  const cutOff = `Haiku's reply was cut off at ${String(limits.maxTokens)} tokens (the draft may be too long)`
  const isCutOff = reply.usage.output_tokens >= limits.maxTokens
  if (reply.isAnswered) {
    return isCutOff ? cutOff : 'Haiku did not answer with 3 rewrites'
  }
  if (reply.reason === 'api-error') {
    return `Haiku failed (${reply.error})`
  }
  if (reply.reason === 'empty-reply') {
    return isCutOff ? cutOff : 'Haiku sent an empty reply'
  }
  return `Haiku took longer than ${String(limits.timeoutMs / 1000)} s`
}

// Claude Code words a refused call as `<plugin>: $.<op>: <reason>`.
export function reasonOf(error: unknown, plugin: string): string {
  const message = error instanceof Error ? error.message : String(error)
  const rest = message.startsWith(`${plugin}: `)
    ? message.slice(plugin.length + 2)
    : message
  return rest.replace(ENGINE_OP, '')
}
