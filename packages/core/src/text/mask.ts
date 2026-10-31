const CODE_SPANS = [/```[\s\S]*?(?:```|$)/g, /`[^`\n]*`/g]

const MASKED_REGIONS = [
  ...CODE_SPANS,
  /\b[a-z][a-z\d+.-]*:\/\/\S+/gi,
  /(?<!\S)(?:~|\.{1,2})?\/\S*/g,
  /(?<!\S)@\S+/g,
]

const TOKEN = /\S+/g
const EDGE_PUNCTUATION = /^([^\p{L}\p{N}_@~]*)(.*?)[^\p{L}\p{N}_@~]*$/u
const CODE_LIKE = /[_./@\d]|\p{Ll}\p{Lu}/u
const PLURAL_CAPS = /^\p{Lu}{2,}s$/u

export function maskCode(text: string): string {
  const units = fillRegions(text, 'masked', ' ').split('')
  for (const match of text.matchAll(TOKEN)) {
    const parts = EDGE_PUNCTUATION.exec(match[0])
    const lead = parts?.[1] ?? ''
    const core = parts?.[2] ?? ''
    if (isCodeLike(core)) {
      const start = match.index + lead.length
      units.fill(' ', start, start + core.length)
    }
  }
  return units.join('')
}

export function fillRegions(
  text: string,
  regions: 'code' | 'masked',
  fill: string,
): string {
  const units = text.split('')
  for (const pattern of regions === 'code' ? CODE_SPANS : MASKED_REGIONS) {
    for (const match of text.matchAll(pattern)) {
      for (let i = match.index; i < match.index + match[0].length; i++) {
        if (units[i] !== '\n') {
          units[i] = fill
        }
      }
    }
  }
  return units.join('')
}

function isCodeLike(word: string): boolean {
  if (word.length < 2) {
    return false
  }
  const isAllCaps = word === word.toUpperCase() && word !== word.toLowerCase()
  return isAllCaps || PLURAL_CAPS.test(word) || CODE_LIKE.test(word)
}
