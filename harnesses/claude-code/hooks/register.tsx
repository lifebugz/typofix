import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  ModelCompleteResult,
  ProcessRunResult,
  Register,
  Timer,
} from 'claude-code'

import {
  addReport,
  addToWordList,
  askedWords,
  buildRewriteRequest,
  CHECK_DELAY_MS,
  checkerInput,
  chooseCandidates,
  describeGuess,
  describeList,
  diffSplice,
  extraBackend,
  formatRewrites,
  hunspellDictionary,
  IDLE,
  isDictionaryLanguage,
  isNewList,
  isRefusedRun,
  isSpellServerTimeout,
  keptAfterServerTimeout,
  listedWords,
  MAX_HUNSPELL_MISSES,
  mergeSpans,
  mergeWordKeys,
  notShipped,
  offeredAtCursor,
  parseRewriteReply,
  parseWordList,
  parseWordsArgs,
  planChoice,
  removeFromWordList,
  removeReport,
  rephraseLimits,
  respan,
  REWRITE_LABELS,
  scriptWarning,
  shiftSpans,
  SHIPPED_WORDS_FILE,
  spanSignature,
  SPELL_TIMEOUT_MS,
  stillMatching,
  stringsIn,
  toIssue,
  USER_WORDS_HEADER,
  withoutIgnored,
  withoutWord,
  wordKey,
  wordListHeader,
  WORDS_FILE,
  type Backend,
  type Checked,
  type Rephrase,
  type RephraseLimits,
  type RephraseOutcome,
  type Span,
  type Splice,
  type WordFileEdit,
  type WordLevel,
} from './core/index'
import { focusShortcut } from './keybindings'
import { decorationsFor, fixLetter, typeaheadRows } from './render'
import { failureOf, isRefusal, reasonOf } from './results'

type RephraseFrom = 'band' | 'command'

interface Live {
  language: string
  shortcut: string
  hunspell: string | undefined
  draftText: string
  checkedText: string | undefined
  spans: readonly Span[]
  isOffering: boolean
  isShell: boolean
  canPaint: boolean | undefined
  hiddenFor: string | undefined
  checkTimer: Timer | undefined
  backend: Backend | null | undefined
  knownPrograms: Set<string>
  hunspellMisses: number
  hasWarned: boolean
  rephrase: Rephrase['status']
  rephraseFrom: RephraseFrom
  rephraseSource: string
  rephraseStop: AbortController | undefined
  isPanelHost: boolean
  isPanelAttached: boolean
  hasEdits: boolean
  isReading: boolean
  pollTimer: Timer | undefined
  shippedKeys: ReadonlySet<string> | undefined
  wordEdits: Promise<unknown>
}

// The VS Code panel raises no prompt.edit, so its draft is read on a timer.
const PANEL_ENTRYPOINT = 'claude-vscode'
const PANEL_POLL_MS = 300
// The extension answers an empty box after 4.5 s when the panel is silent.
const PANEL_SILENT_MS = 4000
const TIMER_SLACK_MS = 500
const TYPEAHEAD_WAIT_MS = 2000
const TYPEAHEAD_POLL_MS = 100
const MAX_LISTED = 8
// Where ignored words were kept before the word lists; read until moved.
const IGNORED_KEY = 'ignored'
const MISSING_FILE = /\bENOENT\b/
const WORDS_USAGE = [
  'usage: /typo-words                  list the words typofix never lists as typos',
  '       /typo-words add <word…>      for you, in all your projects',
  '       /typo-words share <word…>    for everyone in this project',
  '       /typo-words remove <word…>   from both lists',
].join('\n')
const NO_BACKEND =
  'no spell checker or dictionary found (Linux: install enchant-2 or hunspell and a dictionary such as en_US). /rephrase still works.'
const NO_PAINT =
  'typofix needs Claude Code 2.1.316 or later for underlines; the band still works.'
// The hint line under the box in shell mode; vim mode puts `-- INSERT -- ` first.
const SHELL_HINT = '! for shell mode'

const issues = atom({ plugin: 'typofix', key: 'issues' } as const, [])
const isHidden = atom({ plugin: 'typofix', key: 'isHidden' } as const, false)
const isOffering = atom(
  { plugin: 'typofix', key: 'isOffering' } as const,
  false,
)
const rephrase = atom({ plugin: 'typofix', key: 'rephrase' } as const, IDLE)

const live: Live = {
  language: '',
  shortcut: focusShortcut(undefined),
  hunspell: undefined,
  draftText: '',
  checkedText: undefined,
  spans: [],
  isOffering: false,
  isShell: false,
  canPaint: undefined,
  hiddenFor: undefined,
  checkTimer: undefined,
  backend: undefined,
  knownPrograms: new Set(),
  hunspellMisses: 0,
  hasWarned: false,
  rephrase: 'idle',
  rephraseFrom: 'band',
  rephraseSource: '',
  rephraseStop: undefined,
  isPanelHost: false,
  isPanelAttached: false,
  hasEdits: false,
  isReading: false,
  pollTimer: undefined,
  shippedKeys: undefined,
  wordEdits: Promise.resolve(),
}

function isPanel(): boolean {
  return live.isPanelAttached && !live.hasEdits
}

