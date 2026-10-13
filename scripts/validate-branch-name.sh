#!/usr/bin/env sh
set -eu

# Enforce branch naming convention:
#   <type>/<description> (optional STAR ticket prefix)
#
# Examples:
#   feat/repo-config
#   fix/null-pointer-on-login
#
# Allowed prefixes: build, chore, ci, codex, docs, feat, fix, perf, refactor, revert, style, test
#
# Branches that are allowed to bypass this check (mainline + detached):
#   main, master, develop, dev, release/*, hotfix/*
# 
# To fix already created branches, you can use the following command:
#   git branch -m <old-branch-name> <new-branch-name>

branch="$(git branch --show-current 2>/dev/null || true)"

# Detached HEAD (e.g. CI, certain rebases)
if [ -z "${branch}" ]; then
  exit 0
fi

case "${branch}" in
  main|master|develop|dev) exit 0 ;;
  release/*|hotfix/*) exit 0 ;;
esac

pattern='^(build|chore|ci|codex|docs|feat|fix|perf|refactor|revert|style|test)/(STAR-[0-9]+-)?[a-z0-9][a-z0-9-]*$'

if printf "%s" "${branch}" | grep -Eq "${pattern}"; then
  exit 0
fi

cat <<EOF
Invalid branch name: '${branch}'

Expected:
  <type>/<description>

Where:
  type: build | chore | ci | codex | docs | feat | fix | perf | refactor | revert | style | test
  description: lowercase kebab-case

Examples:
  feat/repo-config
  fix/null-pointer-on-login

Fixing already created branches:
  git branch -m <old-branch-name> <new-branch-name>
EOF

exit 1

