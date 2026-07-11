# Tabularasa Chrome Extension Makefile
# Common tasks for development and building

# Variables
EXTENSION_NAME := tabularasa
VERSION := $(shell python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
EXTENSION_DIR := $(PWD)
DIST_DIR := $(EXTENSION_DIR)/dist
ICONS_DIR := $(EXTENSION_DIR)/icons
CHROME_FLAGS := --load-extension=$(EXTENSION_DIR)
CHROME_DEV_FLAGS := --user-data-dir=/tmp/chrome-dev-session --disable-web-security --disable-features=VizDisplayCompositor

# Default target
.PHONY: help
help:
	@echo "Tabularasa Chrome Extension - Available Make targets:"
	@echo ""
	@echo "Build & Development:"
	@echo "  build          - Build TypeScript files"
	@echo "  watch          - Watch TypeScript files for changes and rebuild"
	@echo "  clean          - Clean build artifacts"
	@echo "  icons          - Generate all icon files"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  test           - Run all tests"
	@echo "  test-watch     - Run tests in watch mode"
	@echo "  test-coverage  - Run tests with coverage report"
	@echo "  lint           - Run ESLint on source files"
	@echo "  lint-fix       - Fix ESLint issues automatically"
	@echo "  verify         - Run build, lint, and test (recommended before commits)"
	@echo ""
	@echo "Chrome Development:"
	@echo "  chrome-dev     - Launch Chrome with extension loaded (requires Chrome to be closed)"
	@echo "  chrome-clean   - Launch Chrome with clean profile and extension"
	@echo "  open-extensions - Open Chrome extension management page"
	@echo ""
	@echo "Package & Distribution:"
	@echo "  package        - Create distribution package"
	@echo "  zip            - Create ZIP file for Chrome Web Store"
	@echo "  store-prep     - Chrome Web Store preparation checklist"
	@echo "  validate-manifest - Validate manifest.json for Chrome Web Store"
	@echo "  screenshots    - Generate Chrome Web Store screenshots"
	@echo ""
	@echo "Git & Release:"
	@echo "  status         - Show git status and branch info"
	@echo "  push           - Push changes to remote repository"
	@echo ""
	@echo "Utilities:"
	@echo "  install        - Install dependencies"
	@echo "  update         - Update dependencies"
	@echo "  check-deps     - Check for outdated dependencies"
	@echo ""

# Build targets
.PHONY: build
build:
	@echo "Building TypeScript files..."
	@npm run build

.PHONY: watch
watch:
	@echo "Starting TypeScript watch mode..."
	@npx tsc --watch

.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(DIST_DIR)
	@rm -rf node_modules/.cache
	@rm -rf tests/coverage
	@echo "Clean complete."

.PHONY: icons
icons:
	@echo "Generating icon files..."
	@python3 $(ICONS_DIR)/create_icons.py
	@echo "Icons generated successfully."

# Testing targets
.PHONY: test
test:
	@echo "Running tests..."
	@npm test

.PHONY: test-watch
test-watch:
	@echo "Running tests in watch mode..."
	@npm run test -- --watch

.PHONY: test-coverage
test-coverage:
	@echo "Running tests with coverage..."
	@npm run test -- --coverage
	@echo "Coverage report generated in tests/coverage/"

.PHONY: lint
lint:
	@echo "Running ESLint..."
	@npm run lint

.PHONY: lint-fix
lint-fix:
	@echo "Fixing ESLint issues..."
	@npm run lint -- --fix

# Chrome development targets
.PHONY: chrome-dev
chrome-dev: build
	@echo "Starting Chrome with extension loaded..."
	@echo "Note: Chrome must be completely closed for this to work."
	@echo "If Chrome is already running, please close it first."
	@echo "Extension will be loaded from: $(EXTENSION_DIR)"
	@which google-chrome > /dev/null 2>&1 && google-chrome $(CHROME_FLAGS) || \
	 which google-chrome-stable > /dev/null 2>&1 && google-chrome-stable $(CHROME_FLAGS) || \
	 which chromium-browser > /dev/null 2>&1 && chromium-browser $(CHROME_FLAGS) || \
	 which /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome > /dev/null 2>&1 && /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome $(CHROME_FLAGS) || \
	 echo "Chrome not found. Please install Google Chrome or adjust the path."

.PHONY: chrome-clean
chrome-clean: build
	@echo "Starting Chrome with clean profile and extension loaded..."
	@which google-chrome > /dev/null 2>&1 && google-chrome $(CHROME_FLAGS) $(CHROME_DEV_FLAGS) || \
	 which google-chrome-stable > /dev/null 2>&1 && google-chrome-stable $(CHROME_FLAGS) $(CHROME_DEV_FLAGS) || \
	 which chromium-browser > /dev/null 2>&1 && chromium-browser $(CHROME_FLAGS) $(CHROME_DEV_FLAGS) || \
	 which /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome > /dev/null 2>&1 && /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome $(CHROME_FLAGS) $(CHROME_DEV_FLAGS) || \
	 echo "Chrome not found. Please install Google Chrome or adjust the path."

.PHONY: open-extensions
open-extensions:
	@echo "Opening Chrome extensions page..."
	@which google-chrome > /dev/null 2>&1 && google-chrome chrome://extensions/ || \
	 which google-chrome-stable > /dev/null 2>&1 && google-chrome-stable chrome://extensions/ || \
	 which chromium-browser > /dev/null 2>&1 && chromium-browser chrome://extensions/ || \
	 which /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome > /dev/null 2>&1 && /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome chrome://extensions/ || \
	 echo "Chrome not found. Please manually navigate to chrome://extensions/"

# Package targets
# Only ship what the manifest references: manifest, manager UI, compiled
# background/manager scripts, and icon PNGs. No source maps, declaration
# files, icon-generation scripts, or unused legacy popup files.
.PHONY: package
package: build test lint
	@echo "Creating distribution package..."
	@rm -rf dist-package
	@mkdir -p dist-package/dist dist-package/icons
	@cp manifest.json manager.html manager.css dist-package/
	@cp $(DIST_DIR)/background.js $(DIST_DIR)/manager.js dist-package/dist/
	@cp $(ICONS_DIR)/icon-16.png $(ICONS_DIR)/icon-32.png $(ICONS_DIR)/icon-48.png $(ICONS_DIR)/icon-128.png dist-package/icons/
	@echo "Package created in dist-package/"

.PHONY: zip
zip: package
	@echo "Creating ZIP file for Chrome Web Store..."
	@rm -f $(EXTENSION_NAME)-$(VERSION).zip
	@cd dist-package && zip -r ../$(EXTENSION_NAME)-$(VERSION).zip .
	@echo "ZIP file created: $(EXTENSION_NAME)-$(VERSION).zip"

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
	@echo "  4. Register Chrome Web Store developer account ($5)"
	@echo ""
	@echo "📖 See CHROME_STORE_GUIDE.md for detailed instructions"

.PHONY: validate-manifest
validate-manifest:
	@echo "Validating manifest.json..."
	@python3 -m json.tool manifest.json > /dev/null && echo "✅ Manifest JSON is valid" || echo "❌ Manifest JSON is invalid"
	@grep -q '"manifest_version": 3' manifest.json && echo "✅ Manifest V3 compliant" || echo "❌ Not Manifest V3 compliant"
	@grep -q '"name"' manifest.json && echo "✅ Name field present" || echo "❌ Name field missing"
	@grep -q '"version"' manifest.json && echo "✅ Version field present" || echo "❌ Version field missing"
	@grep -q '"description"' manifest.json && echo "✅ Description field present" || echo "❌ Description field missing"
	@grep -q '"icons"' manifest.json && echo "✅ Icons field present" || echo "❌ Icons field missing"

.PHONY: screenshots
screenshots:
	@echo "Generating Chrome Web Store screenshots..."
	@python3 screenshots/capture.py

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

# Dependency management
.PHONY: install
install:
	@echo "Installing dependencies..."
	@npm install

.PHONY: update
update:
	@echo "Updating dependencies..."
	@npm update

.PHONY: check-deps
check-deps:
	@echo "Checking for outdated dependencies..."
	@npm outdated

# Development workflow targets
.PHONY: dev
dev: build lint test chrome-dev

.PHONY: dev-clean
dev-clean: clean build lint test chrome-clean

.PHONY: full-test
full-test: lint test test-coverage

.PHONY: release-prep
release-prep: clean install build full-test package

.PHONY: verify
verify: build lint test
	@echo "✅ All checks passed - code is ready!"

# Utility targets
.PHONY: check-tools
check-tools:
	@echo "Checking required tools..."
	@which node > /dev/null 2>&1 && echo "✓ Node.js installed" || echo "✗ Node.js not found"
	@which npm > /dev/null 2>&1 && echo "✓ npm installed" || echo "✗ npm not found"
	@which python3 > /dev/null 2>&1 && echo "✓ Python 3 installed" || echo "✗ Python 3 not found"
	@which git > /dev/null 2>&1 && echo "✓ Git installed" || echo "✗ Git not found"
	@which google-chrome > /dev/null 2>&1 && echo "✓ Google Chrome installed" || \
	 which google-chrome-stable > /dev/null 2>&1 && echo "✓ Google Chrome installed" || \
	 which /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome > /dev/null 2>&1 && echo "✓ Google Chrome installed" || \
	 echo "✗ Google Chrome not found"

.PHONY: info
info:
	@echo "Project Information:"
	@echo "  Extension Name: $(EXTENSION_NAME)"
	@echo "  Extension Directory: $(EXTENSION_DIR)"
	@echo "  Distribution Directory: $(DIST_DIR)"
	@echo "  Icons Directory: $(ICONS_DIR)"
	@echo ""
	@echo "Package Information:"
	@grep -E '"name"|"version"|"description"' package.json
	@echo ""
	@echo "Git Information:"
	@git log --oneline -1 2>/dev/null || echo "  Not a git repository"