function forgetDraft(): void {
  live.checkTimer?.cancel()
  live.checkTimer = undefined
  live.draftText = ''
  live.checkedText = undefined
  live.spans = []
  live.hiddenFor = undefined
}

// The band drawn in shell mode reads no atom, so only a redraw brings it back.
function setShellMode($: EngineInterface, isShell: boolean): boolean {
  if (isShell === live.isShell) {
    return false
  }
  live.isShell = isShell
  $.ui.log(`typofix: shell mode ${isShell ? 'on' : 'off'}`, { to: 'debug' })
  $.ui.invalidate('ui.render')
  return true
}

// Claude Code can raise a submit at a turn's end, while the box holds the next draft.
function isLateSubmit(text: string): boolean {
  return live.draftText !== '' && live.draftText !== text
}

async function resetState($: EngineInterface): Promise<void> {
  live.rephrase = 'idle'
  live.isOffering = false
  await update($, issues, () => [])
  await update($, isHidden, () => false)
  await update($, isOffering, () => false)
  await update($, rephrase, () => IDLE)
}

function offeredAt(text: string, cursor: number): Span | undefined {
  return offeredAtCursor(live.spans, text, cursor)
}

async function setOffering($: EngineInterface, offer: boolean): Promise<void> {
  // The panel shows no typeahead rows, so the band never steps aside there.
  const value = offer && !isPanel()
  if (value === live.isOffering) {
    return
  }
  live.isOffering = value
  await update($, isOffering, () => live.isOffering)
}

async function writeIssues(
  $: EngineInterface,
  spans: readonly Span[],
): Promise<void> {
  live.spans = spans
  await update($, issues, () => live.spans.map(toIssue))
}

async function setRephrase($: EngineInterface, value: Rephrase): Promise<void> {
  live.rephrase = value.status
  await update($, rephrase, () => value)
}

function scheduleCheck($: EngineInterface, snapshot: string | undefined): void {
  live.checkTimer?.cancel()
  live.checkTimer = $.clock.after(CHECK_DELAY_MS, () => {
    runSpellCheck($, snapshot).catch((error: unknown) => {
      $.ui.log(`typofix: the check failed: ${String(error)}`, {
        to: 'debug',
      })
    })
  })
}

async function onDraftChange(
  $: EngineInterface,
  edit: Splice,
  text: string,
): Promise<void> {
  const before = live.spans
  live.draftText = text
  live.spans = isUnchecked(text) ? [] : shiftSpans(before, edit, text)
  scheduleCheck($, text)
  if (live.spans.length !== before.length) {
    await writeIssues($, live.spans)
  }
  await settleRephrase($)
}

async function syncDraft($: EngineInterface, text: string): Promise<void> {
  if (text !== live.draftText) {
    await onDraftChange($, diffSplice(live.draftText, text), text)
  }
}

async function settleRephrase($: EngineInterface): Promise<void> {
  if (live.rephrase === 'idle') {
    return
  }
  if (live.rephrase === 'loading' && live.rephraseFrom === 'command') {
    return
  }
  await cancelRephrase($)
}

async function cancelRephrase($: EngineInterface): Promise<void> {
  live.rephraseStop?.abort()
  live.rephraseStop = undefined
  await setRephrase($, IDLE)
}

async function runSpellCheck(
  $: EngineInterface,
  snapshot: string | undefined,
): Promise<void> {
  const { text } = await $.prompt.read()
  if (snapshot !== undefined && text !== snapshot) {
    return
  }
  await readShortcut($)
  if (text !== live.draftText) {
    live.spans = respan(live.spans, live.draftText, text)
    live.draftText = text
  }
  if (text.trim() === '' || isUnchecked(text)) {
    await clearChecked($, text)
    return
  }

  const found = await checkText($, text)
  if (found === undefined) {
    live.checkedText = text
    return
  }
  const fresh = found.sort((a, b) => a.start - b.start)

  const again = await $.prompt.read()
  if (again.text !== text) {
    return
  }
  const hadSpans = live.spans.length > 0
  await showIssues($, fresh)
  live.checkedText = text
  await paintNow($, text, hadSpans)
}

function isUnchecked(text: string): boolean {
  return text.startsWith('/') || live.isShell
}

async function clearChecked($: EngineInterface, text: string): Promise<void> {
  const hadSpans = live.spans.length > 0
  if (hadSpans) {
    await writeIssues($, [])
  }
  live.checkedText = text
  await paintNow($, text, hadSpans)
}

async function paintNow(
  $: EngineInterface,
  text: string,
  hadSpans: boolean,
): Promise<void> {
  // The panel drops decorations.
  if ((live.spans.length === 0 && !hadSpans) || isPanel()) {
    await setOffering($, false)
    return
  }
  const box = await $.prompt.read()
  if (box.text !== text || live.draftText !== text) {
    return
  }
  const offered = offeredAt(text, box.cursor)
  await setOffering($, offered !== undefined)
  await paintMarks($, text, live.spans, offered)
}

