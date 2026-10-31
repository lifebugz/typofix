# packages/core

The typofix logic every harness shares: reading what the spell checkers print,
word edges and quotes, the word lists, the offered fixes, and the rephrase
prompt. A harness runs the checkers, reads and writes the files, calls the
model and draws the band; core turns plain values into plain values.

## Rules

- **Edit only here.** Each harness gets a generated copy (for Claude Code:
  `harnesses/claude-code/hooks/core/`, `scripts/spell-macos.js` and
  `words.txt`). After a change, run `bun run core:sync` from the repository
  root and commit the source and its copies together. `bun run core:check`
  fails when they differ.
- **Only its own files.** `src/` imports nothing but relative paths: no
  package, no `claude-code`, no `node:` module. ESLint enforces it.
- **No I/O.** No process, file, clock or model calls. `tsconfig.json` loads no
  host types, so `process` or `Bun` does not type-check in `src/`. `env.d.ts`
  declares the two host globals core needs, `TextEncoder` and `TextDecoder`,
  which every host supplies.
- **A public API.** A harness imports only `src/index.ts`.

## Modules

| Module                   | What it holds                                                          |
| :----------------------- | :--------------------------------------------------------------------- |
| `src/types.ts`           | The shared types: `TypoIssue`, `Span`, `Token`, `Checked`, `Rephrase`… |
| `src/json.ts`            | Shape checks for parsed JSON                                           |
| `src/assets.ts`          | Where each asset lands in a harness folder                             |
| `src/text/mask.ts`       | Blanks code, paths, links and mentions before a check                  |
| `src/text/boundaries.ts` | Word edges, apostrophes and quote pairs                                |
| `src/text/spans.ts`      | Makes spans, moves them across an edit, finds the token at the cursor  |
| `src/checkers/*.ts`      | The checker programs, reading their output, and language choice        |
| `src/fixes.ts`           | The offered fix, applying a fix, and issue list signatures             |
| `src/words/list.ts`      | Word list files: read, add, remove                                     |
| `src/words/command.ts`   | The `/typo-words` arguments and replies                                |
| `src/rephrase.ts`        | The rewrite prompt, reading the reply, and the time and token limits   |
| `src/index.ts`           | The public API                                                         |
| `assets/macos/`          | `spell-macos.js`, the script `osascript` runs on macOS, and its types  |
| `assets/words.txt`       | Words typofix never lists as typos, for everyone                       |

## Test

`bun test` from the repository root runs `tests/*.test.ts`, one file per
module.
