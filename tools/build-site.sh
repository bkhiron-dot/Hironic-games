#!/usr/bin/env bash
# Builds everything GitHub Pages serves, into dist/:
#  - the game from main, at the root (tests must pass, or nothing is published);
#  - a preview of each open pull request labelled "preview", at dist/preview/pr-<number>/,
#    so a change can be played on a phone before it's merged.
# Previews are only for pull requests from this repository (not forks), and a preview that
# fails to build is skipped: it never stops main being published.
# Run from a checkout of main, with the GitHub CLI logged in (GH_TOKEN in the workflow).
set -euo pipefail

npm ci
npm test
npm run build

site="$(pwd)/dist"
prs=$(gh pr list --state open --label preview --json number,isCrossRepository \
  --jq '.[] | select(.isCrossRepository | not) | .number')

for pr in $prs; do
  echo "::group::Preview of pull request #$pr"
  work="$(mktemp -d)"
  if git fetch --quiet origin "pull/$pr/head:preview-$pr" \
    && git worktree add --quiet "$work" "preview-$pr" \
    && (cd "$work" && npm ci && npx vite build --outDir "$site/preview/pr-$pr" --emptyOutDir); then
    echo "Built preview/pr-$pr/"
  else
    echo "::warning::Preview of pull request #$pr didn't build; skipped"
    rm -rf "$site/preview/pr-$pr"
  fi
  git worktree remove --force "$work" 2>/dev/null || true
  echo "::endgroup::"
done