// Never mark through a fill: a replace fill turns shell mode off, and a paint
// cannot clear a fill's marks.
async function paintMarks(
  $: EngineInterface,
  text: string,
  spans: readonly Span[],
  offered: Span | undefined,
): Promise<void> {
  if (live.canPaint === false) {
    return
  }
  try {
    await $.prompt.paint({ text, decorations: decorationsFor(spans, offered) })
  } catch (error) {
    $.ui.log(`typofix: could not mark the draft: ${String(error)}`, {
      to: 'debug',
    })
  }
}

// Claude Code words a hook's refusal of a call it has as
// `<plugin>: $.prompt.paint: …`; any other rejection means it has no paint.
async function probePaint($: EngineInterface): Promise<void> {
  if (live.canPaint !== undefined) {
    return
  }
  try {
    await $.prompt.paint({ decorations: [] })
    live.canPaint = true
  } catch (error) {
    live.canPaint = isRefusal(error, $.plugin.name)
    $.ui.log(`typofix: the paint check failed: ${String(error)}`, {
      to: 'debug',
    })
    if (!live.canPaint) {
      $.ui.toast(NO_PAINT, { timeoutMs: 8000 })
    }
  }
}

async function showIssues(
  $: EngineInterface,
  spans: readonly Span[],
): Promise<void> {
  const isNew = isNewList(live.hiddenFor, spans)
  await writeIssues($, spans)
  if (isNew) {
    live.hiddenFor = undefined
    await update($, isHidden, () => false)
  }
}

async function checkedSpans(
  $: EngineInterface,
  text: string,
  signal: AbortSignal,
): Promise<readonly Span[] | undefined> {
  for (
    let waited = 0;
    waited <= TYPEAHEAD_WAIT_MS;
    waited += TYPEAHEAD_POLL_MS
  ) {
    if (live.draftText !== text) {
      return undefined
    }
    if (live.checkedText === text) {
      return live.spans
    }
    try {
      await $.clock.sleep(TYPEAHEAD_POLL_MS, { signal })
    } catch {
      return undefined
    }
  }
  return undefined
}

// Every engine's result leaves through here, so no backend can skip the word
// lists; they filter the merged spans, so an ignored macOS word never lets an
// overlapping hunspell word in. The lists are read once the engines answer,
// so a word ignored while they run stays ignored.
async function checkText(
  $: EngineInterface,
  text: string,
): Promise<Span[] | undefined> {
  const spans = await runBackends($, text)
  return spans === undefined
    ? undefined
    : withoutIgnored(spans, await readWordKeys($))
}

async function runBackends(
  $: EngineInterface,
  text: string,
): Promise<Span[] | undefined> {
  const candidates = chooseCandidates(live.backend)
  for (const candidate of candidates) {
    const found = await runBackend($, candidate, text)
    if (found === 'unavailable') {
      continue
    }
    live.backend = candidate
    const spans =
      candidate.name === 'osascript'
        ? await withExtra($, found, text)
        : found?.spans
    return spans === undefined ? undefined : stillMatching(spans, text)
  }
  if (live.backend === undefined) {
    live.backend = null
    $.ui.toast(NO_BACKEND, { timeoutMs: 8000 })
  }
  return undefined
}

async function withExtra(
  $: EngineInterface,
  found: Checked | undefined,
  text: string,
): Promise<readonly Span[] | undefined> {
  if (found === undefined || live.hunspell === undefined) {
    return found?.spans
  }
  if (!isDictionaryLanguage(live.hunspell, live.language, found.guess)) {
    const guess = describeGuess(found.guess)
    $.ui.log(
      `typofix: hunspell -d ${live.hunspell} skips a draft in another language${guess}`,
      { to: 'debug' },
    )
    return found.spans
  }
  const extra = await runBackend($, extraBackend(live.hunspell), text)
  if (extra === undefined) {
    live.hunspellMisses += 1
  }
  if (extra === 'unavailable' || live.hunspellMisses >= MAX_HUNSPELL_MISSES) {
    $.ui.log(
      `typofix: hunspell -d ${live.hunspell} is missing or too slow; macOS alone checks now`,
      { to: 'debug' },
    )
    live.hunspell = undefined
    return found.spans
  }
  if (extra === undefined) {
    $.ui.log(
      `typofix: hunspell -d ${live.hunspell} did not answer; macOS alone checks this draft`,
      { to: 'debug' },
    )
    return found.spans
  }
  live.hunspellMisses = 0
  return mergeSpans(found.spans, extra.spans)
}

