# Chrome Web Store Submission — Copy-Paste Reference

Everything needed to fill out the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) forms
for Tabularasa. Generate the upload artifacts first:

```bash
make zip          # builds, tests, lints, then creates tabularasa-<version>.zip
make screenshots  # regenerates screenshots/*.png if needed
```

## Upload

- **Package**: `tabularasa-<version>.zip` (created in the repo root by `make zip`)

## Store Listing tab

- **Name**: Tabularasa
- **Summary** (from manifest description):
  > Advanced tab and window manager. Group, search, and bulk-manage tabs, save sessions, and remove duplicates - all stored locally.
- **Description**: use the "Enhanced Description" section of `CHROME_STORE_DESCRIPTION.md`
- **Category**: Productivity → Tools
- **Language**: English

### Graphics

- **Store icon (128x128)**: `icons/icon-128.png`
- **Screenshots (1280x800)**:
  - `screenshots/screenshot-1.png` — main interface with domain grouping
  - `screenshots/screenshot-2.png` — search/filter in action
  - `screenshots/screenshot-3.png` — bulk selection and actions
- **Small promo tile (440x280, optional)**: `screenshots/promo-small-440x280.png`

## Privacy tab

### Single purpose description

> Tabularasa helps users organize their browser tabs and windows: viewing tabs grouped
> by window, Chrome tab group, or domain, searching them, performing bulk actions (close, group, move),
> removing duplicates, and saving/restoring sessions. All functionality operates
> locally in the browser.

### Permission justifications

- **tabs**: Required to read tab titles and URLs so the manager can list, search,
  group, and de-duplicate the user's open tabs, and to close, move, and activate tabs
  on the user's request.
- **storage**: Required to save named browsing sessions locally
  (`chrome.storage.local`) so the user can restore them later. No data leaves the
  device.
- **tabGroups**: Required to display and manage Chrome's native tab groups (create,
  rename, color, ungroup) from the manager UI.
- **favicon**: Required to show each tab's site icon in the list from Chrome's local
  favicon cache (`chrome-extension://<id>/_favicon/`). This avoids requesting icons
  from websites, so listing tabs causes no network traffic.

No host permissions and no content scripts are requested. These four are the complete
list in `manifest.json`; the listing and `PRIVACY_POLICY.md` must name the same four.

### Remote code

- **Are you using remote code?** No. All JavaScript is compiled from TypeScript and
  bundled in the package; there are no external network requests.

### Data usage

- Tick **Web history** (the pages a user has visited, with associated data such as the
  title). Tabularasa reads the URLs and titles of open tabs and stores them in sessions
  the user saves. The Chrome Web Store User Data FAQ says extensions must disclose how
  they handle user data "even when data is processed or stored locally on a user's
  device and is not transmitted", and counts URLs as web browsing activity. With nothing
  ticked, the listing would state that the developer does not collect or use your data,
  next to a privacy policy that says sessions are a form of browsing history.
- Tick nothing else: no page content, no user-activity monitoring, no personally
  identifiable, authentication, financial, health, communication or location data.
- Certify all three statements: no sale or transfer of data to third parties, no use
  unrelated to the single purpose, no use for creditworthiness or lending.

### Privacy policy URL

```
https://github.com/cagedmantis/tabularasa/blob/main/PRIVACY_POLICY.md
```

(The repository must be public for this URL to work. Any other public URL hosting the
contents of `PRIVACY_POLICY.md` is fine too.)

## Distribution tab

- **Visibility**: Public
- **Pricing**: Free
- **Regions**: All regions

## Pre-submission checklist

- [ ] `make verify` passes
- [ ] `make zip` produced `tabularasa-<version>.zip`
- [ ] Permissions in `manifest.json`, the justifications above, and `PRIVACY_POLICY.md` all list the same permissions
- [ ] Every feature named in `CHROME_STORE_DESCRIPTION.md` exists in this version
- [ ] ZIP tested: load `dist-package/` as an unpacked extension in Chrome and click through the UI
- [ ] Repository is public (for the privacy policy URL)
- [ ] Developer account registered ($5 one-time fee)
