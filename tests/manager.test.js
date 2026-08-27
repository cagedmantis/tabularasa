/**
 * Tests for the real TabManager class (src/manager.ts) running against the
 * real manager.html DOM in jsdom, with the Chrome APIs mocked.
 */

const fs = require('fs');
const path = require('path');

const managerHtml = fs.readFileSync(path.resolve(__dirname, '../manager.html'), 'utf8');
const bodyHtml = managerHtml
    .match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<script[\s\S]*?<\/script>/g, '');

// Loading the source registers a DOMContentLoaded listener and exposes the
// TabManager class on window; instances are created directly in each test.
require('../src/manager.ts');
const TabManager = window.TabManager;

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

async function createManager({ tabs = [], windows = [], groups = [], sessions = [] } = {}) {
    document.body.innerHTML = bodyHtml;

    chrome.tabs.query.mockResolvedValue(tabs);
    chrome.windows.getAll.mockResolvedValue(windows);
    chrome.tabGroups.query.mockResolvedValue(groups);
    chrome.storage.local.get.mockResolvedValue({ sessions });

    chrome.tabs.update.mockResolvedValue(undefined);
    chrome.tabs.remove.mockResolvedValue(undefined);
    chrome.tabs.move.mockResolvedValue(undefined);
    chrome.tabs.create.mockResolvedValue({ id: 900 });
    chrome.tabs.group.mockResolvedValue(500);
    chrome.tabs.ungroup.mockResolvedValue(undefined);
    chrome.tabGroups.update.mockResolvedValue(undefined);
    chrome.windows.create.mockResolvedValue({ id: 99, tabs: [{ id: 901 }] });
    chrome.windows.update.mockResolvedValue(undefined);
    chrome.storage.local.set.mockResolvedValue(undefined);

    const manager = new TabManager();
    await flush();
    return manager;
}

const groupTitles = () =>
    Array.from(document.querySelectorAll('.tab-group-title')).map(el => el.textContent);

