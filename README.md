# typofix

typofix checks the spelling and grammar of your prompt while you type in an AI
coding tool, offers up to 3 fixes for each mistake, and rewrites the whole
draft with Haiku when you ask. It is made for people who write their prompts in
a second language.

![The band lists whaat with a: what, b: wheat and 1: ignore, and youu with c: you, d: your, e: yous and 2: ignore](docs/media/band.png)

## Harnesses

A harness is the coding tool typofix runs in. Each one has its own folder, and
all of them share the logic in [`packages/core`](packages/core/README.md).

| Harness     | Folder                                                     | Status    |
| :---------- | :--------------------------------------------------------- | :-------- |
| Claude Code | [`harnesses/claude-code`](harnesses/claude-code/README.md) | Available |
| opencode    |                                                            | Planned   |
| pi          |                                                            | Planned   |

## Install in Claude Code

typofix needs Claude Code 2.1.300 or later. Add one of its two marketplaces,
then install it:

```shell
/plugin marketplace add lifebugz/typofix
/plugin install typofix@typofix
```

Or from the [lifebugz marketplace](https://github.com/lifebugz/cc-marketplace),
which lists other plugins too:

```shell
/plugin marketplace add lifebugz/cc-marketplace
/plugin install typofix@lifebugz
```

Install it from one marketplace only. Both list a plugin named `typofix`, and
when two enabled plugins have the same name, Claude Code loads the hooks module
of only one of them. Claude Code keeps a plugin's settings under its id
(`typofix@typofix` or `typofix@lifebugz`), so after a switch, set the spelling
language again with `/plugin configure typofix@<marketplace>`.

The [Claude Code guide](harnesses/claude-code/README.md) explains how to use
typofix.

## Layout

```
packages/core/          the logic every harness shares, and the only place it is edited
harnesses/claude-code/  the Claude Code plugin, which both marketplaces install
  hooks/core/           generated: a copy of packages/core/src
  scripts/spell-macos.js, words.txt
                        generated: copies of packages/core/assets
tooling/                TypeScript and ESLint configs, the Claude Code mod API types, scripts
docs/media/             the images in the READMEs
```

Claude Code installs only the plugin folder, and a hooks module can import only
files inside its plugin. So `bun run core:sync` copies core into the plugin, and
`bun run core:check` fails when a copy differs from its source. Each copy starts
with a `GENERATED` line; edit the source in `packages/core`, never the copy.

## Develop

You need [Bun](https://bun.com) and Claude Code. From the repository root:

```shell
bun install
bun run check
```

`bun run check` runs these in order, and must pass with zero warnings:

| Script         | What it runs                                                                                |
| :------------- | :------------------------------------------------------------------------------------------ |
| `types:check`  | Fails when `tooling/types/` is older than the installed Claude Code                         |
| `core:check`   | Fails when a copy of `packages/core` in a harness differs from its source                   |
| `typecheck`    | TypeScript 7 on each project: the tooling, core, core's tests, the macOS script, the plugin |
| `lint`         | ESLint with type information, one process each for the tooling, core and the plugin         |
| `format:check` | Prettier over the whole repository                                                          |
| `test`         | `bun test` for core, then `claude plugin test` for the plugin                               |
| `validate`     | `claude plugin validate --strict` for the plugin and for the marketplace                    |

After a change in `packages/core`, run `bun run core:sync` and commit the source
and its copies together.

ESLint and TypeScript keep the parts apart:

- Core imports only its own files, never a package or a host API.
- Core's TypeScript project has no host types, so `process`, `Bun` or a file
  API does not type-check there. A harness does all I/O (processes, files,
  clocks, model calls) and passes plain values to core.
- Harness code imports core only through `core/index`, its public API.

The mod API types in `tooling/types/` are copied from the ones Claude Code
writes beside a plugin it loads. After a Claude Code update, start it once with
`claude --plugin-dir harnesses/claude-code`, then run `bun run types:sync` and
commit `tooling/types/`.

CI runs `bun run check` with the Claude Code version that wrote
`tooling/types/`, and runs `validate` and `test` with the oldest Claude Code
typofix supports (2.1.300).

## Release

1. Raise `version` in `harnesses/claude-code/.claude-plugin/plugin.json`. With
   the same version, `claude plugin update` says typofix is already at the
   latest version, and users keep the old copy.
2. Push to `main` and wait for CI to pass. Users of the `typofix` marketplace
   get the new version at their next plugin update.
3. Open a pull request on
   [lifebugz/cc-marketplace](https://github.com/lifebugz/cc-marketplace) that
   moves the `sha` of its `typofix` entry to the commit you pushed.

## License

[MIT](LICENSE)
