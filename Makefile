# Tabularasa Chrome Extension Makefile
#
# Every target that builds, tests or runs code does so in Docker (see the
# Dockerfile), so the host needs only Docker. git is needed for the git and
# release targets, and Chrome to run the extension.

# Variables
EXTENSION_NAME := tabularasa
VERSION := $(shell sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json | head -n 1)
OUT_DIR := out
DEV_IMAGE := tabularasa-dev
ASSETS_IMAGE := tabularasa-assets
STORE_IMAGE := tabularasa-store
# Run as the host user so files written to mounts stay the user's.
RUN_AS := --user $(shell id -u):$(shell id -g) -e HOME=/tmp
# Export a Dockerfile stage's files to a host directory.
EXPORT = docker build --target $(1) --output type=local,dest=$(2) .
# Re-run a command in the dev image whenever the sources change. Polls once a
# second: file events do not reliably cross a Docker Desktop bind mount.
ON_CHANGE = while :; do now=$$(cat src/*.ts tests/*.js | md5sum); \
	if [ "$$now" != "$$last" ]; then last=$$now; $(1); fi; sleep 1; done
# Chrome's own profile is never used: chrome-dev keeps a dedicated profile,
# chrome-clean starts from an empty one. Do not add --disable-web-security: it
# turns off the same-origin policy for every site opened in that browser, and
# the extension makes no cross-origin requests.
CHROME_PROFILE := $(CURDIR)/.chrome-profile
CHROME_FLAGS = --user-data-dir=$(1) --load-extension=$(CURDIR)/$(OUT_DIR)/extension chrome://extensions
FIND_CHROME = for c in google-chrome google-chrome-stable chromium chromium-browser \
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do \
	command -v "$$c" >/dev/null 2>&1 && { CHROME=$$c; break; }; done; \
	[ -n "$${CHROME:-}" ] || { echo "Chrome not found. Please install Google Chrome."; exit 1; }
REPRO_PLATFORM ?= linux/amd64
# Interactive (Ctrl+C stops the container) only when run from a terminal.
TTY = $$([ -t 0 ] && echo -it)

# Default target
.PHONY: help
help:
	@echo "Tabularasa Chrome Extension - Available Make targets:"
	@echo "(everything runs in Docker; the host needs only Docker)"
	@echo ""
	@echo "Build & Development:"
	@echo "  build          - Compile TypeScript into dist/ (native TypeScript 7)"
	@echo "  watch          - Recompile dist/ whenever src/ changes"
	@echo "  clean          - Clean build artifacts"
	@echo "  icons          - Generate all icon files"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  test           - Run all tests"
	@echo "  test-watch     - Re-run the tests whenever src/ or tests/ change"
	@echo "  test-coverage  - Run tests and write the coverage report to tests/coverage/"
	@echo "  lint           - Run ESLint on source files"
	@echo "  lint-fix       - Fix ESLint issues automatically"
	@echo "  audit          - Check dependencies for advisories and registry signatures"
	@echo "  verify         - Run build, lint, and test (recommended before commits)"
	@echo ""
	@echo "Chrome Development:"
	@echo "  chrome-dev     - Package, then open Chrome with a dev profile and the extension"
	@echo "  chrome-clean   - Same, with a fresh empty profile"
	@echo "  open-extensions - Open Chrome extension management page"
	@echo ""
	@echo "Package & Distribution:"
	@echo "  package        - Build, test, lint, and package into out/ (zip, unpacked, SHA256SUMS)"
	@echo "  zip            - Same as package"
	@echo "  verify-reproducible - Build twice from scratch (second on REPRO_PLATFORM) and compare"
	@echo "  store-prep     - Chrome Web Store preparation checklist"
	@echo "  validate-manifest - Validate manifest.json and the files it references"
	@echo "  screenshots    - Generate Chrome Web Store screenshots"
	@echo ""
	@echo "Git & Release:"
	@echo "  status         - Show git status and branch info"
	@echo "  push           - Push changes to remote repository"
	@echo "  changelog      - Print changelog since the last tag"
	@echo "  release        - Release: version, tag, GitHub release and Chrome Web Store (bump inferred; BUMP= overrides)"
	@echo "  release-preview - Preview next version + changelog (dry-run)"
	@echo "  release-minor / release-major / release-patch - release with that bump"
	@echo "  store-check    - Check Chrome Web Store access (needs CWS_* variables)"
	@echo "  store-publish  - Upload out/ zip to the Chrome Web Store and submit (CI does this)"
	@echo ""
	@echo "Utilities:"
	@echo "  install        - Build the development image (installs dependencies in it)"
	@echo "  update         - Update dependencies (writes package.json and package-lock.json)"
	@echo "  check-deps     - Check for outdated dependencies"
	@echo ""

# Build targets
.PHONY: build
build:
	@echo "Building TypeScript files..."
	@rm -rf dist
	@$(call EXPORT,dist,dist)

.PHONY: watch
watch: image
	@echo "Watching src/ for changes (Ctrl+C to stop)..."
	@mkdir -p dist
	@docker run --rm $(TTY) $(RUN_AS) -v "$(CURDIR)/src:/src/src:ro" -v "$(CURDIR)/tests:/src/tests:ro" \
		-v "$(CURDIR)/dist:/src/dist" $(DEV_IMAGE) \
		sh -c '$(call ON_CHANGE,tsc -p tsconfig.json && echo "$$(date +%T) compiled")'

.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist $(OUT_DIR) tests/coverage dist-package .repro
	@echo "Clean complete."

.PHONY: icons
icons: assets-image
	@echo "Generating icon files..."
	@docker run --rm $(RUN_AS) -v "$(CURDIR):/work" $(ASSETS_IMAGE) python3 icons/create_icons.py
	@echo "Icons generated successfully."

# Testing targets
.PHONY: image
image:
	@docker build --quiet --target dev --tag $(DEV_IMAGE) . >/dev/null

.PHONY: test
test: image
	@echo "Running tests..."
	@docker run --rm $(DEV_IMAGE) npm test

.PHONY: test-watch
test-watch: image
	@echo "Re-running tests when src/ or tests/ change (Ctrl+C to stop)..."
	@docker run --rm $(TTY) $(RUN_AS) -v "$(CURDIR)/src:/src/src:ro" -v "$(CURDIR)/tests:/src/tests:ro" \
		$(DEV_IMAGE) sh -c '$(call ON_CHANGE,npm test --silent -- --coverage=false)'

.PHONY: test-coverage
test-coverage:
	@echo "Running tests with coverage..."
	@rm -rf tests/coverage
	@$(call EXPORT,coverage,tests/coverage)
	@echo "Coverage report generated in tests/coverage/"

.PHONY: lint
lint: image
	@echo "Running ESLint..."
	@docker run --rm $(DEV_IMAGE) npm run lint

.PHONY: lint-fix
lint-fix: image
	@echo "Fixing ESLint issues..."
	@docker run --rm $(RUN_AS) -v "$(CURDIR)/src:/src/src" $(DEV_IMAGE) npm run lint:fix

.PHONY: audit
audit: image
	@echo "Auditing dependencies..."
	@docker run --rm $(DEV_IMAGE) sh -c 'npm audit --audit-level=high && npm audit signatures'

# Chrome development targets
# Google Chrome 137+ ignores --load-extension (Chromium still honours it), so
# with Google Chrome load out/extension once with "Load unpacked"; the dev
# profile remembers it, and its reload button picks up each new package.
.PHONY: chrome-dev
chrome-dev: package
	@echo "Starting Chrome with the dev profile ($(CHROME_PROFILE))..."
	@echo "First run with Google Chrome: enable Developer mode, click Load unpacked, choose $(OUT_DIR)/extension."
	@$(FIND_CHROME); "$$CHROME" $(call CHROME_FLAGS,$(CHROME_PROFILE))

.PHONY: chrome-clean
chrome-clean: package
	@echo "Starting Chrome with a clean profile..."
	@echo "With Google Chrome: enable Developer mode, click Load unpacked, choose $(OUT_DIR)/extension."
	@rm -rf "$(CHROME_PROFILE)-clean"
	@$(FIND_CHROME); "$$CHROME" $(call CHROME_FLAGS,$(CHROME_PROFILE)-clean)

.PHONY: open-extensions
open-extensions:
	@echo "Opening Chrome extensions page..."
	@$(FIND_CHROME); "$$CHROME" chrome://extensions/

# Package targets
# The shipped file list lives in tools/pack/main.go, which validates the
# manifest and writes a reproducible zip.
.PHONY: package
package:
	@echo "Building, testing, linting, and packaging..."
	@rm -rf $(OUT_DIR)
	@$(call EXPORT,out,$(OUT_DIR))
	@echo "Package created in $(OUT_DIR)/:"
	@cat $(OUT_DIR)/SHA256SUMS

.PHONY: zip
zip: package

# Two builds with no cache, the second for another CPU architecture by
# default, must produce the same zip.
.PHONY: verify-reproducible
verify-reproducible:
	@rm -rf .repro
	@echo "Clean build for the host platform..."
	@docker build --no-cache --target out --output type=local,dest=.repro/a . >/dev/null 2>&1
	@echo "Clean build for $(REPRO_PLATFORM)..."
	@docker build --no-cache --platform $(REPRO_PLATFORM) --target out --output type=local,dest=.repro/b . >/dev/null 2>&1
	@cat .repro/a/SHA256SUMS .repro/b/SHA256SUMS
	@cmp -s .repro/a/SHA256SUMS .repro/b/SHA256SUMS \
		&& echo "✅ Reproducible: both builds produced the same zip" \
		|| { echo "❌ The builds differ"; exit 1; }

.PHONY: store-prep
store-prep: build
	@echo "Chrome Web Store preparation checklist:"
	@echo "✅ Extension package created"
	@echo "✅ Manifest V3 compliant"
	@echo "✅ Icons generated (16, 32, 48, 128px)"
	@echo ""
	@echo "⚠️  TODO before upload:"
	@echo "  1. Create 1-5 screenshots (1280x800px)"
	@echo "  2. Write comprehensive description"
	@echo "  3. Create privacy policy"
	@echo "  4. Register Chrome Web Store developer account (\$$5)"
	@echo ""
	@echo "📖 See CHROME_STORE_GUIDE.md for detailed instructions"

.PHONY: validate-manifest
validate-manifest:
	@echo "Validating manifest.json..."
	@docker build --quiet --target manifest-check . >/dev/null && echo "✅ Manifest is valid and everything it references ships"

.PHONY: screenshots
screenshots: assets-image
	@echo "Generating Chrome Web Store screenshots..."
	@docker run --rm $(RUN_AS) -v "$(CURDIR):/work" $(ASSETS_IMAGE) python3 screenshots/capture.py

.PHONY: assets-image
assets-image:
	@docker build --quiet --target assets --tag $(ASSETS_IMAGE) . >/dev/null

# Git targets
.PHONY: status
status:
	@echo "Git status:"
	@git status --short --branch
	@echo ""
	@echo "Recent commits:"
	@git log --oneline -5

.PHONY: push
push:
	@echo "Pushing changes to remote repository..."
	@git push origin main

# Release automation (see scripts/ and the "Releasing" section of README.md).
# `make release` tags and pushes; the Release workflow does the rest. The bump
# is inferred from the commits unless BUMP is given. Pass extra flags through
# RELEASE_ARGS, e.g.:
#   make release BUMP=minor
#   make release RELEASE_ARGS="--no-publish"   # local commit + tag only
#   make release RELEASE_ARGS="--yes --no-wait"
BUMP ?=

.PHONY: changelog
changelog:
	@sh scripts/changelog.sh $(SINCE)

.PHONY: release-preview
release-preview:
	@sh scripts/release.sh $(BUMP) --dry-run

.PHONY: release
release:
	@sh scripts/release.sh $(BUMP) $(RELEASE_ARGS)

.PHONY: release-minor release-major release-patch
release-minor release-major release-patch:
	@sh scripts/release.sh $(@:release-%=%) $(RELEASE_ARGS)

# Chrome Web Store (tools/cws). CI runs store-publish with a short-lived token
# from GitHub's OIDC; locally, set CWS_ACCESS_TOKEN (e.g. from gcloud),
# CWS_PUBLISHER_ID and CWS_EXTENSION_ID.
STORE_RUN = docker run --rm -e CWS_ACCESS_TOKEN -e CWS_PUBLISHER_ID -e CWS_EXTENSION_ID \
	-v "$(CURDIR)/$(OUT_DIR):/out:ro" $(STORE_IMAGE)

.PHONY: store-image
store-image:
	@docker build --quiet --target store --tag $(STORE_IMAGE) . >/dev/null

.PHONY: store-check
store-check: store-image
	@$(STORE_RUN) -check

.PHONY: store-publish
store-publish: store-image
	@test -f $(OUT_DIR)/$(EXTENSION_NAME)-$(VERSION).zip \
		|| { echo "$(OUT_DIR)/$(EXTENSION_NAME)-$(VERSION).zip not found: run make package first"; exit 1; }
	@$(STORE_RUN) -zip /out/$(EXTENSION_NAME)-$(VERSION).zip

# Dependency management
.PHONY: install
install: image
	@echo "Development image $(DEV_IMAGE) is ready."

# Writes through cat so the host files keep their owner.
.PHONY: update
update: image
	@echo "Updating dependencies..."
	@docker run --rm -v "$(CURDIR):/host" $(DEV_IMAGE) sh -c 'npm update --no-audit --no-fund \
		&& cat package.json > /host/package.json && cat package-lock.json > /host/package-lock.json'

.PHONY: check-deps
check-deps: image
	@echo "Checking for outdated dependencies..."
	@docker run --rm $(DEV_IMAGE) npm outdated || true

# Development workflow targets
.PHONY: dev
dev: build lint test chrome-dev

.PHONY: dev-clean
dev-clean: clean build lint test chrome-clean

.PHONY: full-test
# `test` already collects coverage (tests/jest.config.js), so test-coverage
# would only run the suite a second time.
full-test: lint test

.PHONY: release-prep
release-prep: clean install build full-test package

.PHONY: verify
verify: build lint test
	@echo "✅ All checks passed - code is ready!"

# Utility targets
.PHONY: check-tools
check-tools:
	@echo "Checking required tools..."
	@command -v docker > /dev/null 2>&1 && echo "✓ Docker installed (required)" || echo "✗ Docker not found (required)"
	@docker info > /dev/null 2>&1 && echo "✓ Docker is running" || echo "✗ Docker is not running"
	@command -v git > /dev/null 2>&1 && echo "✓ Git installed (git and release targets)" || echo "✗ Git not found (git and release targets)"
	@command -v gh > /dev/null 2>&1 && echo "✓ gh installed (release targets)" || echo "✗ gh not found (release targets)"
	@$(FIND_CHROME) 2>/dev/null; [ -n "$${CHROME:-}" ] && echo "✓ Chrome installed (to run the extension)" || echo "✗ Chrome not found (to run the extension)"

.PHONY: info
info:
	@echo "Project Information:"
	@echo "  Extension Name: $(EXTENSION_NAME)"
	@echo "  Version: $(VERSION)"
	@echo "  Output Directory: $(CURDIR)/$(OUT_DIR)"
	@echo ""
	@echo "Package Information:"
	@grep -E '"name"|"version"|"description"' package.json
	@echo ""
	@echo "Git Information:"
	@git log --oneline -1 2>/dev/null || echo "  Not a git repository"