describe('TabManager', () => {
    describe('rendering', () => {
        test('renders tabs and counts', async () => {
            await createManager({
                tabs: [
                    createMockTab({ id: 1, title: 'GitHub', url: 'https://github.com/', active: true }),
                    createMockTab({ id: 2, title: 'Example', url: 'https://example.com/' })
                ],
                windows: [createMockWindow({ id: 1, focused: true })]
            });

            expect(document.querySelectorAll('.tab-item')).toHaveLength(2);
            expect(document.getElementById('tab-count').textContent).toBe('2 tabs');
            expect(document.getElementById('selected-count').textContent).toBe('0 selected');
            expect(groupTitles()).toEqual(['Window 1 (current)']);
        });

        test('windows view lists windows in browser order and marks the current one', async () => {
            await createManager({
                tabs: [
                    createMockTab({ id: 1, windowId: 10 }),
                    createMockTab({ id: 2, windowId: 20 }),
                    createMockTab({ id: 3, windowId: 20 })
                ],
                windows: [
                    createMockWindow({ id: 10, focused: true }),
                    createMockWindow({ id: 20 })
                ]
            });

            expect(groupTitles()).toEqual(['Window 1 (current)', 'Window 2']);
        });

        test('view toggle cycles Windows → Groups → Domains', async () => {
            const manager = await createManager({
                tabs: [createMockTab({ id: 1 })]
            });
            const toggleText = () => document.querySelector('#view-toggle .text').textContent;

            expect(toggleText()).toBe('Windows');
            manager.toggleView();
            expect(toggleText()).toBe('Groups');
            manager.toggleView();
            expect(toggleText()).toBe('Domains');
            manager.toggleView();
            expect(toggleText()).toBe('Windows');
        });

        test('shows empty state when there are no tabs', async () => {
            await createManager({ tabs: [] });

            expect(document.querySelector('.empty-state')).not.toBeNull();
        });

        test('search filters tabs by title or URL', async () => {
            await createManager({
                tabs: [
                    createMockTab({ id: 1, title: 'GitHub', url: 'https://github.com/' }),
                    createMockTab({ id: 2, title: 'Example', url: 'https://example.com/' })
                ]
            });

            const searchInput = document.getElementById('search-input');
            searchInput.value = 'github';
            searchInput.dispatchEvent(new Event('input'));

            const items = document.querySelectorAll('.tab-item');
            expect(items).toHaveLength(1);
            expect(items[0].querySelector('.tab-title').textContent).toBe('GitHub');
        });

        test('domain view groups tabs by hostname', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, url: 'https://github.com/a' }),
                    createMockTab({ id: 2, url: 'https://github.com/b' }),
                    createMockTab({ id: 3, url: 'https://example.com/' })
                ]
            });

            manager.toggleView(); // → groups
            manager.toggleView(); // → domains

            expect(groupTitles().sort()).toEqual(['example.com', 'github.com']);
        });

        test('renders Chrome tab group titles literally (no double-escaping)', async () => {
            const manager = await createManager({
                tabs: [createMockTab({ id: 1, groupId: 5 })],
                groups: [{ id: 5, title: 'A & B', color: 'blue', collapsed: false, windowId: 1 }]
            });

            manager.toggleView(); // → groups

            expect(groupTitles()).toEqual(['A & B']);
        });

        test('groups sharing a title stay separate buckets', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, groupId: 5 }),
                    createMockTab({ id: 2, groupId: 6 })
                ],
                groups: [
                    { id: 5, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
                    { id: 6, title: 'Work', color: 'red', collapsed: false, windowId: 1 }
                ]
            });

            manager.toggleView(); // → groups

            expect(groupTitles()).toEqual(['Work', 'Work']);
            expect(document.querySelectorAll('.tab-group')).toHaveLength(2);
        });

        test('tabs whose group no longer exists fall into the single Ungrouped bucket', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, groupId: 7 }), // group 7 does not exist
                    createMockTab({ id: 2, groupId: -1 })
                ]
            });

            manager.toggleView(); // → groups

            expect(groupTitles()).toEqual(['Ungrouped']);
            expect(document.querySelectorAll('.tab-item')).toHaveLength(2);
        });
    });

    describe('favicons', () => {
        test('resolves favicons through the local _favicon endpoint instead of fetching tab.favIconUrl directly', async () => {
            // tab.favIconUrl points at a third-party host; loading it directly
            // as <img src> from the extension's own document is what caused
            // ERR_BLOCKED_BY_RESPONSE.NotSameOrigin on sites that send a
            // Cross-Origin-Resource-Policy header. The _favicon endpoint reads
            // Chrome's local favicon cache instead, so it must never appear
            // in the rendered <img src>.
            await createManager({
                tabs: [createMockTab({
                    id: 1,
                    url: 'https://example.com/page',
                    favIconUrl: 'https://example.com/favicon.ico'
                })]
            });

            const favicon = document.querySelector('.tab-favicon');
            expect(favicon.src).not.toContain('example.com/favicon.ico');
            expect(favicon.src).toContain('/_favicon/');

            const params = new URL(favicon.src).searchParams;
            expect(params.get('pageUrl')).toBe('https://example.com/page');
            expect(params.get('size')).toBe('32');
        });

        test('falls back to the placeholder icon for a tab with no URL', async () => {
            await createManager({
                tabs: [createMockTab({ id: 1, url: '' })]
            });

            const favicon = document.querySelector('.tab-favicon');
            expect(favicon.src.startsWith('data:image/svg+xml,')).toBe(true);
        });

        test('falls back to the placeholder icon if the favicon request errors', async () => {
            await createManager({
                tabs: [createMockTab({ id: 1, url: 'https://example.com/page' })]
            });

            const favicon = document.querySelector('.tab-favicon');
            favicon.dispatchEvent(new window.Event('error'));

            expect(favicon.src.startsWith('data:image/svg+xml,')).toBe(true);
        });
    });

    describe('selection', () => {
        test('selecting a tab enables bulk actions and updates counts', async () => {
            const manager = await createManager({
                tabs: [createMockTab({ id: 1 }), createMockTab({ id: 2 })]
            });

            manager.toggleTabSelection(1);

            expect(document.getElementById('selected-count').textContent).toBe('1 selected');
            const closeSelected = document.getElementById('close-selected');
            expect(closeSelected.disabled).toBe(false);
            expect(closeSelected.textContent).toBe('Close Selected (1)');
        });

        test('selections of tabs closed outside the manager are pruned on refresh', async () => {
            const manager = await createManager({
                tabs: [createMockTab({ id: 1 }), createMockTab({ id: 2 })]
            });

            manager.toggleTabSelection(2);
            expect(document.getElementById('selected-count').textContent).toBe('1 selected');

            // Tab 2 was closed outside the manager
            chrome.tabs.query.mockResolvedValue([createMockTab({ id: 1 })]);
            await manager.refreshTabs();

            expect(document.getElementById('selected-count').textContent).toBe('0 selected');
            expect(document.getElementById('close-selected').disabled).toBe(true);
        });

        test('Ctrl+A selects all tabs, but not while typing in a form field', async () => {
            await createManager({
                tabs: [createMockTab({ id: 1 }), createMockTab({ id: 2 })]
            });

            const ctrlA = () => new window.KeyboardEvent('keydown', {
                key: 'a', ctrlKey: true, bubbles: true, cancelable: true
            });

            document.getElementById('search-input').dispatchEvent(ctrlA());
            expect(document.getElementById('selected-count').textContent).toBe('0 selected');

            document.body.dispatchEvent(ctrlA());
            expect(document.getElementById('selected-count').textContent).toBe('2 selected');
        });
    });

    describe('tab operations', () => {
        test('closeSelectedTabs removes the selected tabs and clears the selection', async () => {
            const manager = await createManager({
                tabs: [createMockTab({ id: 1 }), createMockTab({ id: 2 })]
            });

            manager.toggleTabSelection(1);
            await manager.closeSelectedTabs();

            expect(chrome.tabs.remove).toHaveBeenCalledWith([1]);
            expect(document.getElementById('selected-count').textContent).toBe('0 selected');
        });

        test('closeDuplicateTabs keeps the most recently accessed copy', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, url: 'https://example.com/', lastAccessed: 3000 }),
                    createMockTab({ id: 2, url: 'https://example.com/', lastAccessed: 1000 }),
                    createMockTab({ id: 3, url: 'https://other.com/' })
                ]
            });

            await manager.closeDuplicateTabs();

            expect(chrome.tabs.remove).toHaveBeenCalledTimes(1);
            expect(chrome.tabs.remove).toHaveBeenCalledWith(2);
        });

        test('group creation applies the chosen color even without a name', async () => {
            const manager = await createManager({
                tabs: [createMockTab({ id: 1 })]
            });

            manager.toggleTabSelection(1);
            document.getElementById('group-name').value = '';
            document.getElementById('group-color').value = 'blue';
            chrome.tabs.group.mockResolvedValue(42);

            await manager.confirmGroupCreation();

            expect(chrome.tabGroups.update).toHaveBeenCalledWith(42, {
                title: undefined,
                color: 'blue'
            });
        });
    });

    describe('sessions', () => {
        const session = () => createMockSession({
            id: 'session-1',
            windows: [{
                id: 1,
                tabs: [
                    { url: 'https://a.com/', title: 'A', pinned: false, muted: false, groupId: -1 },
                    { url: 'https://b.com/', title: 'B', pinned: false, muted: false, groupId: -1 },
                    { url: 'https://c.com/', title: 'C', pinned: false, muted: false, groupId: -1 }
                ],
                groups: []
            }]
        });

        test('session buttons are wired via listeners, not CSP-blocked inline onclick', async () => {
            await createManager({ sessions: [session()] });

            const buttons = document.querySelectorAll('#sessions-list button');
            expect(buttons).toHaveLength(2);
            buttons.forEach(button => {
                expect(button.getAttribute('onclick')).toBeNull();
            });
        });

        test('opening a session restores every ungrouped tab', async () => {
            await createManager({ sessions: [session()] });

            const openBtn = Array.from(document.querySelectorAll('#sessions-list button'))
                .find(btn => btn.textContent === 'Open');
            openBtn.click();
            await flush();

            // First tab opens with the window; the remaining two are created
            expect(chrome.windows.create).toHaveBeenCalledWith({
                url: 'https://a.com/',
                focused: false
            });
            const createdUrls = chrome.tabs.create.mock.calls.map(([opts]) => opts.url);
            expect(createdUrls).toEqual(['https://b.com/', 'https://c.com/']);
        });

        test('opening a session recreates tab groups', async () => {
            const grouped = createMockSession({
                id: 'session-2',
                windows: [{
                    id: 1,
                    tabs: [
                        { url: 'https://a.com/', title: 'A', pinned: false, muted: false, groupId: 10 },
                        { url: 'https://b.com/', title: 'B', pinned: false, muted: false, groupId: 10 },
                        { url: 'https://c.com/', title: 'C', pinned: false, muted: false, groupId: -1 }
                    ],
                    groups: [{ id: 10, title: 'Work', color: 'green' }]
                }]
            });
            const manager = await createManager({ sessions: [grouped] });
            chrome.tabs.group.mockResolvedValue(77);

            await manager.openSession('session-2');

            expect(chrome.tabGroups.update).toHaveBeenCalledWith(77, {
                title: 'Work',
                color: 'green'
            });
            // Tab B created for the group, tab C created as ungrouped
            const createdUrls = chrome.tabs.create.mock.calls.map(([opts]) => opts.url);
            expect(createdUrls).toEqual(['https://b.com/', 'https://c.com/']);
        });

        test('deleteSession persists the remaining sessions', async () => {
            const manager = await createManager({ sessions: [session()] });

            await manager.deleteSession('session-1');

            expect(chrome.storage.local.set).toHaveBeenCalledWith({ sessions: [] });
            expect(document.querySelector('#sessions-list .empty-state')).not.toBeNull();
        });
    });

    describe('status messages', () => {
        test('a new message resets the auto-hide timer of the previous one', async () => {
            const manager = await createManager();
            const statusEl = document.getElementById('status-message');

            jest.useFakeTimers();
            try {
                manager.showStatusMessage('first');
                jest.advanceTimersByTime(2900);
                manager.showStatusMessage('second');

                // The first message's timer must not hide the second message
                jest.advanceTimersByTime(200);
                expect(statusEl.classList.contains('hidden')).toBe(false);
                expect(statusEl.querySelector('.message-text').textContent).toBe('second');

                jest.advanceTimersByTime(2900);
                expect(statusEl.classList.contains('hidden')).toBe(true);
            } finally {
                jest.useRealTimers();
            }
        });
    });
});
