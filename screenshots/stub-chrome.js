/*
 * A stand-in for the chrome.* APIs the manager page uses, with demo data, so
 * screenshots/capture.py can render the real manager.html and dist/manager.js
 * outside Chrome. Used only for screenshots; never shipped.
 *
 * capture.py serves the repository on localhost and sets
 * window.STUB_ORIGIN; favicons come from its /_favicon/ route (letter tiles),
 * so rendering makes no network request.
 */
(function () {
    'use strict';

    const OWN_URL = 'chrome-extension://tabularasa/manager.html';
    let nextId = 1;
    const tab = (windowId, title, url, extra) => Object.assign({
        id: nextId++, windowId, title, url, favIconUrl: url,
        active: false, pinned: false, audible: false, incognito: false,
        groupId: -1, mutedInfo: { muted: false }, lastAccessed: 0, index: 0
    }, extra || {});

    const tabs = [
        tab(1, 'Inbox (3) - Mail', 'https://mail.example.com/mail/u/0/', { pinned: true }),
        tab(1, 'Calendar - Week of November 2', 'https://calendar.example.com/r/week/2026/11/2', { pinned: true }),
        tab(1, 'Tabularasa', OWN_URL, { active: true }),
        tab(1, 'Pull requests · tabularasa', 'https://github.com/cagedmantis/tabularasa/pulls', { groupId: 10 }),
        tab(1, 'One-command releases · Pull Request #46', 'https://github.com/cagedmantis/tabularasa/pull/46/files', { groupId: 10 }),
        tab(1, 'chrome.tabGroups | API | Chrome for Developers', 'https://developer.chrome.com/docs/extensions/reference/api/tabGroups', { groupId: 10 }),
        tab(1, 'Lo-fi beats to refactor to - live radio', 'https://video.example.com/watch?v=lofi', { audible: true }),
        tab(1, 'Understanding Non-text Contrast | WAI | W3C', 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html'),
        tab(2, 'Weekend trip - Shared notes', 'https://docs.example.com/document/d/trip/edit', { active: true, groupId: 11 }),
        tab(2, 'Lisbon - Wikipedia', 'https://en.wikipedia.org/wiki/Lisbon', { groupId: 11 }),
        tab(2, 'Hotels near Alfama, Lisbon', 'https://travel.example.com/hotels?near=alfama', { groupId: 11 }),
        tab(2, 'Flights LIS - Sat Nov 14', 'https://flights.example.com/search?to=LIS&date=2026-11-14', { groupId: 11, mutedInfo: { muted: true } }),
        tab(2, 'Lisbon - Wikipedia', 'https://en.wikipedia.org/wiki/Lisbon'),
        tab(3, 'Manifest V3 service worker lifecycle', 'https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle', { active: true }),
        tab(3, 'Go 1.27 Release Notes', 'https://go.dev/doc/go1.27'),
        tab(3, 'TypeScript 7.0 - native compiler', 'https://devblogs.microsoft.com/typescript/'),
        tab(3, 'tabularasa/src/manager.ts at main', 'https://github.com/cagedmantis/tabularasa/blob/main/src/manager.ts')
    ];
    const byWindow = {};
    tabs.forEach(t => { t.index = (byWindow[t.windowId] = (byWindow[t.windowId] || 0) + 1) - 1; });
    tabs.forEach((t, i) => { t.lastAccessed = 1700000000000 + i * 1000; });

    const windows = [1, 2, 3].map(id => ({ id, focused: id === 1, type: 'normal', incognito: false }));
    const groups = [
        { id: 10, windowId: 1, title: 'Tabularasa', color: 'blue', collapsed: false },
        { id: 11, windowId: 2, title: 'Lisbon trip', color: 'orange', collapsed: false }
    ];

    const session = (name, daysAgo, windowTabs) => ({
        id: 'demo-' + name,
        name,
        created: Date.now() - daysAgo * 86400000,
        windows: windowTabs.map((list, i) => ({
            id: 100 + i,
            tabs: list.map(([title, url]) => ({ title, url, pinned: false, muted: false, groupId: -1 })),
            groups: []
        }))
    });
    const storage = {
        sessions: [
            session('Release work', 0, [[
                ['Pull requests · tabularasa', 'https://github.com/cagedmantis/tabularasa/pulls'],
                ['Actions · tabularasa', 'https://github.com/cagedmantis/tabularasa/actions'],
                ['Chrome Web Store Developer Dashboard', 'https://chrome.google.com/webstore/devconsole']
            ]]),
            session('Lisbon trip', 3, [[
                ['Lisbon - Wikipedia', 'https://en.wikipedia.org/wiki/Lisbon'],
                ['Hotels near Alfama, Lisbon', 'https://travel.example.com/hotels?near=alfama']
            ], [
                ['Flights LIS - Sat Nov 14', 'https://flights.example.com/search?to=LIS&date=2026-11-14']
            ]]),
            session('Reading list', 12, [[
                ['Understanding Non-text Contrast | WAI | W3C', 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html'],
                ['Go 1.27 Release Notes', 'https://go.dev/doc/go1.27'],
                ['Manifest V3 service worker lifecycle', 'https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle'],
                ['TypeScript 7.0 - native compiler', 'https://devblogs.microsoft.com/typescript/']
            ]])
        ]
    };

    const event = () => ({ addListener() {}, removeListener() {}, hasListener() { return false; } });
    const copy = value => JSON.parse(JSON.stringify(value));
    const resolved = value => Promise.resolve(copy(value));

    window.chrome = {
        runtime: {
            id: 'tabularasa',
            // Reported as a store build: no development badge in screenshots.
            getManifest: () => ({ version: '1.2.0', update_url: 'https://clients2.google.com/service/update2/crx' }),
            getURL: path => window.STUB_ORIGIN + (path.startsWith('/') ? path : '/' + path)
        },
        storage: {
            local: {
                get: keys => resolved(Object.fromEntries((keys || Object.keys(storage)).map(k => [k, storage[k]]))),
                set: () => Promise.resolve()
            },
            onChanged: event()
        },
        tabs: {
            query: () => resolved(tabs),
            getCurrent: () => resolved(tabs.find(t => t.url === OWN_URL)),
            create: () => resolved({}), update: () => resolved({}), remove: () => Promise.resolve(),
            move: () => resolved([]), group: () => Promise.resolve(99), ungroup: () => Promise.resolve(),
            onCreated: event(), onRemoved: event(), onUpdated: event(), onActivated: event(),
            onMoved: event(), onAttached: event(), onDetached: event(), onReplaced: event()
        },
        tabGroups: {
            query: () => resolved(groups),
            update: () => resolved({}),
            onCreated: event(), onUpdated: event(), onRemoved: event(), onMoved: event()
        },
        windows: {
            WINDOW_ID_NONE: -1,
            getAll: () => resolved(windows),
            getCurrent: () => resolved(Object.assign({ tabs: tabs.filter(t => t.windowId === 1) }, windows[0])),
            create: () => resolved({}), update: () => resolved({}),
            onCreated: event(), onRemoved: event(), onFocusChanged: event()
        }
    };
}());
