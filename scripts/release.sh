#!/usr/bin/env sh
# release.sh — release the extension: version, tag, and hand off to CI, which
# publishes the GitHub release and submits the package to the Chrome Web Store.
#
# Usage:
#   scripts/release.sh [major|minor|patch] [options]
#
# Without a bump type, it is inferred from the Conventional Commits since the
# last tag: a breaking change is major, a feature minor, anything else patch.
#
# Options:
#   --dry-run       Preview the new version and changelog; change nothing.
#   --yes, -y       Skip the interactive confirmation.
#   --no-publish    Bump, package, commit and tag locally; push nothing.
#   --no-wait       Push and return without watching the release workflow.
#
# The build runs in Docker (see the Dockerfile): the host needs git, docker,
# make and gh (authenticated).
#
# What a release does, in order:
#   1. Preflight: on the release branch, clean tree, in sync with origin, CI
#      green for this commit (waits if it is still running), tag is free.
#   2. Bump manifest.json + package.json, then build, test, lint and package
#      in Docker (`make package`) as a last local check.
#   3. Commit the bump and create an annotated tag containing the changelog.
#   4. Push branch and tag together. The tag starts the Release workflow
#      (.github/workflows/release.yml): CI on both architectures, a build
#      provenance attestation, the GitHub release, and the Chrome Web Store
#      upload and submission for review.
#   5. Watch that workflow, then check that CI's zip has the same checksum as
#      the one built here.
#
# Safety: a failure before the push leaves no bump, commit or tag behind.
set -eu

_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
. "$_dir/lib.sh"

ARTIFACT_BASE=tabularasa   # matches EXTENSION_NAME in the Makefile
OUT_DIR=out                # matches OUT_DIR in the Makefile
MANIFEST=manifest.json
CI_WORKFLOW=ci.yml
RELEASE_WORKFLOW=release.yml

usage() {
	sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
}

# --- parse arguments ------------------------------------------------------
BUMP=''
DRY=0; ASSUME_YES=0; NO_PUBLISH=0; NO_WAIT=0
for arg in "$@"; do
	case "$arg" in
		major|minor|patch) BUMP=$arg ;;
		--dry-run)    DRY=1 ;;
		--yes|-y)     ASSUME_YES=1 ;;
		--no-publish) NO_PUBLISH=1 ;;
		--no-wait)    NO_WAIT=1 ;;
		-h|--help)    usage; exit 0 ;;
		*) die "unknown argument: '$arg' (see --help)" ;;
	esac
done

require_cmd git
cd "$(repo_root)"
[ -f "$MANIFEST" ] || die "$MANIFEST not found at repo root"

# --- compute version + changelog (read-only) ------------------------------
PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || true)
if [ -n "$PREV_TAG" ]; then
	[ -n "$(git log --no-merges --format=%h "$PREV_TAG..HEAD")" ] || die "no commits since $PREV_TAG — nothing to release"
fi
if [ -n "$BUMP" ]; then
	BUMP_FROM=requested
else
	BUMP=$(infer_bump "$PREV_TAG")
	BUMP_FROM='inferred from commits'
fi
CUR=$(json_version "$MANIFEST")
NEW=$(semver_bump "$BUMP" "$CUR")
TAG="v$NEW"
ARTIFACT="${OUT_DIR}/${ARTIFACT_BASE}-${NEW}.zip"
CHANGELOG=$("$_dir/changelog.sh" "${PREV_TAG:-}")

# --- preview --------------------------------------------------------------
info "Release preview"
printf '  current version : %s\n'         "$CUR" >&2
printf '  new version     : %s  (%s, %s)\n' "$NEW" "$BUMP" "$BUMP_FROM" >&2
printf '  git tag         : %s\n'         "$TAG" >&2
printf '  previous tag    : %s\n'         "${PREV_TAG:-<none> — full history}" >&2
printf '  artifact        : %s\n'         "$ARTIFACT" >&2
printf '\n%s Changelog (%s..HEAD) %s\n%s\n%s\n' \
	'----------' "${PREV_TAG:-ROOT}" '----------' "$CHANGELOG" '--------------------------------------' >&2

if [ "$DRY" -eq 1 ]; then
	warn "dry run — no files changed, no commit, no tag, nothing pushed."
	exit 0
fi

# --- preflight for a real release -----------------------------------------
require_cmd make
require_cmd docker
assert_on_release_branch
assert_clean_tree
BRANCH=$(current_branch)
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null 2>&1 && die "tag $TAG already exists"

