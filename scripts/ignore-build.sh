#!/usr/bin/env bash
# Vercel "Ignored Build Step" (set in vercel.json as "ignoreCommand").
# Exit 0 skips the build; exit 1 builds.
# Production always builds, so the live site always matches main.
# A preview is skipped only when every changed file is Markdown or sits in docs/.
# Folders listed in ALWAYS_BUILD (for example content/ holding site pages written
# in Markdown) always build, even when only Markdown changed there.

ALWAYS_BUILD="${ALWAYS_BUILD:-}"   # space-separated folder names, e.g. "content"

if [ "$VERCEL_ENV" = "production" ]; then
  echo "Production deploy: building."
  exit 1
fi

# Compare with the last commit Vercel built for this branch, else the parent.
base="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
git cat-file -e "$base^{commit}" 2>/dev/null || base="HEAD^"

if ! changed=$(git diff --name-only "$base" HEAD 2>/dev/null) || [ -z "$changed" ]; then
  echo "Could not list changed files: building to be safe."
  exit 1
fi

while IFS= read -r f; do
  for dir in $ALWAYS_BUILD; do
    case "$f" in "$dir"/*) echo "Changed $f: building preview."; exit 1 ;; esac
  done
  case "$f" in
    docs/*|*.md) ;;
    *) echo "Site files changed: building preview."; exit 1 ;;
  esac
done <<< "$changed"

echo "Only .md or docs/ files changed: skipping preview."
exit 0
