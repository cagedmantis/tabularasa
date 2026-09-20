# Privacy Policy for Tabularasa Chrome Extension

**Effective Date**: July 2025  
**Last Updated**: September 2026

## Overview

Tabularasa is a Chrome extension that helps you manage your browser tabs and windows. It works entirely inside your browser. This policy describes exactly what it reads, what it stores, and where.

## Summary

- Tabularasa **sends nothing to the developer or to any third party**: it has no servers and includes no analytics, tracking, or third-party code.
- Versions after 1.0.1 make **no network requests at all**. Versions 1.0.0 and 1.0.1 made one kind of request: they loaded each tab's icon from its website (see "Favicons").
- It **reads** information about your open tabs in order to show and manage them.
- It **stores** only two things, both on your device: the sessions you choose to save, and the view settings of an open manager tab.
- Nothing is sent to, or available to, the developer.

## What Tabularasa Reads

### Tab and Window Information
- **What**: For every open tab: its title, URL, favicon address, position, window, and state (active, pinned, muted, audible, tab group). For every window: its type and whether it is focused.
- **Why**: To list, search, filter, group, move, close, and de-duplicate your tabs.
- **Where it goes**: It is held in the memory of the manager page while that page is open, and discarded when the page closes. It is written to disk only as part of a session you save (see below).

### Chrome Tab Groups
- **What**: Group names, colors, collapsed state, and which tabs belong to each group.
- **Why**: To display and manage Chrome's native tab groups.
- **Where it goes**: Memory only, except for the name and color of groups in a session you save.

### Favicons
- **What**: The small site icons shown next to each tab.
- **Versions after 1.0.1**: Icons are read from Chrome's own local favicon cache. Tabularasa does not request icons from websites.
- **Versions 1.0.0 and 1.0.1**: Icons were loaded directly from each tab's favicon address, which is an ordinary image request from your browser to that website (or its CDN). Nothing was sent to the developer. This was the only network traffic the extension caused, and it is why later versions use the local cache instead.

### Incognito Windows
- **Versions after 1.0.1**: Tabularasa declares `"incognito": "not_allowed"` in its manifest. Chrome therefore does not let it run in, see, or save incognito windows and tabs, and it can no longer be enabled for Incognito. If you had enabled "Allow in Incognito" for an earlier version, that setting stops applying once the update installs
- **Versions 1.0.0 and 1.0.1**: If you had enabled "Allow in Incognito", incognito tabs were listed in the manager, and a session saved with "All Windows" included their titles and URLs. Those saved sessions stay in local storage on your device until you delete them; updating does not remove them. If this applies to you, review your saved sessions in the Sessions view and delete any you do not want to keep
- **Why**: Private browsing should never appear in a tab list or be written to a saved session

## What Tabularasa Stores

### Saved Sessions
- **What**: When you choose **Save Session**, Tabularasa stores the session name and date and, for each tab in it, the URL, title, pinned and muted state, and tab group (name and color). 
- **Which pages**: Versions after 1.0.1 save only web pages (`http`, `https`) and local files (`file`); browser pages and other extensions' pages are left out. Versions 1.0.0 and 1.0.1 saved the address of every tab in the window, and sessions saved by them keep those addresses until you delete the session (later versions simply skip them when restoring).
- **Where**: In `chrome.storage.local`, which is a storage area on your device that only this extension can read through Chrome.
- **How long**: Until you delete the session in the Sessions view, or uninstall the extension.
- **Please note**:
  - A saved session is a record of pages you had open, which is a form of browsing history.
  - URLs are stored exactly as they are. Web addresses sometimes contain sensitive values such as sign-in tokens, document keys, or search terms. If a tab's address contains something you would not want kept, do not save it in a session, or delete the session afterwards.
  - **This data is not encrypted by Tabularasa.** It is stored the way Chrome stores extension data in your browser profile, so it is as protected as the rest of your Chrome profile and your operating-system account are. Anyone who can read your Chrome profile folder can read it.

