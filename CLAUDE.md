# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tabularasa is a Chrome extension that provides advanced tab and window management capabilities. It's built with TypeScript, uses Manifest V3, and focuses on privacy (all data stays local).

## Development Commands

### Essential Commands
- `make verify` - **Run before committing** (build + lint + test)
- `make dev` - Build, lint, test, then launch Chrome with extension
- `make chrome-dev` - Load extension in Chrome for testing

### Build & Quality
- `npm run build` / `make build` - Compile TypeScript to JavaScript
- `npm run lint` / `make lint` - Run ESLint on TypeScript files
- `npm test` / `make test` - Run Jest tests
- `npm run lint:fix` / `make lint-fix` - Auto-fix linting issues

### Other Commands
- `make package` - Create distribution package
- `make screenshots` - Generate Chrome Web Store screenshots
- `make help` - Show all available commands

## Project Structure

### Core Files
- `src/manager.ts` - **Main TabManager class** (most important file)
- `src/background.ts` - Background service worker
- `src/content.ts` - Content script (minimal)
- `manifest.json` - Chrome extension configuration (Manifest V3)
- `manager.html` + `manager.css` - Extension UI

### Build & Config
- `dist/` - Compiled JavaScript output
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.js` - ESLint rules for code quality
- `package.json` - Dependencies and scripts
- `Makefile` - Development workflow commands

### Documentation & Store
- `CHROME_STORE_DESCRIPTION.md` - Chrome Web Store listing
- `PRIVACY_POLICY.md` - Privacy policy (no data collection)
- `screenshots/` - Chrome Web Store screenshot tools

## Development Workflow

### Before Making Changes
**ALWAYS run:** `make verify` to ensure build, lint, and tests pass

### Code Standards
- All TypeScript code must pass ESLint with zero warnings
- Use `console.warn()` or `console.error()` instead of `console.log()`
- Prefer explicit types over `any`
- Always add curly braces to if statements
- Use `const` when variables aren't reassigned

### Adding Tab Operations
1. Add method to `TabManager` class in `src/manager.ts`
2. Include error handling with try/catch
3. Call `this.refreshTabs()` after successful operations
4. Show user feedback with `this.showStatusMessage()`
5. Run `make verify` before committing

## Architecture Notes

### Current Design
- **Extension opens in new tab** (not popup) when toolbar icon clicked
- Uses Manifest V3 service worker pattern
- `TabManager` class handles all tab operations
- Real-time updates via Chrome event listeners
- Privacy-first: all data stays local (no external servers)

### Key Features
- View tabs grouped by window or domain
- Search/filter tabs by title or URL
- Multi-select with bulk operations
- Session save/restore functionality
- Duplicate tab detection and removal
- Chrome tab groups integration

### Storage
- Local storage only (`chrome.storage.local`)
- Session data format defined in `SessionInfo` interface
- No analytics or external data transmission

## Testing & Quality

### Current Test Status
- `tests/core.test.js` ✅ - Core functionality tests (working)
- `tests/utils.test.js` ✅ - Utility function tests (working)
- `tests/popup.test.js` ⏸️ - Legacy tests (skipped - needs TypeScript migration)
- `tests/manager.test.ts` ❌ - TypeScript tests (disabled - import issues)

### Running Tests
- `make test` - Run all tests
- `make verify` - Full quality check (recommended)
- 37 passing tests, 16 skipped legacy tests

## Chrome Extension Setup

1. Run `make build` to compile TypeScript
2. Load the extension: `make chrome-dev` (or manual chrome://extensions/)
3. Click Tabularasa icon in toolbar to open

## Common Issues & Solutions

### UI Not Updating
- Always call `this.refreshTabs()` after tab operations
- Example: After closing duplicates, refresh the display

### Testing
- Focus on `core.test.js` and `utils.test.js` for now
- TypeScript test integration needs work

### Chrome API Patterns
- Wrap all Chrome API calls in try/catch blocks
- Handle race conditions (tabs closing during operations)
- Use event listeners for real-time updates

## Privacy & Security Guidelines

- Never add external network requests
- Keep all data processing local
- No analytics or tracking code
- Validate and sanitize all user inputs
- Use `chrome.storage.local` only (never sync or external storage)