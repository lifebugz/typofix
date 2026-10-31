#!/bin/sh
# Runs ESLint with zero warnings allowed, on the given paths, or with no paths
# on the root tooling, each package and each harness.
# Usage: sh tooling/scripts/lint.sh [paths...]
set -eu
eslint=node_modules/.bin/eslint

if [ $# -gt 0 ]; then
  exec "$eslint" --max-warnings 0 "$@"
fi

# One ESLint process per folder, all at once: each builds its own TypeScript
# program, and a type-aware check can spend minutes warming one up.
failed=0
logs=$(mktemp -d)
trap 'rm -rf "$logs"' EXIT
"$eslint" --max-warnings 0 --ignore-pattern 'harnesses/**' --ignore-pattern 'packages/**' . >"$logs/root" 2>&1 &
jobs="$!:root"
for dir in packages/*/ harnesses/*/; do
  [ -d "$dir" ] || continue
  dir=${dir%/}
  name=$(printf '%s' "$dir" | tr / -)
  "$eslint" --max-warnings 0 "$dir" >"$logs/$name" 2>&1 &
  jobs="$jobs $!:$name"
done
for job in $jobs; do
  name=${job#*:}
  if wait "${job%%:*}"; then
    echo "eslint $name: ok"
  else
    echo "eslint $name: failed"
    failed=1
  fi
  cat "$logs/$name"
done
exit $failed