### View Settings of an Open Manager Tab
- **What**: The view you selected (windows, groups, or domains), the filter, and the text in the search box.
- **Where**: In the manager tab's `sessionStorage`, so that they survive a reload. (Versions after 1.0.1 only; earlier versions did not keep them.)
- **How long**: For the life of that tab. Chrome may bring it back together with the tab if you reopen a closed tab, duplicate the tab, or restore your previous browsing session. It is never written to `chrome.storage`.

### Undo
- After you close tabs from the manager, their URLs are kept in memory for as long as the **Undo** message is shown (normally about ten seconds) so that they can be reopened. This is never written to disk.

## What Tabularasa Does NOT Do

- It does not send any data to the developer or to anyone else. Versions after 1.0.1 make no network requests of any kind (for earlier versions, see "Favicons").
- It does not read page content, form data, passwords, cookies, or your Chrome browsing history. It only sees the tabs that are currently open.
- It does not run on, inject code into, or modify any web page.
- It does not collect personal information, analytics, usage statistics, crash reports, or location.
- It does not use `chrome.storage.sync`; nothing is synced to your Google account by the extension.

## Permissions Explanation

Tabularasa requests exactly these Chrome permissions:

### "tabs"
- **Purpose**: Read the title and URL of open tabs so they can be listed, searched, grouped, and de-duplicated; and close, move, pin, mute, and activate tabs at your request.
- **About Chrome's prompt**: When you install the extension, Chrome describes this permission as "Read your browsing history", because the addresses of your open tabs are browsing activity. Tabularasa does not request Chrome's History permission and cannot see pages you visited earlier, only the tabs that are open now.

### "tabGroups"
- **Purpose**: Read and modify Chrome's tab groups (create, name, color, collapse, ungroup).

### "storage"
- **Purpose**: Keep the sessions you save in `chrome.storage.local` on your device.

### "favicon"
- **Purpose**: Show each tab's icon from Chrome's local favicon cache, without contacting the website. (Requested by versions after 1.0.1.)

Tabularasa requests no host permissions and has no content scripts, so it cannot read or change the content of any page. It requires Chrome 104 or later.

## Data Security

- **Local only**: Everything happens on your device, and nothing is sent to the developer or any third party.
- **Isolation**: `chrome.storage.local` is private to the extension: web pages and other extensions cannot read it through Chrome.
- **Not encrypted at rest by the extension**: see "Saved Sessions" above.
- **No remote code**: All code ships inside the extension package; nothing is downloaded or evaluated at run time.

No software can promise to be free of defects. If you find a security problem, please report it (see Contact).

## Your Controls

- **Delete a session** at any time in the Sessions view.
- **Remove everything**: Uninstalling the extension deletes all data it stored.
- **Inspect the data**: Open DevTools on the manager tab and run `chrome.storage.local.get(null).then(console.log)` in the console to see everything that is stored. Recent versions of Chrome also show it under Application → Storage → Extension storage.
- **No account**: There is no registration, sign-in, or account.

## Updates to This Policy

If this policy changes, the "Last Updated" date at the top changes with it, and the change is published with the extension update it applies to. The history of this file is public in the project's repository.

## Children's Privacy

Tabularasa does not collect personal information from anyone, including children under 13.

## Contact

- **Questions and bugs**: https://github.com/cagedmantis/tabularasa/issues
- **Security reports**: use "Report a vulnerability" under the repository's Security tab if it is available; otherwise open an issue asking for a private contact, without including the details
- **Chrome Web Store**: the support section of the Tabularasa listing

## Limited Use

Tabularasa's use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. Tab information is used only to provide the tab-management features described above; it is never transferred to anyone, never used for advertising, never used to determine creditworthiness, and never read by a human other than you.

## Verification

You do not have to take this on trust:

- **Read the code**: The extension is open source at https://github.com/cagedmantis/tabularasa
- **Watch the network**: Open DevTools on the manager tab and on the service worker. With versions after 1.0.1 there are no requests to any web address; the only entries are `chrome-extension://` URLs, which are the extension's own files and cached icons inside your browser.
- **Inspect storage**: See "Inspect the data" above.

---

*This privacy policy applies to Tabularasa Chrome Extension version 1.0.0 and later. Statements that apply only to particular versions say so.*
