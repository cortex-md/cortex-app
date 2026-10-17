#!/bin/sh
set -u

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
[ -n "$base" ] || exit 1

if ! git cat-file -e "$base^{commit}" 2>/dev/null; then
	git fetch --quiet --depth=1 origin "$base" 2>/dev/null || exit 1
fi

git diff --quiet "$base" HEAD -- . ../../packages/ui ../../packages/sync-api ../../packages/platform ../../tsconfig.base.json