async function runBackend(
  $: EngineInterface,
  backend: Backend,
  text: string,
  isRetry = false,
): Promise<Checked | 'unavailable' | undefined> {
  const startedAt = await $.clock.now()
  let ran: ProcessRunResult
  try {
    ran = await $.process.run(backend.argv($.plugin.root, live.language), {
      // hunspell loads a dictionary and a word list from its working folder
      // first, so a checker must never run in the opened project.
      cwd: $.plugin.root,
      stdin: checkerInput(backend, text),
      timeoutMs: SPELL_TIMEOUT_MS,
    })
  } catch (error) {
    // $.process.run also rejects at the timeout, which proves the program exists.
    const hasStarted =
      (await $.clock.now()) - startedAt >= SPELL_TIMEOUT_MS - TIMER_SLACK_MS
    const willRetry = !hasStarted && !isRetry
    $.ui.log(
      `typofix: ${backend.name} did not ${hasStarted ? 'finish in time' : 'run'}${willRetry ? ' (trying once more)' : ''}: ${String(error)}`,
      { to: 'debug' },
    )
    if (hasStarted) {
      live.knownPrograms.add(backend.name)
      return undefined
    }
    // Claude Code also aborts a run when it cancels the hook call that set the
    // check's timer (Enter cancels a waiting prompt.autocomplete), so a run
    // refused before its timeout is tried once more: a program that cannot
    // start is refused twice.
    if (willRetry) {
      return runBackend($, backend, text, true)
    }
    return live.knownPrograms.has(backend.name) ? undefined : 'unavailable'
  }

  if (isRefusedRun(ran.exitCode, ran.stdout)) {
    $.ui.log(
      `typofix: ${backend.name} exited ${String(ran.exitCode)}: ${ran.stderr.split('\n')[0] ?? ''}`,
      {
        to: 'debug',
      },
    )
    return 'unavailable'
  }
  live.knownPrograms.add(backend.name)

  const warning = scriptWarning(ran.stderr)
  if (warning !== undefined && !live.hasWarned) {
    live.hasWarned = true
    $.ui.toast(warning, { timeoutMs: 8000 })
  }

  // Parse against the draft itself: masking blanks code next to quotes, and
  // a quote's role must match the text a fix is later applied to.
  const checked = backend.parse(ran.stdout, text)
  if (checked === undefined) {
    $.ui.log(`typofix: could not read what ${backend.name} printed`, {
      to: 'debug',
    })
  }
  if (!isSpellServerTimeout(backend.name, ran.stderr)) {
    return checked
  }
  // A spell server that is still starting answers "no typos" with exit 0.
  if (live.draftText !== text) {
    return undefined
  }
  $.ui.log(
    `typofix: the macOS spell server did not answer in time${isRetry ? ' again' : ' (trying once more)'}`,
    { to: 'debug' },
  )
  if (!isRetry) {
    return runBackend($, backend, text, true)
  }
  return keptAfterServerTimeout(checked)
}

async function configDir($: EngineInterface): Promise<string> {
  return (
    (await $.env.get('CLAUDE_CONFIG_DIR')) ??
    `${(await $.env.get('HOME')) ?? ''}/.claude`
  )
}

async function userWordsPath($: EngineInterface): Promise<string> {
  return `${await configDir($)}/${WORDS_FILE}`
}

// Undefined when the project's .claude folder is the user's own, as in a
// session started in the home folder: that file is the user's list.
async function projectWordsPath(
  $: EngineInterface,
): Promise<string | undefined> {
  const path = `${await $.session.root()}/.claude/${WORDS_FILE}`
  return path === (await userWordsPath($)) ? undefined : path
}

async function wordsPath(
  $: EngineInterface,
  level: WordLevel,
): Promise<string | undefined> {
  return level === 'user' ? userWordsPath($) : projectWordsPath($)
}

function shippedPath($: EngineInterface): string {
  return `${$.plugin.root}/${SHIPPED_WORDS_FILE}`
}

// Never rejects: a list that cannot be read counts as empty.
async function readWordKeys($: EngineInterface): Promise<ReadonlySet<string>> {
  const [shipped, user, project, legacy] = await Promise.all([
    readShippedKeys($),
    readWordList($, 'user'),
    readWordList($, 'project'),
    readLegacyWords($),
  ])
  return mergeWordKeys([shipped, user, project], legacy)
}

// The shipped list changes only with a new version, which reloads the module.
async function readShippedKeys(
  $: EngineInterface,
): Promise<ReadonlySet<string>> {
  if (live.shippedKeys !== undefined) {
    return live.shippedKeys
  }
  const text = await readWordFile($, shippedPath($))
  if (text === undefined) {
    return new Set()
  }
  live.shippedKeys = parseWordList(text)
  return live.shippedKeys
}

async function readWordList(
  $: EngineInterface,
  level: WordLevel,
): Promise<ReadonlySet<string>> {
  let path: string | undefined
  try {
    path = await wordsPath($, level)
  } catch (error) {
    $.ui.log(`typofix: no path for the ${level} word list: ${String(error)}`, {
      to: 'debug',
    })
    return new Set()
  }
  return path === undefined
    ? new Set()
    : parseWordList((await readWordFile($, path)) ?? '')
}

async function readWordFile(
  $: EngineInterface,
  path: string,
): Promise<string | undefined> {
  try {
    return await $.fs.read(path)
  } catch (error) {
    if (!MISSING_FILE.test(String(error))) {
      $.ui.log(`typofix: could not read ${path}: ${String(error)}`, {
        to: 'debug',
      })
    }
    return undefined
  }
}

async function readLegacyWords($: EngineInterface): Promise<string[]> {
  try {
    const stored = await $.store.get(IGNORED_KEY)
    return stringsIn(stored)
  } catch (error) {
    $.ui.log(`typofix: could not read the store: ${String(error)}`, {
      to: 'debug',
    })
    return []
  }
}

