#!/bin/sh
# Copies the mod API types the engine writes beside a mod on an interactive
# load into tooling/types/, which fresh clones and CI type-check against.
# claude-code-mcp is left out: it lists this machine's connected MCP servers.
set -eu
installed=$(claude --version | sed -n 's/^\([0-9][0-9.]*\).*/\1/p')
src=""
for types in harnesses/*/.claude-plugin/types; do
  [ -f "$types/claude-code/index.d.ts" ] || continue
  written=$(sed -n '1s/^\/\/ Written by Claude Code \([0-9.]*\)\.$/\1/p' "$types/claude-code/index.d.ts")
  [ "$written" = "$installed" ] || continue
  if [ -z "$src" ]; then
    src=$types
    continue
  fi
  for part in claude-code claude-code-tools; do
    if ! cmp -s "$src/$part/index.d.ts" "$types/$part/index.d.ts"; then
      echo "$src/$part and $types/$part differ, though Claude Code $installed wrote both." >&2
      exit 1
    fi
  done
done
if [ -z "$src" ]; then
  echo "No mod has types from Claude Code $installed. Load one mod once:" >&2
  echo "  claude --plugin-dir harnesses/claude-code" >&2
  exit 1
fi
bun tooling/scripts/check-engine-config.ts "$src/tsconfig.json"
for part in claude-code claude-code-tools; do
  mkdir -p "tooling/types/$part"
  cp "$src/$part/index.d.ts" "tooling/types/$part/index.d.ts"
done
echo "Copied the types of Claude Code $installed from $src."
