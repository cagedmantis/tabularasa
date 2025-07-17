# Tabularasa Chrome Extension Makefile
# Common tasks for development and building

# Variables
EXTENSION_NAME := tabularasa
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
	@echo ""
	@echo "Chrome Development:"
	@echo "  chrome-dev     - Launch Chrome with extension loaded (requires Chrome to be closed)"
	@echo "  chrome-clean   - Launch Chrome with clean profile and extension"
	@echo "  open-extensions - Open Chrome extension management page"
	@echo ""
	@echo "Package & Distribution:"
	@echo "  package        - Create distribution package"
	@echo "  zip            - Create ZIP file for Chrome Web Store"
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
.PHONY: package
package: build test lint
	@echo "Creating distribution package..."
	@mkdir -p dist-package
	@cp -r $(DIST_DIR) dist-package/
	@cp manifest.json dist-package/
	@cp -r $(ICONS_DIR) dist-package/
	@cp manager.html manager.css dist-package/
	@cp popup.html popup.css dist-package/
	@cp LICENSE README.md dist-package/
	@echo "Package created in dist-package/"

.PHONY: zip
zip: package
	@echo "Creating ZIP file for Chrome Web Store..."
	@cd dist-package && zip -r ../$(EXTENSION_NAME)-$(shell date +%Y%m%d-%H%M%S).zip .
	@echo "ZIP file created: $(EXTENSION_NAME)-$(shell date +%Y%m%d-%H%M%S).zip"

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
dev: build chrome-dev

.PHONY: dev-clean
dev-clean: clean build chrome-clean

.PHONY: full-test
full-test: lint test test-coverage

.PHONY: release-prep
release-prep: clean install build full-test package

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