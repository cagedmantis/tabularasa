#!/usr/bin/env sh
# changelog.sh — print a Markdown changelog for commits in a git range.
#
# Usage:
#   scripts/changelog.sh [<since-ref>]
#
# <since-ref> defaults to the most recent tag; if the repo has no tags, the
# full history reachable from HEAD is used. Commits are grouped by Conventional
# Commit type (feat, fix, ...). If no commit follows the convention, a plain
# bulleted list is emitted instead.
set -eu

_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
. "$_dir/lib.sh"

require_cmd git
require_cmd awk
cd "$(repo_root)"

since=${1:-}
[ -n "$since" ] || since=$(git describe --tags --abbrev=0 2>/dev/null || true)

if [ -n "$since" ]; then
	range="${since}..HEAD"
else
	range="HEAD"
fi

# %s = subject, then a unit-separator (0x1f), then %h = short hash.
git log --no-merges --pretty=format:'%s%x1f%h' $range | awk '
BEGIN {
	FS = "\037"
	total = 0; conv = 0
	nord = split("feat fix perf refactor docs test build ci style chore revert", ord, " ")
	head["feat"]="### Features";       head["fix"]="### Bug Fixes"
	head["perf"]="### Performance";    head["refactor"]="### Refactoring"
	head["docs"]="### Documentation";  head["test"]="### Tests"
	head["build"]="### Build System";  head["ci"]="### Continuous Integration"
	head["style"]="### Styles";        head["chore"]="### Chores"
	head["revert"]="### Reverts"
}
{
	subj = $1; hash = $2
	total++
	if (match(subj, /^[a-z]+(\([^)]*\))?!?:[ ]/)) {
		conv++
		t = subj; sub(/[(!:].*/, "", t)          # type = leading word
		d = subj; sub(/^[^:]*:[ ]*/, "", d)       # description after the colon
		bucket[t] = bucket[t] "- " d " (" hash ")\n"
		seen[t] = 1
	} else {
		other = other "- " subj " (" hash ")\n"
		hasother = 1
	}
}
END {
	if (total == 0) { print "_No changes since the previous release._"; exit }

	if (conv == 0) { printf "%s", other; exit }   # nothing conventional -> flat list

	first = 1
	for (i = 1; i <= nord; i++) {
		t = ord[i]
		if (seen[t]) {
			if (!first) printf "\n"; first = 0
			printf "%s\n\n%s", head[t], bucket[t]
		}
	}
	# Conventional types we do not have a canonical heading for.
	for (t in seen) {
		if (!(t in head)) {
			if (!first) printf "\n"; first = 0
			printf "### %s\n\n%s", t, bucket[t]
		}
	}
	if (hasother) {
		if (!first) printf "\n"
		printf "### Other\n\n%s", other
	}
}
'
