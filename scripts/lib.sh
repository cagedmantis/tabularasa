#!/usr/bin/env sh
# lib.sh — shared helpers for Tabularasa release tooling.
#
# POSIX sh only (no bashisms). Source this file; do not execute it directly:
#     . "$(dirname "$0")/lib.sh"
#
# Functions that "return" a value print it to stdout and are meant to be called
# in a command substitution: FOO=$(json_version manifest.json). Functions that
# act (validation, guards) print diagnostics to stderr and exit non-zero via
# die() on failure.

# ---------------------------------------------------------------------------
# Logging (colour only when stderr is an interactive terminal)
# ---------------------------------------------------------------------------
if [ -t 2 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
	_C_RED=$(tput setaf 1); _C_YEL=$(tput setaf 3); _C_GRN=$(tput setaf 2); _C_RST=$(tput sgr0)
else
	_C_RED=''; _C_YEL=''; _C_GRN=''; _C_RST=''
fi

info() { printf '%s==>%s %s\n' "$_C_GRN" "$_C_RST" "$*" >&2; }
warn() { printf '%sWARN:%s %s\n' "$_C_YEL" "$_C_RST" "$*" >&2; }
err()  { printf '%sERROR:%s %s\n' "$_C_RED" "$_C_RST" "$*" >&2; }
die()  { err "$*"; exit 1; }

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || die "required tool not found on PATH: $1"
}

# ---------------------------------------------------------------------------
# Git helpers
# ---------------------------------------------------------------------------
repo_root() {
	git rev-parse --show-toplevel 2>/dev/null || die "not inside a git repository"
}

current_branch() {
	git rev-parse --abbrev-ref HEAD
}

# The remote's default branch (origin/HEAD), falling back to "main".
default_branch() {
	_b=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
	[ -n "$_b" ] || _b=main
	printf '%s' "$_b"
}

# Fail unless the release is running from the primary branch. Override the
# expected branch with RELEASE_BRANCH=<name>.
assert_on_release_branch() {
	_cur=$(current_branch)
	_want=${RELEASE_BRANCH:-$(default_branch)}
	case "$_cur" in
		"$_want"|main|master) : ;;
		*) die "releases must run from '$_want' (or main/master); current branch is '$_cur'" ;;
	esac
}

# Fail if the working tree has staged, unstaged, OR untracked changes.
assert_clean_tree() {
	[ -z "$(git status --porcelain)" ] || die \
		"working tree is not clean — commit or stash all changes (including untracked files) before releasing"
}

# ---------------------------------------------------------------------------
# JSON / version helpers (python3 for correct parsing/validation)
# ---------------------------------------------------------------------------

# Print the "version" field of a JSON file.
json_version() {
	python3 - "$1" <<'PY'
import json, sys
with open(sys.argv[1]) as fh:
    print(json.load(fh)["version"])
PY
}

# Rewrite only the "version" string in a JSON file (surgical, minimal diff).
# The regex anchors on the '"version"' key, so '"manifest_version": 3' (a
# number, and not preceded by a bare quote) is never touched.
set_json_version() {
	_f=$1; _ver=$2; _tmp="${_f}.tmp.$$"
	sed 's/\("version"[[:space:]]*:[[:space:]]*"\)[0-9][0-9.]*\("\)/\1'"$_ver"'\2/' \
		"$_f" > "$_tmp" && mv "$_tmp" "$_f" || { rm -f "$_tmp"; die "failed to update version in $_f"; }
	assert_valid_json "$_f"
}

assert_valid_json() {
	python3 - "$1" <<'PY' || die "not valid JSON: $1"
import json, sys
with open(sys.argv[1]) as fh:
    json.load(fh)
PY
}

# Validate manifest.json: valid JSON, Manifest V3, required keys present, and
# the version equals the expected release version.
validate_manifest() {
	python3 - "$1" "$2" <<'PY' || die "manifest validation failed"
import json, sys
path, want = sys.argv[1], sys.argv[2]
try:
    with open(path) as fh:
        m = json.load(fh)
except Exception as e:  # noqa: BLE001
    sys.exit("manifest.json is not valid JSON: %s" % e)

for key in ("manifest_version", "name", "version"):
    if key not in m:
        sys.exit("manifest.json is missing required MV3 key: %s" % key)

if m["manifest_version"] != 3:
    sys.exit("manifest_version must be 3, got %r" % m["manifest_version"])
if m["version"] != want:
    sys.exit("manifest version %r does not match release target %r" % (m["version"], want))
PY
}

# Compute the next version. Usage: semver_bump <major|minor|patch> <X.Y.Z>
semver_bump() {
	_type=$1; _cur=$2
	case "$_cur" in
		*.*.*.*) die "version must be strict SemVer X.Y.Z, got '$_cur'" ;;
		*.*.*) : ;;
		*) die "version must be strict SemVer X.Y.Z, got '$_cur'" ;;
	esac
	_maj=${_cur%%.*}; _rest=${_cur#*.}; _min=${_rest%%.*}; _pat=${_rest#*.}
	case "$_maj$_min$_pat" in
		*[!0-9]*) die "version has a non-numeric component: '$_cur'" ;;
	esac
	case "$_type" in
		major) _maj=$((_maj + 1)); _min=0; _pat=0 ;;
		minor) _min=$((_min + 1)); _pat=0 ;;
		patch) _pat=$((_pat + 1)) ;;
		*) die "unknown bump type '$_type' (expected major|minor|patch)" ;;
	esac
	printf '%s.%s.%s' "$_maj" "$_min" "$_pat"
}