if [ "$NO_PUBLISH" -eq 0 ]; then
	require_cmd gh
	gh auth status >/dev/null 2>&1 || die "gh is not authenticated — run: gh auth login"
	git fetch --quiet origin "$BRANCH" --tags
	[ -z "$(git ls-remote --tags origin "refs/tags/$TAG")" ] || die "tag $TAG already exists on origin"
	[ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")" ] \
		|| die "$BRANCH is not in sync with origin/$BRANCH — pull or push first, so CI has tested exactly this commit"

	# Release only a commit CI has passed; wait for it if it is still running.
	_head=$(git rev-parse HEAD)
	_run=$(gh run list --workflow "$CI_WORKFLOW" --commit "$_head" --event push --limit 1 \
		--json databaseId,status,conclusion --jq '.[0] | "\(.databaseId) \(.status) \(.conclusion)"')
	[ -n "$_run" ] || die "no CI run found for $(git rev-parse --short HEAD) — push it and let CI run first"
	set -- $_run   # id, status, conclusion (word splitting intended)
	if [ "$2" != completed ]; then
		info "CI is still running for this commit — waiting for it"
		gh run watch "$1" --exit-status --interval 15 >/dev/null || die "CI failed for this commit: gh run view $1 --log-failed"
	elif [ "$3" != success ]; then
		die "CI did not pass for this commit ($3): gh run view $1"
	fi
	info "CI passed for $(git rev-parse --short HEAD)"
fi

if [ "$ASSUME_YES" -ne 1 ]; then
	if [ "$NO_PUBLISH" -eq 1 ]; then _what="Tag $TAG locally"; else _what="Release $TAG to GitHub and the Chrome Web Store"; fi
	printf '%s? [y/N] ' "$_what" >&2
	if [ -r /dev/tty ]; then read -r ans < /dev/tty; else read -r ans || ans=''; fi
	case "$ans" in y|Y|yes|YES) : ;; *) die "aborted by user" ;; esac
fi

# --- rollback guard: leave nothing behind if we fail before the push -------
MUTATED=0; COMMITTED=0; PUSHED=0
cleanup() {
	_rc=$?
	[ "$_rc" -ne 0 ] && [ "$PUSHED" -eq 0 ] || return 0
	if [ "$COMMITTED" -eq 1 ]; then
		warn "release failed (exit $_rc) — removing the local tag and release commit"
		git tag -d "$TAG" >/dev/null 2>&1 || true
		git reset --quiet --keep HEAD~1 || true
	elif [ "$MUTATED" -eq 1 ]; then
		warn "release failed (exit $_rc) — reverting version bump in working tree"
		git checkout -- "$MANIFEST" package.json 2>/dev/null || true
	fi
}
trap cleanup EXIT

# --- 1. bump + validate ---------------------------------------------------
info "Bumping version $CUR -> $NEW"
MUTATED=1
set_json_version "$MANIFEST" "$NEW"
[ -f package.json ] && set_json_version package.json "$NEW"
validate_manifest "$MANIFEST" "$NEW"

# --- 2. build, test, lint, package (reuses the Makefile) ------------------
info "Building, testing, and packaging in Docker via 'make package'"
make package
[ -f "$ARTIFACT" ] || die "expected artifact not produced: $ARTIFACT"

# --- 3. commit + annotated tag --------------------------------------------
info "Committing version bump and tagging $TAG"
git add "$MANIFEST"
[ -f package.json ] && git add package.json
git commit --quiet -m "Release $TAG"
COMMITTED=1
printf 'Release %s\n\n%s\n' "$TAG" "$CHANGELOG" | git tag -a "$TAG" -F -

if [ "$NO_PUBLISH" -eq 1 ]; then
	PUSHED=1   # nothing to undo: keeping the local commit and tag is the point
	info "Local release complete (--no-publish). Not pushed."
	info "To publish: git push --atomic origin $BRANCH $TAG"
	exit 0
fi

# --- 4. push: the tag starts the Release workflow -------------------------
info "Pushing $BRANCH and $TAG"
git push --atomic origin "$BRANCH" "refs/tags/$TAG"
PUSHED=1

if [ "$NO_WAIT" -eq 1 ]; then
	info "Pushed. Follow the release: gh run list --workflow $RELEASE_WORKFLOW"
	exit 0
fi

# --- 5. watch the Release workflow, then compare checksums ---------------
info "Waiting for the Release workflow to start"
_id=''
for _i in 1 2 3 4 5 6 7 8 9 10 11 12; do
	_id=$(gh run list --workflow "$RELEASE_WORKFLOW" --branch "$TAG" --limit 1 --json databaseId --jq '.[0].databaseId // empty')
	[ -n "$_id" ] && break
	sleep 5
done
[ -n "$_id" ] || die "the Release workflow did not start for $TAG — check: gh run list --workflow $RELEASE_WORKFLOW"

info "Release workflow running: $(gh run view "$_id" --json url --jq .url)"
gh run watch "$_id" --exit-status --interval 15 >/dev/null \
	|| die "the Release workflow failed: gh run view $_id --log-failed (fix, then: gh run rerun $_id --failed)"

if gh release download "$TAG" --pattern SHA256SUMS --output - | cmp -s - "$OUT_DIR/SHA256SUMS"; then
	info "CI's zip is identical to the one built here: $(cut -d' ' -f1 "$OUT_DIR/SHA256SUMS")"
else
	die "CI's SHA256SUMS differs from the local build — do not trust this release until that is explained"
fi

info "Done — released $TAG: $(gh release view "$TAG" --json url --jq .url)"
info "Submitted to the Chrome Web Store for review; it goes live when Google approves it."
