# Tabularasa - An Advanced Chrome Tab and Window Manager

[![CI](https://github.com/cagedmantis/tabularasa/actions/workflows/ci.yml/badge.svg)](https://github.com/cagedmantis/tabularasa/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)

Tabularasa is a powerful Chrome extension that provides comprehensive tab and window management capabilities. It offers an intuitive interface for organizing, searching, and managing your browsing sessions with advanced features like session saving, duplicate detection, and multi-window operations.

## Features

### Core Tab Management
- **Unified Tab View**: Display all tabs from all open Chrome windows in a single, organized interface
- **Smart Grouping**: Group tabs by window or by website domain with easy toggle switching
- **Real-time Updates**: Live updates as tabs are created, modified, or closed
- **Active Tab Highlighting**: Clearly identifies the currently active tab across all windows

### Advanced Search and Filtering
- **Dynamic Search**: Real-time filtering of tabs by title or URL (case-insensitive)
- **Instant Results**: Search results update as you type with highlighting
- **Clear Search**: One-click search clearing for quick reset

### Tab Actions
- **Switch to Tab**: Click any tab to instantly switch to it and focus its window
- **Close Individual Tabs**: Quick close button for each tab with visual feedback
- **Pin/Unpin Tabs**: Toggle pin status directly from the manager
- **Mute/Unmute Tabs**: Control audio playback without leaving the manager
- **Multi-selection**: Select multiple tabs using checkboxes for bulk operations

### Window Management
- **Close All Tabs in Window**: Close entire window groups with confirmation
- **Move to New Window**: Create new windows with selected tabs
- **Move to Existing Window**: Transfer tabs between existing windows
- **Duplicate Window Detection**: Identify and close duplicate windows automatically
- **New Tab Creation**: Create new blank tabs with a single click

### Session Management
- **Save Sessions**: Preserve current window state or all windows for later restoration
- **Named Sessions**: Give meaningful names to saved sessions for easy identification
- **Session Restoration**: Restore complete browsing sessions with all tab properties
- **Session Management**: View, open, and delete saved sessions from dedicated interface
- **Tab State Preservation**: Maintains pinned and muted states when restoring sessions

### Duplicate Management
- **Duplicate Detection**: Automatically identify tabs with identical URLs
- **Smart Closing**: Keep most recently accessed tabs when closing duplicates
- **Bulk Operations**: Close multiple duplicates at once with single action

### Advanced Features
- **Keyboard Shortcuts**:
  - `Ctrl/Cmd + F`: Focus search
  - `Ctrl/Cmd + A`: Select all tabs
  - `Ctrl/Cmd + N`: Create new tab
- **Performance Optimized**: Handles large numbers of tabs efficiently
- **Responsive Design**: Clean, modern interface that works at any size
- **Status Notifications**: Clear feedback for all operations
- **Error Handling**: Graceful handling of errors with user-friendly messages

## Installation Guide (Local Testing)

To test the "Tabularasa" Chrome extension locally:

1. **Download/Clone**: Download or clone the entire project directory to your local machine.

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Build Extension** (if needed):
   ```bash
   npm run build
   ```

4. **Open Chrome Extensions Page**:
   - Open your Chrome browser
   - Type `chrome://extensions` in the address bar and press Enter

5. **Enable Developer Mode**:
   - In the top-right corner of the Extensions page, toggle on "Developer mode"

6. **Load Unpacked**:
   - Click the "Load unpacked" button that appears
   - Browse to the directory where you saved the extension's files (the main folder containing `manifest.json`, `popup.html`, etc.) and select it

7. **Verify Installation**:
   - The "Tabularasa" extension should now appear in your list of installed extensions
   - A "Tabularasa" icon should appear in your Chrome toolbar

8. **Interact**:
   - Click the "Tabularasa" icon to open the tab manager popup and begin testing its features

9. **Reloading Changes**: If you make any changes to the extension's code, go back to `chrome://extensions` and click the "reload" icon (a circular arrow) next to the "Tabularasa" extension to apply the changes.

## Development

### Using the Makefile

The project includes a comprehensive Makefile for common development tasks:

```bash
# Show all available commands
make help

# Build the extension
make build

# Run tests
make test

# Generate icons
make icons

# Load extension in Chrome (requires Chrome to be closed first)
make chrome-dev

# Launch Chrome with clean profile and extension
make chrome-clean

# Create distribution package
make package

# Run full test suite with linting and coverage
make full-test
```

### Command Line Extension Loading

You can load the unpacked extension via command line using:

```bash
# Method 1: Using the Makefile (recommended)
make chrome-dev

# Method 2: Direct Chrome command (macOS)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --load-extension=/path/to/tabularasa

# Method 3: Direct Chrome command (Linux)
google-chrome --load-extension=/path/to/tabularasa
```

**Important Notes:**
- Chrome must be completely closed for command-line loading to work
- The `--load-extension` flag only works in development mode
- Extensions loaded this way are temporary and removed when Chrome restarts
- For permanent development, use the manual loading method described below

### Manual Extension Loading

For regular development work, manually load the extension:

1. Build the extension: `make build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked" and select the project directory
5. The extension will appear in your Chrome toolbar

## Usage Guide

### Basic Navigation
1. **Open Extension**: Click the Tabularasa icon in Chrome toolbar
2. **Search Tabs**: Type in the search box to filter tabs by title or URL
3. **Switch Views**: Toggle between "Windows" and "Domains" grouping
4. **Switch to Tab**: Click any tab title to navigate to it

### Tab Management
1. **Select Tabs**: Check boxes next to tabs for bulk operations
2. **Pin/Unpin**: Click the pin icon to change tab pin status
3. **Mute/Unmute**: Click the sound icon to control audio
4. **Close Tabs**: Click the × button to close individual tabs
5. **Close Groups**: Use "Close All" button in group headers

### Window Operations
1. **Move to New Window**: Select tabs and click "Move to New Window"
2. **Move to Existing Window**: Select tabs, click "Move to Existing Window", choose destination
3. **Close Duplicates**: Click "Close Duplicates" to remove tabs with identical URLs

### Session Management
1. **Save Session**: Click "Save Session" button
2. **Name Session**: Enter a descriptive name
3. **Choose Scope**: Select "Current Window" or "All Windows"
4. **Restore Session**: Go to Sessions view and click "Open" on saved session
5. **Delete Session**: Click "Delete" to remove unwanted sessions

### Keyboard Shortcuts
- **Ctrl/Cmd + F**: Focus search box
- **Ctrl/Cmd + A**: Select all visible tabs
- **Ctrl/Cmd + N**: Create new tab

## Running Tests

This extension includes comprehensive unit tests covering core functionality:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode for development
npm run test:watch
```

### Test Coverage
The test suite covers:
- Tab filtering and search logic
- Tab grouping by window and domain
- Session saving and loading mechanisms
- Duplicate detection algorithms
- URL parsing and validation
- HTML escaping and security
- Utility functions and helpers

## Releasing

Releases are automated through the `Makefile` and the POSIX helper scripts in
[`scripts/`](scripts/). The version in `manifest.json` is the single source of
truth; Git tags mirror it as `vX.Y.Z`.

### Prerequisites

- A working build toolchain: run `npm ci` first (the release builds, tests, and
  lints before packaging).
- Optional: the [GitHub CLI](https://cli.github.com/) (`gh`), authenticated. If
  present, a **draft** GitHub Release is created with the changelog and the
  packaged `.zip`. If absent, the local tag and artifact are still produced.

### Preview first (changes nothing)

```bash
make release-preview            # preview a minor bump (default)
make release-preview BUMP=major # preview a major bump
make changelog                  # print the changelog since the last tag
```

### Cut a release

```bash
make release-minor   # e.g. 1.2.3 -> 1.3.0
make release-major   # e.g. 1.2.3 -> 2.0.0
make release-patch   # e.g. 1.2.3 -> 1.2.4
```

Each release target, in order:

1. **Preflight** — verifies required tools, that you are on the primary branch
   (`main`/`master`), that the working tree is completely clean (no uncommitted
   *or* untracked files), and that the target tag does not already exist.
2. **Bumps** `manifest.json` and `package.json` to the new version.
3. **Validates** `manifest.json` — valid JSON, Manifest V3, required keys, and
   the version matches the target.
4. **Builds, tests, lints, and packages** the Web Store artifact via `make zip`
   (`tabularasa-X.Y.Z.zip`, containing only runtime files).
5. **Commits** the bump and creates an **annotated tag** whose message contains
   the changelog.
6. **Pushes** the branch and tag, and creates a **draft GitHub Release** (when
   `gh` is available) with the changelog and the `.zip` attached.

If any step before the commit fails, the working-tree version bump is rolled
back automatically.

### Flags

Pass options through `RELEASE_ARGS`:

```bash
make release-minor RELEASE_ARGS="--no-publish"  # local commit + tag + zip only
make release-major RELEASE_ARGS="--yes"         # skip the confirmation prompt
make release-patch RELEASE_ARGS="--publish"     # publish the release (not draft)
```

### Building in Docker (no Node toolchain on the host)

The `--docker` flag runs the dependency-heavy steps — `npm ci`, build, test, and
lint — inside a container instead of on your machine. Only the compiled `dist/`
is written back to the host, where the extension is packaged. `node_modules`
lives in a throwaway volume and never touches the host.

```bash
make release-patch RELEASE_ARGS="--docker"                 # build/test/lint in a container
make release-minor RELEASE_ARGS="--docker --no-publish"    # combine with other flags
make docker-build                                          # just the container build (dist/)
make docker-zip                                            # container build + host packaging
```

With `--docker`, the release host needs only **docker, git, python3, zip, and
make** (and `gh` for the GitHub release) — no Node, npm, or TypeScript install.
The image defaults to `node:22-bookworm-slim`; override it with
`NODE_IMAGE=node:20-bookworm-slim make docker-build`.

The changelog groups commits by [Conventional Commit](https://www.conventionalcommits.org/)
type (`feat`, `fix`, `docs`, …) and falls back to a plain bulleted list when the
history does not use the convention.

## Technologies Used

- **Chrome Extension APIs**: `chrome.tabs`, `chrome.windows`, `chrome.storage`, `chrome.action`
- **HTML5**: Semantic markup with accessibility features
- **CSS3**: Modern styling with flexbox and responsive design
- **Vanilla JavaScript**: ES6+ features for clean, maintainable code
- **Jest**: JavaScript testing framework with jsdom environment
- **ESLint**: Code linting for consistency and quality

## Architecture

### File Structure
```
tabularasa/
├── manifest.json          # Extension configuration
├── popup.html            # Main popup interface
├── popup.css             # Styles for popup
├── popup.js              # Main popup logic
├── background.js         # Background script (compiled from src/)
├── src/
│   ├── background.ts     # Background script source
│   └── content.ts        # Content script source
├── icons/                # Extension icons
├── tests/                # Unit tests
│   ├── popup.test.js     # Main functionality tests
│   ├── utils.test.js     # Utility function tests
│   ├── jest.config.js    # Jest configuration
│   └── setup.js          # Test setup and mocks
└── package.json          # Project configuration
```

### Key Components

1. **Popup Interface** (`popup.js`):
   - Main UI logic and event handling
   - Tab management and filtering
   - Session management interface
   - Chrome API integration

2. **Background Script** (`background.js`):
   - Extension lifecycle management
   - Real-time tab/window event handling
   - Session storage operations
   - Message passing between components

3. **Storage System**:
   - Local storage for session data
   - Efficient serialization/deserialization
   - Data validation and error handling

4. **UI Components**:
   - Responsive popup design
   - Modal dialogs for complex operations
   - Status notifications and feedback
   - Keyboard shortcut support

## Security and Privacy

- **Local Storage Only**: All data is stored locally in the browser using Chrome's storage API
- **No External Requests**: Extension does not communicate with external servers
- **Minimal Permissions**: Only requests necessary Chrome permissions
- **XSS Protection**: All user input is properly escaped and sanitized
- **Content Security Policy**: Follows Chrome extension security best practices

## Future Enhancements

- **Tab Grouping**: Support for Chrome's native tab groups
- **Export/Import**: Backup and restore session data
- **Advanced Search**: Regular expression and boolean search operators
- **Custom Themes**: User-configurable color themes
- **Statistics**: Usage analytics and browsing patterns
- **Cloud Sync**: Optional cloud synchronization of sessions
- **Automation**: Rules-based tab management
- **Integration**: Support for other browsers and bookmark management

## Performance Considerations

- **Efficient Rendering**: Virtual scrolling for large tab counts
- **Debounced Search**: Optimized search with input debouncing
- **Memory Management**: Proper cleanup of event listeners
- **Lazy Loading**: On-demand loading of tab favicons
- **Caching Strategy**: Intelligent caching of frequently accessed data

## Troubleshooting

### Common Issues

1. **Extension Not Loading**:
   - Ensure Developer Mode is enabled
   - Check console for JavaScript errors
   - Verify manifest.json is valid

2. **Tabs Not Updating**:
   - Refresh the extension from chrome://extensions
   - Check that tabs permission is granted
   - Verify background script is running

3. **Sessions Not Saving**:
   - Check Chrome storage permissions
   - Verify local storage is not full
   - Test with smaller session sizes

4. **Performance Issues**:
   - Reduce number of open tabs
   - Clear extension storage data
   - Check for memory leaks in console

### Debug Mode
Enable debug logging by opening Chrome DevTools on the extension popup and background pages.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests, please use the GitHub Issues page.

---

**Note**: This extension is designed for productivity and privacy. All operations are performed locally within your browser, ensuring your browsing data remains secure and private.