// A missing file starts empty; any other failed read stops the edit, so a
// refused read can never lead to a write that drops the words already there.
async function readForEdit($: EngineInterface, path: string): Promise<string> {
  return (await $.fs.exists(path)) ? $.fs.read(path) : ''
}

// An edit reads, changes and writes back the whole file, so two at once would
// drop the words of one; they run one after another.
async function oneEditAtATime<T>(edit: () => Promise<T>): Promise<T> {
  const run = live.wordEdits.then(edit)
  live.wordEdits = run.catch(() => undefined)
  return run
}

async function addWords(
  $: EngineInterface,
  path: string,
  header: readonly string[],
  words: readonly string[],
): Promise<string[]> {
  return oneEditAtATime(async () => {
    const edited = addToWordList(await readForEdit($, path), words, header)
    if (edited.added.length > 0) {
      await $.fs.write(path, edited.text)
    }
    return edited.added
  })
}

async function removeWords(
  $: EngineInterface,
  path: string,
  keys: ReadonlySet<string>,
): Promise<string[]> {
  return oneEditAtATime(async () => {
    const edited = removeFromWordList(await readForEdit($, path), keys)
    if (edited.removed.length > 0) {
      await $.fs.write(path, edited.text)
    }
    return edited.removed
  })
}

async function moveLegacyWords($: EngineInterface): Promise<void> {
  const words = await readLegacyWords($)
  if (words.length === 0) {
    return
  }
  const path = await userWordsPath($)
  const added = await addWords($, path, USER_WORDS_HEADER, words)
  await $.store.delete(IGNORED_KEY)
  $.ui.log(
    `typofix: moved ${String(added.length)} ignored words from the store to ${path}`,
    { to: 'debug' },
  )
}

async function runRephrase(
  $: EngineInterface,
  source: string,
  from: RephraseFrom,
): Promise<RephraseOutcome> {
  live.rephraseStop?.abort()
  const stop = new AbortController()
  live.rephraseStop = stop
  live.rephraseFrom = from
  live.rephraseSource = source
  await setRephrase($, { status: 'loading' })

  const limits = rephraseLimits(source)
  const reply = await askHaiku($, source, limits, stop.signal)
  if (live.rephraseStop !== stop) {
    return { reason: 'cancelled' }
  }
  live.rephraseStop = undefined

  const rewrites =
    typeof reply !== 'string' && reply.isAnswered
      ? parseRewriteReply(reply.text)
      : undefined
  if (rewrites === undefined) {
    const reason = typeof reply === 'string' ? reply : failureOf(reply, limits)
    await setRephrase($, { status: 'failed', reason })
    return { reason }
  }
  await setRephrase($, { status: 'ready', rewrites })
  return { rewrites }
}

async function askHaiku(
  $: EngineInterface,
  source: string,
  limits: RephraseLimits,
  signal: AbortSignal,
): Promise<ModelCompleteResult | string> {
  const { system, prompt } = buildRewriteRequest(source)
  const startedAt = await $.clock.now()
  let reply: ModelCompleteResult
  try {
    reply = await $.model.complete(
      {
        model: 'haiku',
        system,
        prompt,
        effort: 'low',
        ...limits,
      },
      { signal },
    )
  } catch (error) {
    return `Haiku could not run (${reasonOf(error, $.plugin.name)})`
  }
  const elapsedMs = (await $.clock.now()) - startedAt
  $.ui.log(
    `typofix: haiku took ${String(elapsedMs)} ms, ${String(reply.usage.input_tokens)} tokens in, ${String(reply.usage.output_tokens)} out`,
    { to: 'debug' },
  )
  return reply
}

async function rephraseDraft($: EngineInterface): Promise<void> {
  const { text } = await $.prompt.read()
  if (text.trim() === '') {
    return
  }
  // In the panel the draft copy can trail the box; a later read of this same
  // text must not count as an edit that cancels the rewrite.
  await syncDraft($, text)
  await runRephrase($, text, 'band')
}

async function retryRephrase($: EngineInterface): Promise<void> {
  await runRephrase($, live.rephraseSource, live.rephraseFrom)
}

function press($: EngineInterface, action: Promise<void>): void {
  action.catch((error: unknown) => {
    $.ui.log(`typofix: a band key failed: ${String(error)}`, { to: 'debug' })
    $.ui.toast(`that did not work: ${reasonOf(error, $.plugin.name)}`)
  })
}

async function pickChoice(
  $: EngineInterface,
  id: string,
  choice: string,
): Promise<void> {
  const { text } = await $.prompt.read()
  await syncDraft($, text)
  const plan = planChoice(live.spans, id, text, choice)
  if (plan.kind === 'gone') {
    $.ui.toast('that word changed; the next check looks again')
    return
  }
  if (plan.kind === 'moved') {
    $.ui.toast('that word changed; the next check looks again')
    await writeIssues($, plan.rest)
    return
  }

  const filled = await $.prompt.fill({ text: plan.text, mode: 'replace' })
  if (!filled.isFilled) {
    $.ui.toast('the prompt box did not take the fix')
    return
  }
  // The box change of the fill itself may have synced the draft already.
  if (live.draftText !== text && live.draftText !== plan.text) {
    return
  }
  live.draftText = plan.text
  live.checkedText = plan.text
  await writeIssues($, plan.spans)
  const offered = offeredAtCursor(plan.spans, plan.text, filled.cursor)
  if (!isPanel()) {
    await paintMarks($, plan.text, plan.spans, offered)
  }
  await setOffering($, offered !== undefined)
  scheduleCheck($, plan.text)
}

