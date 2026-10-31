import { isList, isRecord } from './core/index'

const DEFAULT_FOCUS_KEY = 'ctrl+x tab'
const FOCUS_ACTION = 'abovePrompt:focus'
const FOCUS_CONTEXTS = new Set(['Chat', 'Global'])

export function focusShortcut(json: string | undefined): string {
  if (json === undefined) {
    return DEFAULT_FOCUS_KEY
  }
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return DEFAULT_FOCUS_KEY
  }
  const blocks = isRecord(data) ? data['bindings'] : undefined
  if (!isList(blocks)) {
    return DEFAULT_FOCUS_KEY
  }

  for (const block of blocks) {
    if (!isRecord(block)) {
      continue
    }
    const bindings = block['bindings']
    const context = block['context']
    if (!isRecord(bindings) || typeof context !== 'string') {
      continue
    }
    if (!FOCUS_CONTEXTS.has(context)) {
      continue
    }
    const found = Object.entries(bindings).find(
      ([, action]) => action === FOCUS_ACTION,
    )
    if (found !== undefined) {
      return found[0]
    }
  }
  return DEFAULT_FOCUS_KEY
}
