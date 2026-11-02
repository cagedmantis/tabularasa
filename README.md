# Tabularasa - An Advanced Chrome Tab and Window Manager

[![CI](https://github.com/cagedmantis/tabularasa/actions/workflows/ci.yml/badge.svg)](https://github.com/cagedmantis/tabularasa/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/tabularasa/jogliigjiepbbemjbfefphhknoemhilp)

Tabularasa is a tab and window manager for Chrome. It opens in its own tab and shows every tab from every window in one searchable list, so you can find tabs, act on many at once, clean up duplicates, and save sets of tabs to reopen later. Everything happens inside your browser: the extension makes no network requests, and the sessions you save stay in Chrome's local storage on your device (see the [privacy policy](PRIVACY_POLICY.md)).

## Features

### Views
- **One list for every window**: all tabs from all normal windows (incognito windows are never shown)
- **Three views**: group the list by window, by Chrome tab group, or by website domain; the view button cycles through them
- **Live updates**: the list follows tabs as they open, close, move or change, and catches up when you return to a hidden manager tab
- **Markers** for the active, pinned and audible tabs

### Search and Filter
- **Search as you type** by title or URL, case-insensitive, with a button to clear it
- **Filter** to active, pinned, audible or grouped tabs

### Tab Actions
- **Switch to a tab**: click it to activate it and focus its window
- **Pin/unpin** and **mute/unmute** from the list
- **Close** a single tab, or every tab in a window, tab group or domain with its section's **Close All**
- **New tab** button

### Bulk Operations
- **Select** tabs with checkboxes, a section's **Select All**, or the global **Select All** (which selects the tabs the search and filter show)
- **Close**, **group**, **ungroup**, or **move to a new window** the selected tabs
- **Group** the selection into a named, colored Chrome tab group, one group per window

### Chrome Tab Groups
- Create groups with a name and color, **collapse/expand** them, and **ungroup** them from the list

### Duplicates
- **Close Duplicates** finds tabs open at the same URL and shows the list before closing anything
- It keeps one copy of each, preferring a pinned, then active, audible or grouped tab, then the most recently used one

### Safety
- Closing 10 or more tabs at once, or tabs hidden by the current search or filter, asks first
- Closed tabs can be reopened with **Undo** for about ten seconds

### Sessions
- **Save** the current window or all windows under a name
- **Restore** reopens each window with its tabs in order, including pinned and muted state and tab groups
- **Manage** saved sessions (open or delete) in the Sessions view
- Only web pages (`http`, `https`) and local files (`file`) are saved; browser and extension pages are left out

### Keyboard Shortcuts
Active when the focus is not in a text field:
- `Ctrl/Cmd + F`: focus the search box
- `Ctrl/Cmd + A`: select all tabs the search and filter show
- `Ctrl/Cmd + G`: group the selected tabs

## Installation Guide (Local Testing)

The only thing you need installed is [Docker](https://docs.docker.com/get-docker/).
Every build, test and lint runs in a container defined by the
[`Dockerfile`](Dockerfile); Node, npm, TypeScript and Go never touch your
machine.

1. **Clone** the repository.

2. **Build the extension**:
   ```bash
   make package
   ```
   This compiles, tests, lints and packages the extension into `out/`:
   - `out/extension/` — the unpacked extension, exactly the files that ship
   - `out/tabularasa-<version>.zip` — the Chrome Web Store package
   - `out/SHA256SUMS` — its checksum

3. **Load it in Chrome**:
   - Open `chrome://extensions` and toggle on **Developer mode** (top right)
   - Click **Load unpacked** and choose the `out/extension` folder

4. **Interact**: click the Tabularasa icon in the toolbar to open the tab
   manager in a new tab.

5. **Reloading changes**: run `make package` again, then click the reload icon
   (a circular arrow) next to Tabularasa on `chrome://extensions`.

## Development

### Using the Makefile

Each target runs in Docker. `make help` lists them all.

```bash
make verify         # compile, lint and test (run before committing)
make package        # compile, test, lint and package into out/
make test           # run the tests
make test-watch     # re-run the tests whenever src/ or tests/ change
make build          # compile into dist/
make watch          # recompile dist/ whenever src/ changes
make lint-fix       # fix lint issues in src/
make chrome-dev     # package, then open Chrome with a dev profile
make full-test      # lint and test
```

### Loading the Extension from the Command Line

`make chrome-dev` packages the extension and opens Chrome with a dedicated
profile (`.chrome-profile/`), so your own profile is never touched. Chromium
loads `out/extension` automatically. Google Chrome 137 and later ignore the
`--load-extension` flag, so the first time choose **Load unpacked** →
`out/extension`; the dev profile remembers it from then on, and its reload
button picks up each new `make package`. `make chrome-clean` does the same with
a fresh, empty profile.

### How the Build Works

The [`Dockerfile`](Dockerfile) is the single definition of the build, used both
locally and in CI:

- **Compile** — the shipped JavaScript is compiled by the native (Go)
  TypeScript 7 compiler, downloaded from Microsoft's release and verified by
  checksum. No npm package ships: the output is two plain browser scripts.
- **Test and lint** — Jest and ESLint, installed by `npm ci` from the lockfile
  with install scripts disabled (`.npmrc`). They still need the TypeScript 6
  JS API, which TypeScript 7 does not provide yet.
- **Package** — a small Go program ([`tools/pack`](tools/pack)) validates the
  manifest and every file it and `manager.html` reference, then writes the
  zip. Its file list is the definition of what ships.

### Reproducible Builds

The same commit produces the same zip, byte for byte, on any machine and CPU
architecture: base images are pinned by digest, npm packages by the
lockfile's integrity hashes, the compiler by checksum, and the zip has fixed
timestamps, modes and file order. CI builds on x64 and ARM64 and fails if the
two zips differ. To check locally:

```bash
make verify-reproducible                          # two clean builds, compared
make verify-reproducible REPRO_PLATFORM=linux/arm64
```

Anyone can confirm that a published zip was built from a given commit by
running `make package` on that commit and comparing `out/SHA256SUMS`.

## Usage Guide

### Basic Navigation
1. **Open the manager**: click the Tabularasa icon in the toolbar. It opens in a new tab, or switches to the manager tab if one is already open
2. **Search**: type in the search box to filter tabs by title or URL
3. **Switch views**: the view button cycles between window, tab group and domain views
4. **Switch to a tab**: click its title

### Tab Management
1. **Select tabs**: tick the checkboxes for bulk operations
2. **Pin/unpin** and **mute/unmute**: use the buttons on the tab's row
3. **Close tabs**: click a tab's × button, or a section's **Close All**
4. **Group**: select tabs, click **Group Selected**, choose a name and color
5. **Move**: select tabs and click **Move to New Window**
6. **Close duplicates**: click **Close Duplicates**, review the list, confirm

### Sessions
1. **Save**: click **Save Session**, enter a name, choose **Current Window** or **All Windows**
2. **Restore**: open the Sessions view and click **Open** on a saved session
3. **Delete**: click **Delete** on a session you no longer want

## Running Tests

This extension includes comprehensive unit tests covering core functionality:

```bash
# Run all tests
make test

# Run tests and write the HTML coverage report to tests/coverage/
make test-coverage

# Re-run the tests whenever src/ or tests/ change
make test-watch
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

- Docker, git and make. The build runs in Docker, so no Node, npm or
  TypeScript install is needed.
- Optional: the [GitHub CLI](https://cli.github.com/) (`gh`), authenticated. If
  present, a **draft** GitHub Release is created with the changelog, the
  packaged `.zip` and its `SHA256SUMS`. If absent, the local tag and artifact
  are still produced.

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
3. **Checks** that the manifest version matches the target.
4. **Builds, tests, lints, validates, and packages** the Web Store artifact in
   Docker via `make package` (`out/tabularasa-X.Y.Z.zip`, containing only
   runtime files, plus `out/SHA256SUMS`).
5. **Commits** the bump and creates an **annotated tag** whose message contains
   the changelog.
6. **Pushes** the branch and tag, and creates a **draft GitHub Release** (when
   `gh` is available) with the changelog, the `.zip` and `SHA256SUMS`
   attached.

If any step before the commit fails, the working-tree version bump is rolled
back automatically.

### Flags

Pass options through `RELEASE_ARGS`:

```bash
make release-minor RELEASE_ARGS="--no-publish"  # local commit + tag + zip only
make release-major RELEASE_ARGS="--yes"         # skip the confirmation prompt
make release-patch RELEASE_ARGS="--publish"     # publish the release (not draft)
```

The changelog groups commits by [Conventional Commit](https://www.conventionalcommits.org/)
type (`feat`, `fix`, `docs`, …) and falls back to a plain bulleted list when the
history does not use the convention.

## Technologies Used

- **Chrome Extension APIs** (Manifest V3): `chrome.tabs`, `chrome.windows`, `chrome.tabGroups`, `chrome.storage.local`, `chrome.action`, and Chrome's local favicon cache
- **TypeScript**: compiled by the native TypeScript 7 compiler, with no runtime dependencies or bundler
- **HTML and CSS**: one manager page, no frameworks
- **Jest** with jsdom, and **ESLint**, for tests and linting (development only; nothing from npm ships)
- **Go**: the packaging tool that validates the manifest and writes the reproducible zip

## Architecture

### File Structure
```
tabularasa/
├── manifest.json          # Extension configuration
├── manager.html           # Tab manager page (opens in a new tab)
├── manager.css            # Styles for the manager page
├── src/
│   ├── manager.ts         # TabManager class (manager page logic)
│   └── background.ts      # Background service worker source
├── dist/                  # Compiled JavaScript (build output)
├── icons/                 # Extension icons
├── tests/                 # Unit tests
│   ├── manager.test.js    # TabManager behavior tests
│   ├── background.test.js # Service worker tests
│   ├── jest.config.js     # Jest configuration
│   └── setup.js           # Test setup and Chrome API mocks
└── package.json           # Project configuration
```

### Key Components

1. **Manager Page** (`src/manager.ts`):
   - Main UI logic and event handling
   - Tab management and filtering
   - Session management interface
   - Chrome API integration

2. **Background Service Worker** (`src/background.ts`):
   - Extension lifecycle management (install, toolbar click)
   - Stays asleep otherwise: the manager page listens to tab, window and
     group events itself

3. **Storage**:
   - Saved sessions in `chrome.storage.local`, on the device only
   - Malformed stored data is treated as no sessions rather than trusted
   - The open manager tab keeps its view, filter and search text in `sessionStorage`

4. **UI Components**:
   - Full-page manager UI
   - Modal dialogs for complex operations
   - Status notifications and feedback
   - Keyboard shortcut support

## Security and Privacy

- **No network requests**: the extension contacts no server; favicons come from Chrome's local cache
- **Local storage only**: saved sessions live in `chrome.storage.local`; nothing is synced or sent anywhere
- **No analytics or tracking**, and no remote code: everything that runs ships in the package
- **Minimal permissions**: `tabs`, `tabGroups`, `storage` and `favicon`; no host permissions and no content scripts
- **No incognito access**: the manifest declares `"incognito": "not_allowed"`
- **Strict Content Security Policy** on extension pages; tab titles, URLs and session names are set with `textContent`, never parsed as HTML
- **Restored URLs are restricted** to `http`, `https` and `file`

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) and [SECURITY.md](SECURITY.md).

## Future Enhancements

Ideas, not commitments. All of them would stay local to the device:

- **Export/Import**: back up and restore saved sessions as a file
- **Advanced Search**: regular expressions and boolean operators
- **Custom Themes**: user-configurable colors
- **Automation**: rules-based tab management

## Performance

- **Coalesced updates**: bursts of tab events cause at most one refresh every 150 ms
- **Row reuse**: rows whose content did not change are kept instead of rebuilt
- **Debounced search**: the list is filtered 100 ms after typing stops
- **Paused when hidden**: a hidden manager tab does no work and catches up when shown
- **Idle service worker**: the background worker runs only on install/update and toolbar clicks

## Troubleshooting

### Common Issues

1. **Extension Not Loading**:
   - Ensure Developer Mode is enabled
   - Check console for JavaScript errors
   - Verify manifest.json is valid

2. **Tabs Not Updating**:
   - Click the refresh button in the manager
   - Reload the extension from chrome://extensions
   - Check the manager tab's DevTools console for errors (the manager page, not the service worker, listens for tab events)

3. **Sessions Not Saving**:
   - Browser pages (such as `chrome://` pages) are never saved; if nothing is left, the manager says "No tabs that can be saved"
   - Check the manager tab's DevTools console for storage errors

4. **Performance Issues**:
   - Open an issue with the number of tabs and windows, and a DevTools performance profile of the manager tab if you can

### Debug Mode
Enable debug logging by opening Chrome DevTools on the manager tab and the background service worker (from chrome://extensions).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

Apache License 2.0 - see LICENSE file for details

## Support

For issues, questions, or feature requests, please use the GitHub Issues page.

---

**Note**: All operations happen locally in your browser. The extension makes no network requests, and saved sessions never leave your device.