async function pickRewrite($: EngineInterface, rewrite: string): Promise<void> {
  const { text } = await $.prompt.read()
  if (text !== live.rephraseSource && text.trim() !== '') {
    $.ui.toast('the draft changed; press r again')
    await setRephrase($, IDLE)
    return
  }

  const before = live.draftText
  const filled = await $.prompt.fill({ text: rewrite, mode: 'replace' })
  if (!filled.isFilled) {
    $.ui.toast('the prompt box did not take the rewrite')
    return
  }
  if (live.draftText !== before && live.draftText !== rewrite) {
    return
  }
  live.draftText = rewrite
  await setRephrase($, IDLE)
  await writeIssues($, [])
  await setOffering($, false)
  scheduleCheck($, rewrite)
}

async function readShortcut($: EngineInterface): Promise<void> {
  const dir = await configDir($)
  try {
    live.shortcut = focusShortcut(await $.fs.read(`${dir}/keybindings.json`))
  } catch {
    // A failed read keeps the key shown so far, which starts as the default.
  }
}

async function ignoreWord($: EngineInterface, word: string): Promise<void> {
  await addWords($, await userWordsPath($), USER_WORDS_HEADER, [word])
  const { text, cursor } = await $.prompt.read()
  await syncDraft($, text)
  const rest = withoutWord(live.spans, word)
  if (rest.length === live.spans.length) {
    return
  }
  const offered = offeredAtCursor(rest, text, cursor)
  live.spans = rest
  if (isPanel()) {
    await writeIssues($, live.spans)
    return
  }
  await paintMarks($, text, rest, offered)
  await setOffering($, offered !== undefined)
  await writeIssues($, live.spans)
}

async function pollPanel($: EngineInterface): Promise<void> {
  if (!isPanel() || live.isReading) {
    return
  }
  live.isReading = true
  try {
    const startedAt = await $.clock.now()
    const { text } = await $.prompt.read()
    const isSilent =
      text === '' && (await $.clock.now()) - startedAt >= PANEL_SILENT_MS
    if (!isSilent) {
      await syncDraft($, text)
    }
  } finally {
    live.isReading = false
  }
}

// Asked, not counted from session.attach: a module loaded after the panel
// attached (a reload or an enable) hears no attach.
async function readPanelAttached($: EngineInterface): Promise<void> {
  live.isPanelAttached = (await $.session.surfaces()).includes('vscode')
}

function stopPanelPoll(): void {
  live.pollTimer?.cancel()
  live.pollTimer = undefined
}

// The timer runs only while a panel shows this session: switching to another
// conversation in the panel detaches it.
function syncPanelPoll($: EngineInterface): void {
  if (!isPanel()) {
    stopPanelPoll()
    return
  }
  live.pollTimer ??= $.clock.every(PANEL_POLL_MS, () => {
    pollPanel($).catch((error: unknown) => {
      $.ui.log(`typofix: reading the panel's draft failed: ${String(error)}`, {
        to: 'debug',
      })
    })
  })
}

async function hideIssues($: EngineInterface): Promise<void> {
  live.hiddenFor = spanSignature(live.spans)
  await update($, isHidden, () => true)
}

async function runWordsCommand(
  $: EngineInterface,
  args: string,
): Promise<string> {
  const parsed = parseWordsArgs(args)
  if (parsed.kind === 'usage') {
    return WORDS_USAGE
  }
  if (parsed.kind === 'notWords') {
    return `not a word: ${parsed.words.join(', ')} (a word needs a letter, and # starts a comment)`
  }
  try {
    if (parsed.kind === 'list') {
      return await listWords($)
    }
    return parsed.kind === 'remove'
      ? await removeCommand($, parsed.words)
      : await addCommand($, parsed.level, parsed.words)
  } catch (error) {
    return `that did not work: ${reasonOf(error, $.plugin.name)}`
  }
}

async function listWords($: EngineInterface): Promise<string> {
  const project = await projectWordsPath($)
  const legacy = await readLegacyWords($)
  return [
    // Claude Code shows a mod's reply after `typofix: `.
    'These words are never listed as typos, whichever spell checker flags them:',
    await describeFile($, 'ships with typofix', shippedPath($)),
    await describeFile(
      $,
      'yours, in all your projects',
      await userWordsPath($),
    ),
    project === undefined
      ? `this project: none, since its .claude folder is yours`
      : await describeFile(
          $,
          'this project, for everyone who commits the file',
          project,
        ),
    ...(legacy.length > 0
      ? [`still in the store, moved at the next start: ${legacy.join(', ')}`]
      : []),
  ].join('\n')
}

async function describeFile(
  $: EngineInterface,
  name: string,
  path: string,
): Promise<string> {
  try {
    return describeList(name, path, listedWords(await readForEdit($, path)))
  } catch (error) {
    return `${name}: could not read ${path}: ${reasonOf(error, $.plugin.name)}`
  }
}

