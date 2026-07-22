#!/usr/bin/env sh
# release.sh — cut a versioned, tagged, packaged release of the extension.
#
# Usage:
#   scripts/release.sh <major|minor|patch> [options]
#
# Options:
#   --dry-run       Preview the new version and changelog; change nothing.
#   --yes, -y       Skip the interactive confirmation (for automation/CI).
#   --no-publish    Do the local bump/commit/tag/package but do not push or
#                   create a GitHub release.
#   --publish       Publish the GitHub release immediately (default: draft).
#
# What a real release does, in order:
#   1. Preflight: required tools, on release branch, clean tree, tag is free.
#   2. Compute the target version from manifest.json and the changelog.
#   3. Bump manifest.json + package.json, then validate the manifest (JSON +
#      required Manifest V3 keys + version match).
#   4. Build, test, lint, and package a Web Store zip via `make zip`.
#   5. Commit the bump and create an annotated tag containing the changelog.
#   6. Push branch + tag, and (if `gh` is available) create a GitHub release
#      with the changelog as notes and the zip attached.
#
# Safety: any failure before the commit rolls back the working-tree bump.
set -eu

_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
. "$_dir/lib.sh"

ARTIFACT_BASE=tabularasa   # matches EXTENSION_NAME in the Makefile
MANIFEST=manifest.json

usage() {
	sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
}

# --- parse arguments ------------------------------------------------------
BUMP=''
DRY=0; ASSUME_YES=0; NO_PUBLISH=0; DRAFT=1
for arg in "$@"; do
	case "$arg" in
		major|minor|patch) BUMP=$arg ;;
		--dry-run)   DRY=1 ;;
		--yes|-y)    ASSUME_YES=1 ;;
		--no-publish) NO_PUBLISH=1 ;;
		--publish)   DRAFT=0 ;;
		-h|--help)   usage; exit 0 ;;
		*) die "unknown argument: '$arg' (see --help)" ;;
	esac
done
[ -n "$BUMP" ] || { usage; exit 2; }

require_cmd git
require_cmd python3
cd "$(repo_root)"
[ -f "$MANIFEST" ] || die "$MANIFEST not found at repo root"

# --- compute version + changelog (read-only) ------------------------------
CUR=$(json_version "$MANIFEST")
NEW=$(semver_bump "$BUMP" "$CUR")
TAG="v$NEW"
ARTIFACT="${ARTIFACT_BASE}-${NEW}.zip"
PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || true)
CHANGELOG=$("$_dir/changelog.sh" "${PREV_TAG:-}")

# --- preview --------------------------------------------------------------
info "Release preview"
printf '  current version : %s\n'         "$CUR" >&2
printf '  new version     : %s  (%s)\n'   "$NEW" "$BUMP" >&2
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
require_cmd npm
require_cmd zip
assert_on_release_branch
assert_clean_tree
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null 2>&1 && die "tag $TAG already exists"

if [ "$ASSUME_YES" -ne 1 ]; then
	printf 'Proceed with release %s? [y/N] ' "$TAG" >&2
	if [ -r /dev/tty ]; then read -r ans < /dev/tty; else read -r ans || ans=''; fi
	case "$ans" in y|Y|yes|YES) : ;; *) die "aborted by user" ;; esac
fi

# --- rollback guard: undo the working-tree bump if we fail pre-commit ------
MUTATED=0; COMMITTED=0
cleanup() {
	_rc=$?
	if [ "$_rc" -ne 0 ] && [ "$MUTATED" -eq 1 ] && [ "$COMMITTED" -eq 0 ]; then
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
info "Building, testing, and packaging via 'make zip'"
make zip
[ -f "$ARTIFACT" ] || die "expected artifact not produced: $ARTIFACT"

# --- 3. commit + annotated tag --------------------------------------------
info "Committing version bump and tagging $TAG"
git add "$MANIFEST"
[ -f package.json ] && git add package.json
# The build/test step can regenerate tracked artifacts (e.g. tests/coverage/*).
# Restore every unstaged tracked change so the commit is exactly the version
# bump and the working tree is left clean for the next release. Safe because a
# clean tree was a precondition, so nothing else of value is unstaged here.
git checkout -- . 2>/dev/null || true
git commit -m "Release $TAG"
COMMITTED=1
printf 'Release %s\n\n%s\n' "$TAG" "$CHANGELOG" | git tag -a "$TAG" -F -

if [ "$NO_PUBLISH" -eq 1 ]; then
	info "Local release complete (--no-publish). Not pushed."
	info "To finish:  git push origin $(current_branch) --follow-tags"
	info "            gh release create $TAG \"$ARTIFACT\" --title \"$TAG\" --notes \"...\""
	exit 0
fi

# --- 4. push --------------------------------------------------------------
info "Pushing branch and tag to origin"
git push origin "$(current_branch)"
git push origin "$TAG"

# --- 5. GitHub release (optional) -----------------------------------------
if command -v gh >/dev/null 2>&1; then
	info "Creating GitHub release ($([ "$DRAFT" -eq 1 ] && echo draft || echo published))"
	_notes=$(mktemp "${TMPDIR:-/tmp}/tabularasa-notes.XXXXXX")
	printf '%s\n' "$CHANGELOG" > "$_notes"
	if [ "$DRAFT" -eq 1 ]; then _draft=--draft; else _draft=''; fi
	if gh release create "$TAG" "$ARTIFACT" --title "$TAG" --notes-file "$_notes" $_draft; then
		info "GitHub release created for $TAG"
	else
		warn "gh release failed — create it manually:"
		warn "  gh release create $TAG \"$ARTIFACT\" --title \"$TAG\" --notes-file <notes>"
	fi
	rm -f "$_notes"
else
	warn "gh CLI not found — skipping GitHub release. Artifact: $ARTIFACT"
fi

info "Done — released $TAG."
