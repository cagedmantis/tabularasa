# Tabularasa - An Advanced Chrome Tab and Window Manager

[![CI](https://github.com/cagedmantis/tabularasa/actions/workflows/ci.yml/badge.svg)](https://github.com/cagedmantis/tabularasa/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/tabularasa/jogliigjiepbbemjbfefphhknoemhilp)

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

One command releases the extension everywhere:

```bash
make release
```

It asks once, then: GitHub release published, package submitted to the Chrome
Web Store for review. It goes live when Google approves it.

The version in `manifest.json` is the single source of truth; Git tags mirror
it as `vX.Y.Z`. The bump is inferred from the
[Conventional Commits](https://www.conventionalcommits.org/) since the last
tag: a breaking change (`feat!:` or a `BREAKING CHANGE:` footer) is major, a
`feat` minor, anything else patch.

### Prerequisites

- Docker, git, make, and the [GitHub CLI](https://cli.github.com/) (`gh`),
  authenticated. No Node, npm or TypeScript install is needed.
- The one-time store setup below.

### Preview first (changes nothing)

```bash
make release-preview             # the inferred bump and the changelog
make release-preview BUMP=major  # with a specific bump
make changelog                   # the changelog since the last tag
```

### What `make release` does

On your machine ([`scripts/release.sh`](scripts/release.sh)):

1. **Preflight** — on `main`, clean tree (no uncommitted *or* untracked files),
   in sync with `origin/main`, CI passed for this exact commit (it waits if CI
   is still running), the tag is free, and there are commits to release.
2. **Bumps** `manifest.json` and `package.json`, then builds, tests, lints and
   packages in Docker (`make package`) as a final local check.
3. **Commits** the bump and creates an **annotated tag** whose message is the
   changelog, then **pushes both together**.
4. **Watches** the Release workflow and, when it finishes, checks that CI's
   zip has the same SHA-256 as the one built locally.

In GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)),
started by the tag:

1. **CI** — the full CI workflow: builds on x64 and ARM64, which must produce
   the same zip, plus the dependency audit.
2. **GitHub release** — a signed build provenance attestation for the zip,
   then the release with the zip and `SHA256SUMS`, notes taken from the tag.
3. **Chrome Web Store** — a short-lived Google token through Workload Identity
   Federation (no stored keys), then [`tools/cws`](tools/cws) uploads the zip,
   waits for the store to process it, and submits it for review.

A failure before the push leaves no bump, commit or tag behind. A failure in
the workflow can be re-run (`gh run rerun <id> --failed`): publishing the
GitHub release and the store submission both skip what is already done.

### Options

```bash
make release BUMP=minor                     # choose the bump
make release-patch                          # same as BUMP=patch (also -minor, -major)
make release RELEASE_ARGS="--no-publish"    # local commit + tag only, nothing pushed
make release RELEASE_ARGS="--yes --no-wait" # no prompt; return after pushing
```

### Verifying a release

```bash
gh attestation verify tabularasa-X.Y.Z.zip -R cagedmantis/tabularasa
```

Or rebuild it: `git checkout vX.Y.Z && make package`, then compare
`out/SHA256SUMS` with the release's.

### One-time Chrome Web Store setup

Publishing uses a Google service account that GitHub Actions impersonates
through OpenID Connect, so no credential is stored in GitHub or on a laptop.
The extension must already exist in the store (the first version is uploaded
by hand in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole)).

1. **Google Cloud.** gcloud runs in Docker, so nothing is installed:

   ```bash
   alias gcloud='docker run --rm -it -v gcloud-config:/root/.config google/cloud-sdk:slim gcloud'
   gcloud auth login
   PROJECT=tabularasa-release            # an existing or new project
   gcloud projects create "$PROJECT"     # skip if it exists
   gcloud config set project "$PROJECT"
   gcloud services enable chromewebstore.googleapis.com iamcredentials.googleapis.com sts.googleapis.com
   gcloud iam service-accounts create cws-publisher --display-name="Chrome Web Store publisher"

   # Trust GitHub's tokens, but only from this repository's main branch and v* tags.
   gcloud iam workload-identity-pools create github --location=global
   gcloud iam workload-identity-pools providers create-oidc tabularasa \
     --location=global --workload-identity-pool=github \
     --issuer-uri=https://token.actions.githubusercontent.com \
     --attribute-mapping='google.subject=assertion.sub,attribute.repository=assertion.repository' \
     --attribute-condition="assertion.repository_owner_id == '146817' && assertion.repository == 'cagedmantis/tabularasa' && (assertion.ref == 'refs/heads/main' || assertion.ref.startsWith('refs/tags/v'))"

   PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)' | tr -d '\r')
   gcloud iam service-accounts add-iam-policy-binding "cws-publisher@$PROJECT.iam.gserviceaccount.com" \
     --role=roles/iam.workloadIdentityUser \
     --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/cagedmantis/tabularasa"
   echo "provider: projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/tabularasa"
   ```

2. **Chrome Web Store.** In the Developer Dashboard, under **Account**, add
   `cws-publisher@<project>.iam.gserviceaccount.com` as the service account.
   Note the **publisher ID** (Account / Settings) and the extension's **item ID**.

3. **GitHub.** An environment that only `main` and `v*` tags can use, holding
   the four settings as variables (none of them is a secret):

   ```bash
   R=repos/cagedmantis/tabularasa
   gh api -X PUT $R/environments/chrome-web-store --input - <<'EOF'
   {"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
   EOF
   gh api -X POST $R/environments/chrome-web-store/deployment-branch-policies -f name=main -f type=branch
   gh api -X POST $R/environments/chrome-web-store/deployment-branch-policies -f name='v*' -f type=tag
   gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --env chrome-web-store --body "projects/<number>/locations/global/workloadIdentityPools/github/providers/tabularasa"
   gh variable set GCP_SERVICE_ACCOUNT --env chrome-web-store --body "cws-publisher@<project>.iam.gserviceaccount.com"
   gh variable set CWS_PUBLISHER_ID --env chrome-web-store --body "<publisher id>"
   gh variable set CWS_EXTENSION_ID --env chrome-web-store --body "<item id>"
   ```

4. **Dry run.** `gh workflow run release.yml --ref main`, then watch it with
   `gh run watch`. It runs CI and checks store access without publishing; the
   store step prints the current published and submitted versions.

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

3. **Storage System**:
   - Local storage for session data
   - Efficient serialization/deserialization
   - Data validation and error handling

4. **UI Components**:
   - Full-page manager UI
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

**Note**: This extension is designed for productivity and privacy. All operations are performed locally within your browser, ensuring your browsing data remains secure and private.