async function addCommand(
  $: EngineInterface,
  level: WordLevel,
  words: readonly string[],
): Promise<string> {
  const path = await wordsPath($, level)
  if (path === undefined) {
    return "no project list here: this project's .claude folder is your own. Use /typo-words add."
  }
  const header = wordListHeader(level)
  const shipped = await readShippedKeys($)
  const asked = askedWords(words)
  const added = await addWords($, path, header, notShipped(asked, shipped))
  return addReport({ level, path, asked, added, shipped })
}

async function removeCommand(
  $: EngineInterface,
  words: readonly string[],
): Promise<string> {
  // A word still in the store would stay ignored after its line is gone.
  await moveLegacyWords($)
  const asked = askedWords(words)
  const keys = new Set(asked.map(wordKey))
  const shipped = await readShippedKeys($)
  const project = await projectWordsPath($)
  const edits = [
    await removeFrom($, await userWordsPath($), keys),
    ...(project === undefined ? [] : [await removeFrom($, project, keys)]),
  ]
  return removeReport(edits, asked, shipped)
}

// One file's refusal must not hide what changed in the other.
async function removeFrom(
  $: EngineInterface,
  path: string,
  keys: ReadonlySet<string>,
): Promise<WordFileEdit> {
  try {
    return { path, removed: await removeWords($, path, keys) }
  } catch (error) {
    return { path, removed: [], error: reasonOf(error, $.plugin.name) }
  }
}

