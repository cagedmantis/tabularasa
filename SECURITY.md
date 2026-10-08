# Security Policy

## Supported versions

Only the latest version published on the Chrome Web Store is supported. Fixes are released as a new version; older versions are not patched.

## Reporting a vulnerability

Please do not describe a vulnerability in a public issue.

1. Use **Report a vulnerability** under this repository's **Security** tab (GitHub private vulnerability reporting).
2. If that option is not shown, open an issue asking for a private contact, without including any details.

Please include the extension version (from `chrome://extensions`), your Chrome version, and the steps to reproduce. I aim to acknowledge reports within a week. A confirmed problem is fixed in a new version published through the Chrome Web Store, followed by a GitHub security advisory that credits you if you wish.

## Scope

Tabularasa runs entirely inside the browser. In versions after 1.0.1 it requests the `tabs`, `tabGroups`, `storage` and `favicon` permissions, has no host permissions and no content scripts, makes no network requests, and cannot run in incognito windows. Versions 1.0.0 and 1.0.1 differed in two ways: they loaded tab icons directly from websites, and they could be enabled for Incognito. Both are fixed in later versions; they are known and need not be reported. What the extension stores, and where, is described in [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

Reports of particular interest:

- Any way for a web page, or another extension, to make Tabularasa act, or to read what it stores.
- Any way for content controlled by a web page (a tab's title, URL or favicon) to be interpreted as markup or code by the manager page.
- Any network request made by the extension.
- Anything that causes incognito browsing to be listed or saved.

Out of scope:

- Someone who can already read or modify your Chrome profile directory. Saved sessions are stored unencrypted in the profile, as the privacy policy states.
- Anything that requires the user to load a modified, unpacked copy of the extension.
- Bugs in Chrome itself, including its `_favicon` endpoint; please report those to the Chromium project.
