# Chrome Web Store Description for Tabularasa

The text for the Store Listing tab of the Developer Dashboard. See
`STORE_SUBMISSION.md` for the other tabs.

## Summary

Chrome takes the summary from `"description"` in `manifest.json` (limit: 132
characters; the current one is 128):

> Advanced tab and window manager. Group, search, and bulk-manage tabs, save sessions, and remove duplicates - all stored locally.

## Detailed Description

The store shows this field as plain text: Markdown is not rendered, so the
text below uses none. Paste everything inside the block, as it is.

Before pasting, check that every statement is still true of the version being
submitted. In particular, "nothing leaves your device" and the permission list
must match `manifest.json` and `PRIVACY_POLICY.md`.

```text
Tabularasa is a tab and window manager for Chrome. It opens in its own tab and shows every tab from every window in one searchable list.

Find the tab you want by typing, clean up duplicates and whole websites at once, and save sets of tabs to come back to later. Everything happens inside your browser.

VIEW AND FIND TABS
- Three views: tabs grouped by window, by Chrome tab group, or by website domain
- Search as you type, by title or address. Capitalization does not matter, and part of a word or address is enough
- Filter to active, pinned, audible (playing sound) or grouped tabs
- Active, pinned and audible tabs are marked in the list
- The list updates live as tabs open, close and move

WORK ON MANY TABS AT ONCE
- Select tabs with checkboxes, or a whole section with its Select All button, across windows and domains
- Close, group, ungroup, or move the selected tabs to a new window
- Turn the selection into a Chrome tab group with a name and color (one group per window)
- Pin, mute, or switch to any tab from the list
- Keyboard shortcuts for search, select all and grouping

CHROME TAB GROUPS
- Create groups with a name and color, collapse or expand them, and ungroup them, without leaving the list

CLEAN UP
- Close Duplicates finds tabs open more than once at the same address and closes the extra copies. You see the list before anything closes. One copy of each is kept, preferring a pinned, active, playing or grouped tab, then the one used most recently
- Close every tab of one window, tab group or website with one button
- Closing 10 or more tabs at once, or tabs hidden by the current search or filter, asks first
- Closed tabs can be reopened with Undo for about ten seconds

SAVED SESSIONS
- Save the current window or all windows under a name you choose
- Restoring reopens each window with its tabs in order, including pinned and muted tabs and tab groups
- Keep several named sessions, each showing the date it was saved; delete them whenever you like
- Sessions keep web pages and local files only; browser pages such as settings are not saved

PRIVACY
- Nothing leaves your device: the extension makes no network requests, has no servers, and contains no analytics or tracking
- Saved sessions stay in Chrome's local extension storage on your device. Uninstalling the extension deletes them
- It cannot run in, see, or save incognito windows
- Permissions: tabs, tab groups, storage and favicon. No host permissions and no content scripts, so it cannot read or change the content of any web page
- About Chrome's install warning: Chrome describes the tabs permission as "Read your browsing history", because the addresses of open tabs are browsing activity. Tabularasa sees only the tabs that are open now, not the pages you visited before
- Privacy policy: https://github.com/cagedmantis/tabularasa/blob/main/PRIVACY_POLICY.md

LIGHTWEIGHT
- No background activity: the background service worker wakes only when you click the toolbar button (and when the extension is installed or updated)
- The list stops updating while the manager tab is hidden and catches up when you return to it

OPEN SOURCE AND FREE
- Open source under the Apache 2.0 license: https://github.com/cagedmantis/tabularasa
- Automated tests run against the extension's real code on every change
- Free, with no premium tier, account, or ads

GETTING STARTED
1. Click the Tabularasa icon in the toolbar. The manager opens in a new tab, or switches to it if it is already open
2. Type in the search box, or use the view button to switch between window, tab group and domain views
3. Tick tabs to work on several at once
4. Use Save Session to keep the current window or all windows for later

SUPPORT
Questions, bug reports and feature requests: https://github.com/cagedmantis/tabularasa/issues

Requires Chrome 104 or later.
```