export const register: Register = (on, options) => {
  const language = options['language']
  live.language = typeof language === 'string' ? language.trim() : ''
  live.hunspell = hunspellDictionary(options['hunspell'])

  on('session.start', async ($, e, next) => {
    forgetDraft()
    setShellMode($, false)
    live.shippedKeys = undefined
    await resetState($)
    await readShortcut($)
    // The store key goes only once the words are in the file, so a failed
    // move loses nothing: the check reads the store too until then.
    await moveLegacyWords($).catch((error: unknown) => {
      $.ui.log(`typofix: could not move the ignored words: ${String(error)}`, {
        to: 'debug',
      })
    })
    await $.command.register({
      name: 'rephrase',
      description: 'Rewrite a text 3 ways with Haiku: fixed, natural and short',
      argumentHint: '<text>',
    })
    await $.command.register({
      name: 'typo-words',
      description: 'List, add or remove the words typofix never lists as typos',
      argumentHint: '[add|share|remove <word…>]',
    })
    if (e.isInteractive) {
      await probePaint($)
      scheduleCheck($, undefined)
    } else if (
      (await $.env.get('CLAUDE_CODE_ENTRYPOINT')) === PANEL_ENTRYPOINT
    ) {
      live.isPanelHost = true
      stopPanelPoll()
      await readPanelAttached($)
      syncPanelPoll($)
    }
    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    const attached = await next(e)
    if (live.isPanelHost) {
      await readPanelAttached($)
      syncPanelPoll($)
    }
    return attached
  })

  on('session.detach', async ($, e, next) => {
    const detached = await next(e)
    if (live.isPanelHost) {
      await readPanelAttached($)
      syncPanelPoll($)
    }
    return detached
  })

  on('prompt.edit', async ($, e, next) => {
    live.hasEdits = true
    stopPanelPoll()
    await syncDraft($, e.text)
    const edited = await next(e)
    if (edited.text !== e.text) {
      await onDraftChange($, e, edited.text)
    }
    const offered = offeredAt(edited.text, edited.cursor)
    await setOffering($, offered !== undefined)
    await paintMarks($, edited.text, live.spans, offered)
    return edited
  })

  on('prompt.autocomplete', async ($, e, next) => {
    const offered = await next(e)
    if (e.text.startsWith('/')) {
      return offered
    }
    await syncDraft($, e.text)
    const spans = await checkedSpans($, e.text, next.signal)
    const fixes = spans === undefined ? [] : typeaheadRows(spans, e)
    if (fixes.length === 0) {
      return offered
    }
    await setOffering($, true)
    return { suggestions: [...offered.suggestions, ...fixes] }
  })

  on('prompt.change', async ($, e, next) => {
    // Shell mode can end here with no hint drawn; the next hint sets it again.
    if (e.origin.kind === 'clear') {
      setShellMode($, false)
    }
    if (e.origin.kind !== 'plugin' || e.origin.name !== $.plugin.name) {
      await syncDraft($, e.text)
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // The panel's draft copy can trail its box by one read, so a panel send
    // is never judged late; the next read checks whatever the box holds.
    const isPanelSend = isPanel() && e.origin.kind === 'sdk'
    if (
      !isPanelSend &&
      (e.origin.kind !== 'composer' || isLateSubmit(e.text))
    ) {
      return next(e)
    }
    const isDraftSent = live.draftText === e.text
    forgetDraft()
    setShellMode($, false)
    // A late submit while the box is empty must not close /rephrase's rewrites.
    if (isDraftSent) {
      await settleRephrase($)
    }
    await update($, issues, () => live.spans.map(toIssue))
    await update($, isHidden, () => false)
    await setOffering($, false)
    return next(e)
  })

  on('command.run', { command: 'rephrase' }, async ($, e) => {
    const source = e.args.trim()
    if (source === '') {
      return { text: 'usage: /rephrase <text>' }
    }
    const outcome = await runRephrase($, source, 'command')
    if ('reason' in outcome) {
      return { text: outcome.reason }
    }
    return { text: formatRewrites(outcome.rewrites) }
  })

  on('command.run', { command: 'typo-words' }, async ($, e) => ({
    text: await runWordsCommand($, e.args),
  }))

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    // Read back from the drawn row, so the hint can end in blank cells.
    const isShell = e.props.hint.trimEnd().endsWith(SHELL_HINT)
    if (setShellMode($, isShell)) {
      scheduleCheck($, undefined)
    }
    return next(e)
  })

  // A rewrite picked in shell mode would replace the draft and end the mode.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || live.isShell) {
      return next(e)
    }
    const [list, hidden, offering, phrase] = await Promise.all([
      read($, issues),
      read($, isHidden),
      read($, isOffering),
      read($, rephrase),
    ])
    const { Box, Button, Text } = $.ui.resolve(e)
    const isClicked = e.surface === 'vscode'
    const header = (
      <Text dimColor>
        typofix{isClicked ? '' : ` · ${live.shortcut}, then a key`}
      </Text>
    )

    if (phrase.status === 'loading') {
      return (
        <Box flexDirection="column">
          {header}
          <Box columnGap={2}>
            <Text>Haiku is rewriting the draft…</Text>
            <Button
              key="cancel"
              hotkey="x"
              plain
              onPress={() => {
                press($, cancelRephrase($))
              }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      )
    }

    if (phrase.status === 'failed') {
      return (
        <Box flexDirection="column">
          {header}
          <Box columnGap={2} flexWrap="wrap">
            <Text color="error">{phrase.reason}</Text>
            <Button
              key="rephrase"
              hotkey="r"
              plain
              onPress={() => {
                press($, retryRephrase($))
              }}
            >
              Try again
            </Button>
            <Button
              key="cancel"
              hotkey="x"
              plain
              onPress={() => {
                press($, cancelRephrase($))
              }}
            >
              Close
            </Button>
          </Box>
        </Box>
      )
    }

    if (phrase.status === 'ready') {
      return (
        <Box flexDirection="column">
          {header}
          {phrase.rewrites.map((rewrite, i) => (
            <Button
              key={`rewrite-${String(i + 1)}`}
              hotkey={String(i + 1)}
              plain
              onPress={() => {
                press($, pickRewrite($, rewrite))
              }}
            >
              <Text dimColor>{REWRITE_LABELS[i] ?? ''}:</Text> {rewrite}
            </Button>
          ))}
          <Button
            key="cancel"
            hotkey="x"
            plain
            onPress={() => {
              press($, cancelRephrase($))
            }}
          >
            Cancel
          </Button>
        </Box>
      )
    }

    if (offering || hidden || list.length === 0) {
      return next(e)
    }

    const room = Math.max(1, Math.min(MAX_LISTED, e.props.maxRows - 3))
    const shown = list.slice(0, room)
    const width = Math.max(...shown.map(issue => issue.original.length))
    const count = `${String(list.length)} ${list.length === 1 ? 'typo' : 'typos'}`
    let lettered = 0

    return (
      <Box flexDirection="column">
        <Text dimColor>
          typofix · {count} ·{' '}
          {isClicked ? 'click a fix' : `${live.shortcut}, then a key`}
        </Text>
        {shown.map((issue, row) => (
          <Box key={`issue-${String(row + 1)}`} columnGap={2}>
            <Text color={issue.kind === 'spelling' ? 'error' : 'warning'}>
              {issue.original.padEnd(width)}
            </Text>
            {issue.choices.length === 0 && <Text dimColor>no suggestions</Text>}
            {issue.choices.map((choice, n) => {
              const hotkey = fixLetter(lettered++)
              return (
                <Button
                  key={`fix-${String(row + 1)}-${String(n + 1)}`}
                  {...(hotkey === undefined ? {} : { hotkey })}
                  plain
                  onPress={() => {
                    press($, pickChoice($, issue.id, choice))
                  }}
                >
                  {choice}
                </Button>
              )
            })}
            {issue.kind === 'spelling' ? (
              <Button
                key={`ignore-${String(row + 1)}`}
                hotkey={String(row + 1)}
                plain
                dimColor
                onPress={() => {
                  press($, ignoreWord($, issue.original))
                }}
              >
                ignore
              </Button>
            ) : (
              <Text dimColor>grammar</Text>
            )}
          </Box>
        ))}
        {list.length > shown.length && (
          <Text dimColor>and {String(list.length - shown.length)} more</Text>
        )}
        <Box columnGap={2}>
          <Button
            key="rephrase"
            hotkey="r"
            plain
            onPress={() => {
              press($, rephraseDraft($))
            }}
          >
            Rephrase
          </Button>
          <Button
            key="hide"
            hotkey="x"
            plain
            onPress={() => {
              press($, hideIssues($))
            }}
          >
            Hide
          </Button>
        </Box>
      </Box>
    )
  })
}
