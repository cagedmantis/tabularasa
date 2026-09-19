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
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Typing is debounced, so wait for the rebuild it triggers.
const SEARCH_DELAY_MS = 100;
async function typeSearch(text) {
    const searchInput = document.getElementById('search-input');
    searchInput.value = text;
    searchInput.dispatchEvent(new window.Event('input'));
    await wait(SEARCH_DELAY_MS + 30);
}

async function createManager({ tabs = [], windows = [], groups = [], sessions = [], ownTabId } = {}) {
    document.body.innerHTML = bodyHtml;

    chrome.tabs.query.mockResolvedValue(tabs);
    if (ownTabId instanceof Error) {
        chrome.tabs.getCurrent.mockRejectedValue(ownTabId);
    } else {
        chrome.tabs.getCurrent.mockResolvedValue(ownTabId === undefined ? undefined : { id: ownTabId });
    }
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

    // jsdom does not implement confirm(); tests accept by default.
    window.confirm = jest.fn(() => true);

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

            await typeSearch('github');

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

    describe('live updates', () => {
        const REFRESH_DELAY_MS = 150;
        const fire = (event, ...args) =>
            event.addListener.mock.calls.forEach(([listener]) => listener(...args));
        const setHidden = (hidden) => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
            document.dispatchEvent(new window.Event('visibilitychange'));
        };
        afterEach(() => {
            delete document.hidden;
        });

        test('subscribes to browser events itself, before the first load finishes', async () => {
            document.body.innerHTML = bodyHtml;
            chrome.tabs.getCurrent.mockResolvedValue(undefined);
            chrome.tabs.query.mockReturnValue(new Promise(() => {})); // load never finishes
            new TabManager();

            [
                chrome.tabs.onCreated, chrome.tabs.onUpdated, chrome.tabs.onRemoved,
                chrome.tabs.onActivated, chrome.tabs.onMoved, chrome.tabs.onAttached,
                chrome.tabs.onDetached, chrome.tabs.onReplaced,
                chrome.windows.onCreated, chrome.windows.onRemoved, chrome.windows.onFocusChanged,
                chrome.tabGroups.onCreated, chrome.tabGroups.onUpdated,
                chrome.tabGroups.onMoved, chrome.tabGroups.onRemoved
            ].forEach(event => expect(event.addListener).toHaveBeenCalledTimes(1));
            expect(chrome.runtime.onMessage.addListener).not.toHaveBeenCalled();
        });

        test('a burst of events causes a single refresh', async () => {
            await createManager({ tabs: [createMockTab({ id: 1 })] });
            chrome.tabs.query.mockClear();
            chrome.tabs.query.mockResolvedValue([createMockTab({ id: 1 }), createMockTab({ id: 2 })]);

            for (let i = 0; i < 20; i++) {
                fire(chrome.tabs.onUpdated, 1, { status: 'loading' });
                fire(chrome.tabs.onRemoved, 3, {});
            }
            expect(chrome.tabs.query).not.toHaveBeenCalled();

            await wait(REFRESH_DELAY_MS + 50);

            expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
            expect(document.querySelectorAll('.tab-item')).toHaveLength(2);
        });

        test('a steady stream of events cannot postpone the refresh forever', async () => {
            await createManager({ tabs: [createMockTab({ id: 1 })] });
            chrome.tabs.query.mockClear();

            // Events keep arriving more often than the coalescing window
            for (let elapsed = 0; elapsed < REFRESH_DELAY_MS * 2; elapsed += 50) {
                fire(chrome.tabs.onUpdated, 1, {});
                await wait(50);
            }

            expect(chrome.tabs.query.mock.calls.length).toBeGreaterThanOrEqual(1);
        });

        test('while hidden, events are remembered and applied when shown again', async () => {
            await createManager({ tabs: [createMockTab({ id: 1 })] });
            chrome.tabs.query.mockClear();
            chrome.tabs.query.mockResolvedValue([]);

            setHidden(true);
            fire(chrome.tabs.onRemoved, 1, {});
            await wait(REFRESH_DELAY_MS + 50);
            expect(chrome.tabs.query).not.toHaveBeenCalled();

            // Shown again: refreshed at once, not after the coalescing delay
            setHidden(false);
            await flush();
            expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
            expect(document.querySelectorAll('.tab-item')).toHaveLength(0);
        });

        test('a refresh already scheduled when the page is hidden still runs, once', async () => {
            await createManager({ tabs: [createMockTab({ id: 1 })] });
            chrome.tabs.query.mockClear();

            fire(chrome.tabs.onUpdated, 1, {});
            setHidden(true);
            await wait(REFRESH_DELAY_MS + 50);

            // The pending refresh still runs once; nothing further is scheduled
            expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
        });

        test('switching to another application does not cause a refresh', async () => {
            await createManager({ tabs: [createMockTab({ id: 1 })] });
            chrome.tabs.query.mockClear();

            fire(chrome.windows.onFocusChanged, chrome.windows.WINDOW_ID_NONE);
            await wait(REFRESH_DELAY_MS + 50);
            expect(chrome.tabs.query).not.toHaveBeenCalled();

            fire(chrome.windows.onFocusChanged, 2);
            await wait(REFRESH_DELAY_MS + 50);
            expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
        });

        test('a load still commits when the newer load that overtook it fails', async () => {
            const manager = await createManager({ tabs: [createMockTab({ id: 1 })] });

            let resolveSlow;
            chrome.tabs.query
                .mockReturnValueOnce(new Promise(resolve => { resolveSlow = resolve; }))
                .mockRejectedValueOnce(new Error('query failed'));

            const slow = manager.refreshTabs();
            await expect(manager.refreshTabs()).rejects.toThrow('query failed');

            resolveSlow([createMockTab({ id: 1 }), createMockTab({ id: 2 })]);
            await slow;
            expect(document.querySelectorAll('.tab-item')).toHaveLength(2);
        });

        test('an event during the initial load does not blank the first render', async () => {
            document.body.innerHTML = bodyHtml;
            chrome.tabs.getCurrent.mockResolvedValue(undefined);
            chrome.windows.getAll.mockResolvedValue([]);
            chrome.tabGroups.query.mockResolvedValue([]);
            chrome.storage.local.get.mockResolvedValue({ sessions: [] });
            let resolveInitial;
            chrome.tabs.query
                .mockReturnValueOnce(new Promise(resolve => { resolveInitial = resolve; }))
                .mockReturnValueOnce(new Promise(() => {})); // the event's refresh is slower still
            new TabManager();

            fire(chrome.tabs.onUpdated, 1, { status: 'loading' });
            await wait(REFRESH_DELAY_MS + 50);             // event refresh now in flight
            resolveInitial([createMockTab({ id: 1 })]);
            await flush();

            expect(document.querySelectorAll('.tab-item')).toHaveLength(1);
            expect(document.querySelector('#tabs-container .empty-state')).toBeNull();
        });

        test('becoming visible with nothing pending does not refresh', async () => {
            await createManager({ tabs: [createMockTab({ id: 1 })] });
            chrome.tabs.query.mockClear();

            setHidden(true);
            setHidden(false);
            await wait(REFRESH_DELAY_MS + 50);

            expect(chrome.tabs.query).not.toHaveBeenCalled();
        });

        test('a refresh overtaken by a newer one does not render its stale snapshot', async () => {
            const manager = await createManager({ tabs: [createMockTab({ id: 1 })] });

            let resolveSlow;
            chrome.tabs.query
                .mockReturnValueOnce(new Promise(resolve => { resolveSlow = resolve; }))
                .mockResolvedValueOnce([createMockTab({ id: 1 }), createMockTab({ id: 2 })]);

            const slow = manager.refreshTabs();   // started first, finishes last
            await manager.refreshTabs();          // newer
            expect(document.querySelectorAll('.tab-item')).toHaveLength(2);

            resolveSlow([]);                      // the old, now wrong, answer arrives
            await slow;
            expect(document.querySelectorAll('.tab-item')).toHaveLength(2);
        });

        test('tabs and groups always come from the same refresh', async () => {
            const manager = await createManager({ tabs: [createMockTab({ id: 1, groupId: -1 })] });
            document.getElementById('view-toggle').click(); // groups view

            let resolveSlowGroups;
            chrome.tabGroups.query
                .mockReturnValueOnce(new Promise(resolve => { resolveSlowGroups = resolve; }))
                .mockResolvedValueOnce([{ id: 10, title: 'Work', color: 'blue', collapsed: false, windowId: 1 }]);
            chrome.tabs.query.mockResolvedValue([createMockTab({ id: 1, groupId: 10 })]);

            const slow = manager.refreshTabs();
            await manager.refreshTabs();
            resolveSlowGroups([]);                // stale: the group did not exist yet
            await slow;

            expect(groupTitles()).toEqual(['Work']);
        });

        test('a replaced tab keeps its place in the selection', async () => {
            const manager = await createManager({ tabs: [createMockTab({ id: 1 }), createMockTab({ id: 2 })] });
            manager.toggleTabSelection(1);
            chrome.tabs.query.mockResolvedValue([createMockTab({ id: 7 }), createMockTab({ id: 2 })]);

            fire(chrome.tabs.onReplaced, 7, 1);
            await wait(REFRESH_DELAY_MS + 50);

            expect(document.getElementById('selected-count').textContent).toBe('1 selected');
            expect(document.querySelector('[data-tab-id="7"] .tab-checkbox').checked).toBe(true);
        });
    });

    describe('incremental rendering', () => {
        const threeTabs = () => [
            createMockTab({ id: 1, title: 'One', url: 'https://one.example/' }),
            createMockTab({ id: 2, title: 'Two', url: 'https://two.example/' }),
            createMockTab({ id: 3, title: 'Three', url: 'https://three.example/' })
        ];
        const row = (id) => document.querySelector(`[data-tab-id="${id}"]`);

        test('selecting does not rebuild any row', async () => {
            const manager = await createManager({ tabs: threeTabs() });
            const before = [row(1), row(2), row(3)];

            row(1).querySelector('.tab-checkbox').click();
            document.getElementById('select-all').click();
            document.getElementById('deselect-all').click();
            manager.toggleTabSelection(2);

            expect(before.every((element, i) => element === row(i + 1))).toBe(true);
            expect(row(2).classList.contains('selected')).toBe(true);
            expect(row(2).querySelector('.tab-checkbox').checked).toBe(true);
            expect(row(1).classList.contains('selected')).toBe(false);
            expect(document.getElementById('selected-count').textContent).toBe('1 selected');
        });

        test('a refresh reuses unchanged rows and rebuilds only changed ones', async () => {
            const manager = await createManager({ tabs: threeTabs() });
            const before = [row(1), row(2), row(3)];
            const changed = threeTabs();
            changed[1].title = 'Two (edited)';
            chrome.tabs.query.mockResolvedValue(changed);

            await manager.refreshTabs();

            expect(row(1)).toBe(before[0]);
            expect(row(3)).toBe(before[2]);
            expect(row(2)).not.toBe(before[1]);
            expect(row(2).querySelector('.tab-title').textContent).toBe('Two (edited)');
        });

        test('a reused row reflects selection changes made while it was filtered out', async () => {
            const manager = await createManager({ tabs: threeTabs() });
            await typeSearch('One');
            manager.selectedTabs.add(2); // selected while off screen
            document.getElementById('clear-search').click();

            expect(row(2).classList.contains('selected')).toBe(true);
            expect(row(2).querySelector('.tab-checkbox').checked).toBe(true);
        });

        test('a row is rebuilt when its favicon becomes known', async () => {
            // Chrome reports url, then title, then favIconUrl. The _favicon
            // URL only depends on the page URL, so without favIconUrl in the
            // signature the row built at the title change is reused forever
            // and keeps the placeholder icon.
            const loading = threeTabs();
            loading[0].favIconUrl = undefined;
            const manager = await createManager({ tabs: loading });
            const before = row(1);
            const loaded = threeTabs();
            loaded[0].favIconUrl = 'https://one.example/favicon.ico';
            chrome.tabs.query.mockResolvedValue(loaded);

            await manager.refreshTabs();

            expect(row(1)).not.toBe(before);
            expect(row(1).querySelector('.tab-favicon')).not.toBe(before.querySelector('.tab-favicon'));
            expect(row(2).parentElement).not.toBeNull();
        });

        test('a refresh that changes nothing shown leaves the DOM and focus alone', async () => {
            const manager = await createManager({ tabs: threeTabs() });
            const group = document.querySelector('.tab-group');
            const closeButton = row(2).querySelector('.tab-action.close');
            closeButton.focus();
            const onBlur = jest.fn();
            closeButton.addEventListener('blur', onBlur);
            const sameButNewObjects = threeTabs();
            sameButNewObjects[0].lastAccessed = 123456; // not shown anywhere
            chrome.tabs.query.mockResolvedValue(sameButNewObjects);

            await manager.refreshTabs();

            expect(document.querySelector('.tab-group')).toBe(group);
            expect(onBlur).not.toHaveBeenCalled();
            expect(document.activeElement).toBe(closeButton);
        });

        test('selection still updates when the list itself is unchanged', async () => {
            const manager = await createManager({ tabs: threeTabs() });
            manager.selectedTabs.add(3);

            await manager.refreshTabs();

            expect(row(3).classList.contains('selected')).toBe(true);
            expect(document.getElementById('selected-count').textContent).toBe('1 selected');
        });

        test('when the focused row disappears, focus stays in the list', async () => {
            const manager = await createManager({ tabs: threeTabs() });
            row(2).querySelector('.tab-action.close').focus();
            chrome.tabs.query.mockResolvedValue([threeTabs()[0], threeTabs()[2]]);

            await manager.refreshTabs();

            expect(document.activeElement).toBe(document.getElementById('tabs-container'));
        });

        test('Select All right after typing uses the query in the box, not the previous one', async () => {
            await createManager({ tabs: threeTabs() });
            const searchInput = document.getElementById('search-input');
            searchInput.value = 'Two';
            searchInput.dispatchEvent(new window.Event('input'));

            document.getElementById('select-all').click(); // before the debounced rebuild

            expect(document.getElementById('selected-count').textContent).toBe('1 selected');
            await wait(SEARCH_DELAY_MS + 30);
            expect(row(2).classList.contains('selected')).toBe(true);
        });

        test('rows of closed tabs are forgotten', async () => {
            const manager = await createManager({ tabs: threeTabs() });
            chrome.tabs.query.mockResolvedValue(threeTabs().slice(0, 2));

            await manager.refreshTabs();

            expect(Array.from(manager.tabRows.keys())).toEqual([1, 2]);
        });

        test('keyboard focus survives a refresh', async () => {
            const manager = await createManager({ tabs: threeTabs() });
            const closeButton = row(2).querySelector('.tab-action.close');
            closeButton.focus();
            expect(document.activeElement).toBe(closeButton);
            const changed = threeTabs();
            changed[1].title = 'Two (edited)'; // forces row 2 to be rebuilt
            chrome.tabs.query.mockResolvedValue(changed);

            await manager.refreshTabs();

            expect(document.activeElement).toBe(row(2).querySelector('.tab-action.close'));
            expect(document.activeElement).not.toBe(closeButton);
        });

        test('focus outside the tab list is left alone', async () => {
            const manager = await createManager({ tabs: threeTabs() });
            const searchInput = document.getElementById('search-input');
            searchInput.focus();

            await manager.refreshTabs();

            expect(document.activeElement).toBe(searchInput);
        });

        test('typing rebuilds the list once, after the pause', async () => {
            const manager = await createManager({ tabs: threeTabs() });
            const renderTabs = jest.spyOn(manager, 'renderTabs');
            const searchInput = document.getElementById('search-input');

            for (const text of ['T', 'Tw', 'Two']) {
                searchInput.value = text;
                searchInput.dispatchEvent(new window.Event('input'));
            }
            expect(renderTabs).not.toHaveBeenCalled();

            await wait(SEARCH_DELAY_MS + 30);
            expect(renderTabs).toHaveBeenCalledTimes(1);
            expect(document.querySelectorAll('.tab-item')).toHaveLength(1);
        });

        test('tab refreshes do not re-render the sessions list', async () => {
            const manager = await createManager({ tabs: threeTabs(), sessions: [createMockSession({ id: 's' })] });
            const sessionItem = document.querySelector('.session-item');
            expect(sessionItem).not.toBeNull();

            await manager.refreshTabs();
            manager.toggleTabSelection(1);

            expect(document.querySelector('.session-item')).toBe(sessionItem);
        });

        test('windows are fetched without their tabs', async () => {
            await createManager({ tabs: threeTabs() });

            expect(chrome.windows.getAll).toHaveBeenCalledTimes(1);
            expect(chrome.windows.getAll.mock.calls[0][0]).not.toHaveProperty('populate');
        });

        test('equal-sized sections keep a stable order', async () => {
            const tabs = [
                createMockTab({ id: 1, url: 'https://zeta.example/' }),
                createMockTab({ id: 2, url: 'https://alpha.example/' }),
                createMockTab({ id: 3, url: 'https://mid.example/' })
            ];
            const manager = await createManager({ tabs });
            document.getElementById('view-toggle').click();
            document.getElementById('view-toggle').click(); // domains
            expect(groupTitles()).toEqual(['alpha.example', 'mid.example', 'zeta.example']);

            chrome.tabs.query.mockResolvedValue([tabs[2], tabs[0], tabs[1]]);
            await manager.refreshTabs();
            expect(groupTitles()).toEqual(['alpha.example', 'mid.example', 'zeta.example']);
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

    describe('the manager\'s own tab', () => {
        const manyTabs = () => Array.from({ length: 25 }, (_, i) =>
            createMockTab({ id: i + 1, url: `https://example.com/${i + 1}` }));

        test('Close All closes the bucket in one call and spares the manager tab', async () => {
            await createManager({
                tabs: manyTabs(),
                windows: [createMockWindow({ id: 1, focused: true })],
                ownTabId: 3
            });

            document.querySelector('.tab-group-actions .btn-danger').click();
            await flush();

            expect(chrome.tabs.remove).toHaveBeenCalledTimes(1);
            const closed = chrome.tabs.remove.mock.calls[0][0];
            expect(closed).toHaveLength(24);
            expect(closed).not.toContain(3);
        });

        test('Close All on a bucket holding only the manager tab closes nothing', async () => {
            await createManager({
                tabs: [createMockTab({ id: 3 })],
                windows: [createMockWindow({ id: 1, focused: true })],
                ownTabId: 3
            });

            document.querySelector('.tab-group-actions .btn-danger').click();
            await flush();

            expect(chrome.tabs.remove).not.toHaveBeenCalled();
        });

        test('Close All refreshes the list even when the close is rejected', async () => {
            await createManager({
                tabs: [createMockTab({ id: 1 }), createMockTab({ id: 2 })],
                windows: [createMockWindow({ id: 1, focused: true })]
            });
            chrome.tabs.remove.mockImplementationOnce(async () => {
                chrome.tabs.query.mockResolvedValue([]);
                throw new Error('No tab with id: 2');
            });

            document.querySelector('.tab-group-actions .btn-danger').click();
            await flush();

            expect(chrome.tabs.remove).toHaveBeenCalledTimes(1);
            expect(document.querySelectorAll('.tab-item')).toHaveLength(0);
            expect(document.getElementById('status-message').classList.contains('warning')).toBe(true);
        });

        test('Close All reports a failed refresh instead of rejecting', async () => {
            await createManager({
                tabs: [createMockTab({ id: 1 })],
                windows: [createMockWindow({ id: 1, focused: true })]
            });
            chrome.tabs.query.mockRejectedValue(new Error('query failed'));

            document.querySelector('.tab-group-actions .btn-danger').click();
            await flush();

            expect(document.getElementById('status-message').classList.contains('error')).toBe(true);
        });

        test('Close All still closes everything in one call when the own tab is unknown', async () => {
            await createManager({
                tabs: manyTabs(),
                windows: [createMockWindow({ id: 1, focused: true })]
            });

            document.querySelector('.tab-group-actions .btn-danger').click();
            await flush();

            expect(chrome.tabs.remove).toHaveBeenCalledTimes(1);
            expect(chrome.tabs.remove.mock.calls[0][0]).toHaveLength(25);
        });

        test('cannot be selected, individually or via select all', async () => {
            const manager = await createManager({
                tabs: [createMockTab({ id: 1 }), createMockTab({ id: 2 }), createMockTab({ id: 3 })],
                windows: [createMockWindow({ id: 1, focused: true })],
                ownTabId: 3
            });

            const ownRow = document.querySelector('[data-tab-id="3"]');
            expect(ownRow.querySelector('.tab-checkbox').disabled).toBe(true);
            expect(ownRow.querySelector('.tab-checkbox').getAttribute('aria-label')).toMatch(/cannot be selected/);
            expect(ownRow.querySelector('.tab-own-badge').textContent).toBe('This tab');
            expect(document.querySelectorAll('.tab-own-badge')).toHaveLength(1);
            expect(document.querySelector('[data-tab-id="1"] .tab-checkbox').disabled).toBe(false);

            manager.toggleTabSelection(3);
            expect(document.getElementById('selected-count').textContent).toBe('0 selected');

            document.getElementById('select-all').click();
            expect(document.getElementById('selected-count').textContent).toBe('2 selected');

            document.getElementById('deselect-all').click();
            document.querySelector('.tab-group-actions .btn-secondary').click();
            expect(document.getElementById('selected-count').textContent).toBe('2 selected');

            await manager.closeSelectedTabs();
            expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2]);
        });

        test('closeDuplicateTabs never closes the manager tab', async () => {
            const url = 'chrome-extension://test-extension-id/manager.html';
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, url, lastAccessed: 3000 }),
                    createMockTab({ id: 2, url, lastAccessed: 1000 })
                ],
                ownTabId: 2
            });

            await manager.closeDuplicateTabs();

            expect(chrome.tabs.remove).toHaveBeenCalledTimes(1);
            expect(chrome.tabs.remove).toHaveBeenCalledWith(1);
        });

        test('still works when the own tab cannot be resolved', async () => {
            const manager = await createManager({
                tabs: [createMockTab({ id: 1 })],
                ownTabId: new Error('unavailable')
            });

            expect(document.querySelectorAll('.tab-item')).toHaveLength(1);
            manager.toggleTabSelection(1);
            expect(document.getElementById('selected-count').textContent).toBe('1 selected');
        });
    });

    describe('destructive actions', () => {
        const tabsInWindow = (count) => Array.from({ length: count }, (_, i) =>
            createMockTab({ id: i + 1, index: i, windowId: 1, title: `Tab ${i + 1}`, url: `https://example.com/${i + 1}` }));
        const setup = (count) => createManager({
            tabs: tabsInWindow(count),
            windows: [createMockWindow({ id: 1, focused: true })]
        });
        const closeAll = () => document.querySelector('.tab-group-actions .btn-danger');
        const undoButton = () => document.querySelector('#status-message .status-action');

        test('a small, fully visible close does not ask for confirmation', async () => {
            await setup(9);

            closeAll().click();
            await flush();

            expect(window.confirm).not.toHaveBeenCalled();
            expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        });

        test('a large close asks first and does nothing when declined', async () => {
            await setup(10);
            window.confirm.mockReturnValue(false);

            closeAll().click();
            await flush();

            expect(window.confirm).toHaveBeenCalledWith('Close 10 tabs?');
            expect(chrome.tabs.remove).not.toHaveBeenCalled();
            expect(document.querySelectorAll('.tab-item')).toHaveLength(10);
            // Feedback even if Chrome suppressed the dialog and answered for the user
            expect(document.getElementById('status-message').textContent).toContain('Nothing was closed');
        });

        test('selections hidden by the search are counted and confirmed', async () => {
            const manager = await setup(3);
            manager.toggleTabSelection(1);
            manager.toggleTabSelection(2);

            await typeSearch('Tab 1');

            expect(document.getElementById('selected-count').textContent)
                .toBe('2 selected (1 hidden by filter)');

            window.confirm.mockReturnValue(false);
            await manager.closeSelectedTabs();

            expect(window.confirm.mock.calls[0][0]).toContain('Close 2 tabs?');
            expect(window.confirm.mock.calls[0][0]).toContain('1 of them is hidden');
            expect(chrome.tabs.remove).not.toHaveBeenCalled();
            expect(document.getElementById('selected-count').textContent).toContain('2 selected');
            expect(document.getElementById('status-message').textContent).toContain('Nothing was closed');
        });

        test('tabs that closed while the dialog was up are dropped before removing', async () => {
            const manager = await setup(10);
            // Tab 4 went away while confirm() was blocking the page
            window.confirm.mockImplementation(() => {
                chrome.tabs.query.mockResolvedValue(tabsInWindow(10).filter(tab => tab.id !== 4));
                return true;
            });

            closeAll().click();
            await flush();

            expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2, 3, 5, 6, 7, 8, 9, 10]);
            expect(document.getElementById('status-message').textContent).toContain('9 tabs closed');
            expect(manager).toBeDefined();
        });

        test('Close Duplicates always asks, listing what it will close', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, title: 'Docs (newest)', url: 'https://example.com/', lastAccessed: 3 }),
                    createMockTab({ id: 2, title: 'Docs (older)', url: 'https://example.com/', lastAccessed: 2 }),
                    createMockTab({ id: 3, title: '', url: 'https://example.com/', lastAccessed: 1 })
                ]
            });
            window.confirm.mockReturnValue(false);

            await manager.closeDuplicateTabs();

            expect(window.confirm).toHaveBeenCalledWith(
                'Close 2 tabs?\n\n\u2022 Docs (older)\n\u2022 https://example.com/');
            expect(chrome.tabs.remove).not.toHaveBeenCalled();
        });

        test('page titles are made safe for the dialog', async () => {
            const hostile = 'Docs\n\n\u2022 Nothing else will be closed\u202E' + 'x'.repeat(200);
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, title: 'Kept', url: 'https://example.com/', lastAccessed: 2 }),
                    createMockTab({ id: 2, title: hostile, url: 'https://example.com/', lastAccessed: 1 })
                ]
            });
            window.confirm.mockReturnValue(false);

            await manager.closeDuplicateTabs();

            const question = window.confirm.mock.calls[0][0];
            const lines = question.split('\n');
            expect(lines).toHaveLength(3);                 // question, blank, one bullet
            expect(lines[2].length).toBeLessThanOrEqual(82); // bullet + 80 characters
            expect(question).not.toMatch(/[\u202a-\u202e]/);
            expect(lines[2].endsWith('\u2026')).toBe(true);
        });

        test('the hidden-by-filter warning comes before the list', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, title: 'Visible copy', url: 'https://example.com/', lastAccessed: 2 }),
                    createMockTab({ id: 2, title: 'Other copy', url: 'https://example.com/', lastAccessed: 1 })
                ]
            });
            await typeSearch('Visible');
            window.confirm.mockReturnValue(false);

            await manager.closeDuplicateTabs();

            const question = window.confirm.mock.calls[0][0];
            expect(question.indexOf('hidden by the current search')).toBeGreaterThan(-1);
            expect(question.indexOf('hidden by the current search')).toBeLessThan(question.indexOf('\u2022'));
        });

        test('a long duplicate list is summarised', async () => {
            const manager = await createManager({
                tabs: Array.from({ length: 14 }, (_, i) =>
                    createMockTab({ id: i + 1, title: `Copy ${i + 1}`, url: 'https://example.com/', lastAccessed: 14 - i }))
            });
            window.confirm.mockReturnValue(false);

            await manager.closeDuplicateTabs();

            const question = window.confirm.mock.calls[0][0];
            expect(question).toContain('Close 13 tabs?');
            expect(question.match(/\u2022/g)).toHaveLength(10);
            expect(question).toContain('\u2026 and 3 more');
        });

        test('Close Duplicates survives the list refreshing while it closes tabs', async () => {
            const tabs = Array.from({ length: 4 }, (_, i) =>
                createMockTab({ id: i + 1, index: i, url: 'https://example.com/', lastAccessed: 4 - i }));
            const manager = await createManager({ tabs });
            // In Chrome every removal is followed by a TAB_REMOVED refresh
            // that replaces the manager's tab list mid-loop.
            chrome.tabs.remove.mockImplementation(async (tabId) => {
                chrome.tabs.query.mockResolvedValue([tabs[0]]);
                await manager.refreshTabs();
                return tabId;
            });

            await manager.closeDuplicateTabs();

            expect(chrome.tabs.remove.mock.calls.map(([id]) => id)).toEqual([2, 3, 4]);
            const status = document.getElementById('status-message');
            expect(status.classList.contains('error')).toBe(false);
            expect(status.textContent).toContain('3 duplicate tabs closed');
            expect(undoButton().classList.contains('hidden')).toBe(false);
        });

        test('Undo reopens closed tabs at their old position', async () => {
            const manager = await setup(3);
            manager.toggleTabSelection(3);
            manager.toggleTabSelection(1);
            chrome.tabs.update.mockResolvedValue(undefined);

            await manager.closeSelectedTabs();

            expect(undoButton().classList.contains('hidden')).toBe(false);
            expect(undoButton().textContent).toBe('Undo');

            undoButton().click();
            await flush();

            expect(chrome.tabs.create.mock.calls.map(([opts]) => opts)).toEqual([
                { url: 'https://example.com/1', pinned: false, active: false, windowId: 1, index: 0 },
                { url: 'https://example.com/3', pinned: false, active: false, windowId: 1, index: 2 }
            ]);
            expect(document.getElementById('status-message').textContent).toContain('2 tabs reopened');
            expect(undoButton().classList.contains('hidden')).toBe(true);
        });

        test('Undo recreates a window that closed with its tabs, once', async () => {
            await createManager({
                tabs: [
                    createMockTab({ id: 1, windowId: 1, index: 0, url: 'https://keep.example/' }),
                    createMockTab({ id: 2, windowId: 2, index: 0, url: 'https://a.example/', pinned: true }),
                    createMockTab({ id: 3, windowId: 2, index: 1, url: 'https://b.example/' }),
                    createMockTab({ id: 4, windowId: 2, index: 2, url: 'https://c.example/' })
                ],
                windows: [createMockWindow({ id: 1, focused: true }), createMockWindow({ id: 2 })]
            });
            document.querySelectorAll('.tab-group-actions .btn-danger')[1].click();
            await flush();
            expect(chrome.tabs.remove).toHaveBeenCalledWith([2, 3, 4]);

            // Window 2 is gone, so creating a tab in it is refused
            chrome.tabs.create.mockImplementation(async ({ windowId }) => {
                if (windowId === 2) {
                    throw new Error('No window with id: 2');
                }
                return { id: 900 };
            });
            chrome.windows.create.mockResolvedValue({ id: 50, tabs: [{ id: 950 }] });

            undoButton().click();
            await flush();

            expect(chrome.windows.create).toHaveBeenCalledTimes(1);
            expect(chrome.windows.create).toHaveBeenCalledWith({ url: 'https://a.example/', focused: false });
            expect(chrome.tabs.update).toHaveBeenCalledWith(950, { pinned: true });
            // Only the first tab probes the old window; the rest follow the new one
            expect(chrome.tabs.create.mock.calls.map(([opts]) => [opts.url, opts.windowId])).toEqual([
                ['https://a.example/', 2],
                ['https://b.example/', 50],
                ['https://c.example/', 50]
            ]);
            expect(document.getElementById('status-message').textContent).toContain('3 tabs reopened');
        });

        test('Undo reports honestly when a closed tab had no URL to reopen', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, index: 0, url: 'https://a.example/' }),
                    createMockTab({ id: 2, index: 1, url: '' })
                ],
                windows: [createMockWindow({ id: 1, focused: true })]
            });
            manager.toggleTabSelection(1);
            manager.toggleTabSelection(2);
            await manager.closeSelectedTabs();

            undoButton().click();
            await flush();

            expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
            const status = document.getElementById('status-message');
            expect(status.textContent).toContain('1 of 2 tabs reopened');
            expect(status.classList.contains('warning')).toBe(true);
        });

        test('clicking Undo keeps keyboard focus in the page', async () => {
            const manager = await setup(1);
            await manager.closeTab(1);

            undoButton().focus();
            undoButton().click();
            await flush();

            expect(document.activeElement).toBe(document.getElementById('tabs-container'));
            expect(document.getElementById('status-message').textContent).toContain('1 tab reopened');
        });

        test('Undo is withdrawn by the next message and when the message hides', async () => {
            const manager = await setup(2);
            await manager.closeTab(1);
            expect(undoButton().onclick).not.toBeNull();

            manager.showStatusMessage('Something else');
            expect(undoButton().classList.contains('hidden')).toBe(true);
            expect(undoButton().onclick).toBeNull();

            await manager.closeTab(2);
            manager.hideStatusMessage();
            expect(undoButton().onclick).toBeNull();
        });

        test('a message offering Undo stays up longer, and waits while hovered or focused', async () => {
            const manager = await setup(1);
            const status = document.getElementById('status-message');
            const hidden = () => status.classList.contains('hidden');
            jest.useFakeTimers();
            try {
                manager.showStatusMessage('Closed', 'success', { label: 'Undo', handler: () => {} });
                jest.advanceTimersByTime(9000);
                expect(hidden()).toBe(false);
                jest.advanceTimersByTime(1500);
                expect(hidden()).toBe(true);

                manager.showStatusMessage('Closed', 'success', { label: 'Undo', handler: () => {} });
                status.dispatchEvent(new window.MouseEvent('mouseenter'));
                jest.advanceTimersByTime(60000);
                expect(hidden()).toBe(false);
                status.dispatchEvent(new window.MouseEvent('mouseleave'));
                jest.advanceTimersByTime(10500);
                expect(hidden()).toBe(true);

                manager.showStatusMessage('Closed', 'success', { label: 'Undo', handler: () => {} });
                undoButton().focus();
                jest.advanceTimersByTime(60000);
                expect(hidden()).toBe(false);
            } finally {
                jest.useRealTimers();
            }
        });

        test('deleting a session asks first and keeps it when declined', async () => {
            const manager = await createManager({ sessions: [createMockSession({ id: 's1', name: 'Work' })] });
            window.confirm.mockReturnValue(false);

            await manager.deleteSession('s1');

            expect(window.confirm).toHaveBeenCalledWith('Delete session "Work"? This cannot be undone.');
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
            expect(document.querySelectorAll('.session-item')).toHaveLength(1);
        });
    });

    describe('duplicate detection', () => {
        const url = 'https://example.com/';
        const closedIds = () => chrome.tabs.remove.mock.calls.map(([id]) => id);

        test.each([
            ['pinned', { pinned: true }],
            ['active', { active: true }],
            ['audible', { audible: true }],
            ['grouped', { groupId: 10 }]
        ])('keeps a %s copy over a more recently used plain one', async (_, special) => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, url, lastAccessed: 9000 }),
                    createMockTab({ id: 2, url, lastAccessed: 1000, ...special })
                ]
            });

            await manager.closeDuplicateTabs();

            expect(closedIds()).toEqual([1]);
        });

        test('ranks pinned over active over audible over grouped', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, url, groupId: 10, lastAccessed: 9000 }),
                    createMockTab({ id: 2, url, audible: true }),
                    createMockTab({ id: 3, url, active: true }),
                    createMockTab({ id: 4, url, pinned: true })
                ]
            });

            await manager.closeDuplicateTabs();

            expect(closedIds().sort()).toEqual([1, 2, 3]);
        });

        test('copies that are each active in their own window fall back to recency', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, url, windowId: 1, active: true, lastAccessed: 1000 }),
                    createMockTab({ id: 2, url, windowId: 2, active: true, lastAccessed: 2000 })
                ]
            });

            await manager.closeDuplicateTabs();

            expect(closedIds()).toEqual([1]);
        });

        test('the manager\'s own tab outranks even a pinned copy', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, url, pinned: true, lastAccessed: 9000 }),
                    createMockTab({ id: 2, url })
                ],
                ownTabId: 2
            });

            await manager.closeDuplicateTabs();

            expect(closedIds()).toEqual([1]);
        });

        test('a loading tab is listed by its pending URL', async () => {
            await createManager({ tabs: [createMockTab({ id: 1, title: '', url: '', pendingUrl: 'https://loading.example/page' })] });

            expect(document.querySelector('.tab-url').textContent).toBe('loading.example/page');
        });

        test('among equals, keeps the most recently used', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, url, pinned: true, lastAccessed: 1000 }),
                    createMockTab({ id: 2, url, pinned: true, lastAccessed: 2000 })
                ]
            });

            await manager.closeDuplicateTabs();

            expect(closedIds()).toEqual([1]);
        });

        test('a tab that is still loading is matched on its pending URL', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, url, lastAccessed: 2000 }),
                    createMockTab({ id: 2, url: '', pendingUrl: url, lastAccessed: 1000 })
                ]
            });

            await manager.closeDuplicateTabs();

            expect(closedIds()).toEqual([2]);
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

    describe('incognito', () => {
        test('the manifest keeps the extension out of incognito entirely', () => {
            const manifest = JSON.parse(
                fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8'));
            expect(manifest.incognito).toBe('not_allowed');
        });

        test('incognito tabs and windows are never listed', async () => {
            await createManager({
                tabs: [
                    createMockTab({ id: 1, windowId: 1, title: 'Public' }),
                    createMockTab({ id: 2, windowId: 2, title: 'Private', incognito: true })
                ],
                windows: [
                    createMockWindow({ id: 1, focused: true }),
                    createMockWindow({ id: 2, incognito: true })
                ]
            });

            expect(document.querySelectorAll('.tab-item')).toHaveLength(1);
            expect(document.body.textContent).not.toContain('Private');
            expect(document.getElementById('tab-count').textContent).toBe('1 tabs');
        });

        test('saving all windows skips incognito windows', async () => {
            const manager = await createManager();
            chrome.windows.getAll.mockResolvedValue([
                createMockWindow({ id: 1, tabs: [createMockTab({ id: 1, url: 'https://public.example/' })] }),
                createMockWindow({
                    id: 2,
                    incognito: true,
                    tabs: [createMockTab({ id: 2, url: 'https://private.example/', incognito: true })]
                })
            ]);
            document.getElementById('session-name').value = 'Everything';
            document.querySelector('input[name="save-type"][value="all"]').checked = true;

            await manager.saveSession();

            const saved = chrome.storage.local.set.mock.calls[0][0].sessions[0];
            expect(saved.windows).toHaveLength(1);
            expect(JSON.stringify(saved)).not.toContain('private.example');
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

        test('Save Session switches to the session view so the form is visible', async () => {
            await createManager();
            const tabView = document.getElementById('tab-view');
            const sessionView = document.getElementById('session-view');
            expect(tabView.classList.contains('active')).toBe(true);

            document.getElementById('save-session').click();

            expect(sessionView.classList.contains('active')).toBe(true);
            expect(tabView.classList.contains('active')).toBe(false);
            expect(document.getElementById('session-save-form').classList.contains('hidden')).toBe(false);
        });

        test('cancelling the save form returns to the tab view', async () => {
            await createManager();

            document.getElementById('save-session').click();
            document.getElementById('cancel-session-save').click();

            expect(document.getElementById('tab-view').classList.contains('active')).toBe(true);
            expect(document.getElementById('session-view').classList.contains('active')).toBe(false);
            expect(document.getElementById('session-save-form').classList.contains('hidden')).toBe(true);
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

        const savedTab = (url, overrides = {}) =>
            ({ url, title: url, pinned: false, muted: false, groupId: -1, ...overrides });

        // Give every created tab its own id so grouping can be asserted.
        const mockTabIds = () => {
            let nextId = 1000;
            chrome.tabs.create.mockImplementation(async ({ url }) => ({ id: nextId++, url }));
        };

        test('restore applies pinned and muted to the first tab', async () => {
            const manager = await createManager({
                sessions: [createMockSession({
                    id: 's',
                    windows: [{ id: 1, tabs: [savedTab('https://a.com/', { pinned: true, muted: true })], groups: [] }]
                })]
            });

            await manager.openSession('s');

            expect(chrome.tabs.update).toHaveBeenCalledWith(901, { pinned: true, muted: true });
        });

        test('restore keeps the saved tab order and groups inside the new window', async () => {
            const manager = await createManager({
                sessions: [createMockSession({
                    id: 's',
                    windows: [{
                        id: 1,
                        tabs: [
                            savedTab('https://a.com/'),
                            savedTab('https://b.com/'),
                            savedTab('https://c.com/', { groupId: 10 }),
                            savedTab('https://d.com/', { groupId: 10 }),
                            savedTab('https://e.com/')
                        ],
                        groups: [{ id: 10, title: 'Work', color: 'green' }]
                    }]
                })]
            });
            mockTabIds();

            await manager.openSession('s');

            expect(chrome.tabs.create.mock.calls.map(([opts]) => opts.url))
                .toEqual(['https://b.com/', 'https://c.com/', 'https://d.com/', 'https://e.com/']);
            expect(chrome.tabs.group).toHaveBeenCalledTimes(1);
            expect(chrome.tabs.group).toHaveBeenCalledWith({
                tabIds: [1001, 1002],
                createProperties: { windowId: 99 }
            });
        });

        test('restore skips URLs that are not http, https or file', async () => {
            const manager = await createManager({
                sessions: [createMockSession({
                    id: 's',
                    windows: [{
                        id: 1,
                        tabs: [
                            savedTab('chrome-extension://test-extension-id/manager.html'),
                            savedTab('javascript:alert(1)'),
                            savedTab('https://a.com/'),
                            savedTab('chrome://settings/'),
                            savedTab('data:text/html,<script>alert(1)</script>'),
                            savedTab('view-source:https://a.com/'),
                            savedTab('not a url'),
                            savedTab('file:///tmp/notes.txt')
                        ],
                        groups: []
                    }]
                })]
            });

            await manager.openSession('s');

            expect(chrome.windows.create).toHaveBeenCalledWith({ url: 'https://a.com/', focused: false });
            expect(chrome.tabs.create.mock.calls.map(([opts]) => opts.url)).toEqual(['file:///tmp/notes.txt']);
            const status = document.getElementById('status-message');
            expect(status.textContent).toContain('restored 2 of 8 tabs (6 skipped)');
            expect(status.classList.contains('warning')).toBe(true);
        });

        test('one tab failing to open does not stop the rest of the restore', async () => {
            const manager = await createManager({
                sessions: [createMockSession({
                    id: 's',
                    windows: [
                        { id: 1, tabs: [savedTab('https://a.com/'), savedTab('https://bad.com/'), savedTab('https://c.com/')], groups: [] },
                        { id: 2, tabs: [savedTab('https://d.com/')], groups: [] }
                    ]
                })]
            });
            chrome.tabs.create.mockImplementation(async ({ url }) => {
                if (url === 'https://bad.com/') {
                    throw new Error('blocked');
                }
                return { id: 900 };
            });

            await manager.openSession('s');

            expect(chrome.tabs.create.mock.calls.map(([opts]) => opts.url))
                .toEqual(['https://bad.com/', 'https://c.com/']);
            expect(chrome.windows.create).toHaveBeenCalledTimes(2);
            expect(document.getElementById('status-message').textContent)
                .toContain('restored 3 of 4 tabs (1 skipped)');
        });

        test('a window that cannot be created is reported, and later windows still open', async () => {
            const manager = await createManager({
                sessions: [createMockSession({
                    id: 's',
                    windows: [
                        { id: 1, tabs: [savedTab('https://a.com/')], groups: [] },
                        { id: 2, tabs: [savedTab('https://b.com/')], groups: [] }
                    ]
                })]
            });
            chrome.windows.create.mockRejectedValueOnce(new Error('nope'));

            await manager.openSession('s');

            expect(chrome.windows.create).toHaveBeenCalledTimes(2);
            expect(document.getElementById('status-message').textContent)
                .toContain('restored 1 of 2 tabs');
        });

        test('a first tab Chrome refuses does not cost the rest of the window', async () => {
            const manager = await createManager({
                sessions: [createMockSession({
                    id: 's',
                    windows: [{
                        id: 1,
                        tabs: [
                            savedTab('file:///tmp/report.pdf', { pinned: true }),
                            savedTab('https://a.com/', { pinned: true }),
                            savedTab('https://b.com/')
                        ],
                        groups: []
                    }]
                })]
            });
            chrome.windows.create.mockImplementation(async ({ url }) => {
                if (url.startsWith('file:')) {
                    throw new Error('Cannot navigate to a file URL without local file access');
                }
                return { id: 99, tabs: [{ id: 901 }] };
            });

            await manager.openSession('s');

            expect(chrome.windows.create.mock.calls.map(([opts]) => opts.url))
                .toEqual(['file:///tmp/report.pdf', 'https://a.com/']);
            expect(chrome.tabs.update).toHaveBeenCalledWith(901, { pinned: true, muted: false });
            expect(chrome.tabs.create.mock.calls.map(([opts]) => opts.url)).toEqual(['https://b.com/']);
            expect(document.getElementById('status-message').textContent)
                .toContain('restored 2 of 3 tabs (1 skipped)');
        });

        test('the allow-list is not fooled by case, whitespace or nested schemes', async () => {
            const hostile = [
                'JaVaScRiPt:alert(1)',
                '  javascript:alert(1)',
                'java\tscript:alert(1)',
                'blob:https://a.com/1234',
                'filesystem:https://a.com/temporary/x',
                'data:text/html,hi',
                'about:blank',
                'chrome-extension://other-extension/page.html',
                ''
            ];
            const manager = await createManager({
                sessions: [createMockSession({
                    id: 's',
                    windows: [{ id: 1, tabs: [...hostile.map(url => savedTab(url)), savedTab('HTTPS://A.com')], groups: [] }]
                })]
            });

            await manager.openSession('s');

            // Only the http(s) entry opens, in its normalised form
            expect(chrome.windows.create).toHaveBeenCalledTimes(1);
            expect(chrome.windows.create).toHaveBeenCalledWith({ url: 'https://a.com/', focused: false });
            expect(chrome.tabs.create).not.toHaveBeenCalled();
        });

        test('a group that cannot be recreated leaves its tabs restored', async () => {
            const manager = await createManager({
                sessions: [createMockSession({
                    id: 's',
                    windows: [{
                        id: 1,
                        tabs: [
                            savedTab('https://a.com/'),
                            savedTab('https://b.com/', { groupId: 10 }),
                            savedTab('https://gone.com/', { groupId: 10 }),
                            savedTab('https://c.com/', { groupId: 11 })
                        ],
                        groups: [{ id: 10, title: 'One', color: 'blue' }, { id: 11, title: 'Two', color: 'red' }]
                    }]
                })]
            });
            let nextId = 1000;
            chrome.tabs.create.mockImplementation(async ({ url }) => {
                if (url === 'https://gone.com/') {
                    throw new Error('blocked');
                }
                return { id: nextId++ };
            });
            chrome.tabs.group.mockRejectedValueOnce(new Error('group failed')).mockResolvedValueOnce(78);

            await manager.openSession('s');

            // The failed tab is left out of its group; the second group still forms
            expect(chrome.tabs.group.mock.calls.map(([opts]) => opts.tabIds)).toEqual([[1000], [1001]]);
            expect(chrome.tabGroups.update).toHaveBeenCalledTimes(1);
            expect(chrome.tabGroups.update).toHaveBeenCalledWith(78, { title: 'Two', color: 'red' });
            expect(document.getElementById('status-message').textContent)
                .toContain('restored 3 of 4 tabs (1 skipped)');
        });

        test('a session with nothing restorable reports an error instead of "opened"', async () => {
            const manager = await createManager({
                sessions: [createMockSession({
                    id: 's',
                    windows: [{ id: 1, tabs: [savedTab('chrome://settings/')], groups: [] }]
                })]
            });

            await manager.openSession('s');

            expect(chrome.windows.create).not.toHaveBeenCalled();
            const status = document.getElementById('status-message');
            expect(status.textContent).toContain('no tabs could be restored');
            expect(status.classList.contains('error')).toBe(true);
        });

        test('Open buttons are disabled while a restore is running', async () => {
            const manager = await createManager({ sessions: [session()] });
            const openButton = () => Array.from(document.querySelectorAll('#sessions-list button'))
                .find(btn => btn.textContent === 'Open');

            const restore = manager.openSession('session-1');
            expect(openButton().disabled).toBe(true);

            await restore;
            expect(openButton().disabled).toBe(false);
        });

        test('a second Open while a restore is running does not restore twice', async () => {
            const manager = await createManager({ sessions: [session()] });

            const first = manager.openSession('session-1');
            const second = manager.openSession('session-1');
            await Promise.all([first, second]);

            expect(chrome.windows.create).toHaveBeenCalledTimes(1);

            // The guard is released afterwards
            await manager.openSession('session-1');
            expect(chrome.windows.create).toHaveBeenCalledTimes(2);
        });

        test('saving keeps loading tabs via pendingUrl and drops unrestorable ones', async () => {
            const manager = await createManager();
            chrome.windows.getCurrent.mockResolvedValue(createMockWindow({
                id: 1,
                tabs: [
                    createMockTab({ id: 1, url: 'https://a.com/' }),
                    createMockTab({ id: 2, url: '', pendingUrl: 'https://loading.example/' }),
                    createMockTab({ id: 3, url: 'chrome-extension://test-extension-id/manager.html' }),
                    createMockTab({ id: 4, url: 'chrome://newtab/' })
                ]
            }));
            document.getElementById('session-name').value = 'Mine';

            await manager.saveSession();

            const saved = chrome.storage.local.set.mock.calls[0][0].sessions[0];
            expect(saved.windows[0].tabs.map(tab => tab.url))
                .toEqual(['https://a.com/', 'https://loading.example/']);
            const status = document.getElementById('status-message');
            expect(status.textContent).toContain('2 tabs that cannot be restored were left out');
            expect(status.classList.contains('warning')).toBe(true);
        });

        test('the manager\'s own tab being left out of a save is not worth a warning', async () => {
            const manager = await createManager({ ownTabId: 2 });
            chrome.windows.getCurrent.mockResolvedValue(createMockWindow({
                id: 1,
                tabs: [
                    createMockTab({ id: 1, url: 'https://a.com/' }),
                    createMockTab({ id: 2, url: 'chrome-extension://test-extension-id/manager.html' })
                ]
            }));
            document.getElementById('session-name').value = 'Mine';

            await manager.saveSession();

            const saved = chrome.storage.local.set.mock.calls[0][0].sessions[0];
            expect(saved.windows[0].tabs.map(tab => tab.url)).toEqual(['https://a.com/']);
            const status = document.getElementById('status-message');
            expect(status.textContent).toContain('Session saved successfully');
            expect(status.classList.contains('warning')).toBe(false);
        });

        test('saving a window with nothing restorable saves no session', async () => {
            const manager = await createManager();
            chrome.windows.getCurrent.mockResolvedValue(createMockWindow({
                id: 1,
                tabs: [createMockTab({ id: 1, url: 'chrome://newtab/' })]
            }));
            document.getElementById('session-name').value = 'Empty';

            await manager.saveSession();

            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        test('deleteSession persists the remaining sessions', async () => {
            const manager = await createManager({ sessions: [session()] });

            await manager.deleteSession('session-1');

            expect(chrome.storage.local.set).toHaveBeenCalledWith({ sessions: [] });
            expect(document.querySelector('#sessions-list .empty-state')).not.toBeNull();
        });
    });

    describe('bulk operations on mixed selections', () => {
        const mixed = () => createManager({
            tabs: [
                createMockTab({ id: 1, windowId: 1, index: 0, pinned: true }),
                createMockTab({ id: 2, windowId: 1, index: 1 }),
                createMockTab({ id: 3, windowId: 1, index: 2 }),
                createMockTab({ id: 4, windowId: 2, index: 0 }),
                createMockTab({ id: 5, windowId: 3, index: 0 })
            ],
            windows: [
                createMockWindow({ id: 1, focused: true }),
                createMockWindow({ id: 2 }),
                createMockWindow({ id: 3, type: 'popup' })
            ]
        });
        const select = (manager, ...ids) => ids.forEach(id => manager.toggleTabSelection(id));
        const status = () => document.getElementById('status-message');

        test('grouping makes one group per window, in place', async () => {
            const manager = await mixed();
            select(manager, 4, 3, 2); // ticked out of order
            document.getElementById('group-name').value = 'Work';
            chrome.tabs.group.mockResolvedValueOnce(71).mockResolvedValueOnce(72);

            await manager.confirmGroupCreation();

            expect(chrome.tabs.group.mock.calls.map(([opts]) => opts)).toEqual([
                { tabIds: [2, 3], createProperties: { windowId: 1 } },
                { tabIds: [4], createProperties: { windowId: 2 } }
            ]);
            expect(chrome.tabGroups.update).toHaveBeenCalledWith(71, { title: 'Work', color: 'grey' });
            expect(chrome.tabGroups.update).toHaveBeenCalledWith(72, { title: 'Work', color: 'grey' });
            expect(status().textContent).toContain('Created 2 groups named Work (one per window) with 3 tabs');
        });

        test('grouping leaves pinned tabs and popup-window tabs out, and says so', async () => {
            const manager = await mixed();
            select(manager, 1, 2, 5);

            await manager.confirmGroupCreation();

            expect(chrome.tabs.group).toHaveBeenCalledTimes(1);
            expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [2], createProperties: { windowId: 1 } });
            expect(status().textContent).toContain('Created group Untitled with 1 tab; 2 pinned or app-window tabs left out');
            expect(status().classList.contains('warning')).toBe(true);
        });

        test('grouping with nothing groupable explains why and keeps the selection', async () => {
            const manager = await mixed();
            select(manager, 1, 5);

            await manager.confirmGroupCreation();

            expect(chrome.tabs.group).not.toHaveBeenCalled();
            expect(status().textContent).toContain('cannot be grouped');
            expect(document.getElementById('selected-count').textContent).toBe('2 selected');
        });

        test('a window whose group fails does not stop the other windows', async () => {
            const manager = await mixed();
            select(manager, 2, 4);
            chrome.tabs.group.mockRejectedValueOnce(new Error('No tab with id: 2')).mockResolvedValueOnce(72);

            await manager.confirmGroupCreation();

            expect(chrome.tabGroups.update).toHaveBeenCalledTimes(1);
            expect(status().textContent).toContain('1 tab could not be grouped');
            // What failed stays selected so it can be retried
            expect(Array.from(manager.selectedTabs)).toEqual([2]);
        });

        test('asks Chrome for windows of every type, so app and devtools windows are recognised', async () => {
            const manager = await createManager({
                tabs: [
                    createMockTab({ id: 1, windowId: 1, index: 0 }),
                    createMockTab({ id: 2, windowId: 7, index: 0 }),
                    createMockTab({ id: 3, windowId: 8, index: 0 })
                ],
                windows: [
                    createMockWindow({ id: 1, focused: true }),
                    createMockWindow({ id: 7, type: 'devtools' }),
                    createMockWindow({ id: 8, type: 'app' })
                ]
            });
            // windows.getAll leaves app and devtools windows out by default
            expect(chrome.windows.getAll.mock.calls[0][0].windowTypes)
                .toEqual(expect.arrayContaining(['normal', 'popup', 'app', 'devtools']));

            select(manager, 1, 2, 3);
            await manager.moveToNewWindow();

            expect(chrome.windows.create).toHaveBeenCalledWith({ tabId: 1 });
            expect(chrome.tabs.move).not.toHaveBeenCalled();
            expect(status().textContent).toContain('1 tab moved to new window; 2 tabs in popup or app windows left in place');
        });

        test('a group that is created but cannot be named still counts as grouped', async () => {
            const manager = await mixed();
            select(manager, 2, 3);
            chrome.tabGroups.update.mockRejectedValue(new Error('No group with id'));

            await manager.confirmGroupCreation();

            expect(status().textContent).toContain('with 2 tabs');
            expect(status().textContent).not.toContain('could not be grouped');
            expect(manager.selectedTabs.size).toBe(0);
        });

        test('a tab in a window opened since the last refresh is attempted, not skipped', async () => {
            const manager = await createManager({
                tabs: [createMockTab({ id: 1, windowId: 42, index: 0 })],
                windows: []
            });
            select(manager, 1);

            await manager.confirmGroupCreation();

            expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1], createProperties: { windowId: 42 } });
        });

        test('when every group fails, the list is refreshed and the error shown', async () => {
            const manager = await mixed();
            select(manager, 2);
            chrome.tabs.group.mockRejectedValue(new Error('No tab with id: 2'));
            chrome.tabs.query.mockClear();

            await manager.confirmGroupCreation();

            expect(status().classList.contains('error')).toBe(true);
            expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
        });

        test('moving keeps tab-strip order and leaves popup-window tabs in place', async () => {
            const manager = await mixed();
            select(manager, 5, 4, 3, 2);

            await manager.moveToNewWindow();

            expect(chrome.windows.create).toHaveBeenCalledWith({ tabId: 2 });
            expect(chrome.tabs.move).toHaveBeenCalledWith([3, 4], { windowId: 99, index: -1 });
            expect(status().textContent).toContain('3 tabs moved to new window; 1 tab in popup or app windows left in place');
        });

        test('a failed move refreshes the list', async () => {
            const manager = await mixed();
            select(manager, 2, 3);
            chrome.tabs.move.mockRejectedValue(new Error('No tab with id: 3'));
            chrome.tabs.query.mockClear();

            await manager.moveToNewWindow();

            expect(status().textContent).toContain('Not every tab could be moved');
            expect(status().classList.contains('error')).toBe(true);
            expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
        });

        test('a failed ungroup refreshes the list', async () => {
            const manager = await mixed();
            select(manager, 2);
            chrome.tabs.ungroup.mockRejectedValue(new Error('No tab with id: 2'));
            chrome.tabs.query.mockClear();

            await manager.ungroupSelectedTabs();

            expect(status().classList.contains('error')).toBe(true);
            expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('session storage', () => {
        const stored = (id, name) => createMockSession({ id, name, windows: [] });
        const useCurrentWindow = () => chrome.windows.getCurrent.mockResolvedValue(createMockWindow({
            id: 1,
            tabs: [createMockTab({ id: 1, url: 'https://a.com/' })]
        }));
        const sessionNames = () =>
            Array.from(document.querySelectorAll('.session-name')).map(el => el.textContent);

        test('saving keeps sessions another manager page stored in the meantime', async () => {
            const manager = await createManager({ sessions: [stored('1', 'Mine')] });
            useCurrentWindow();
            // Another page saved "Theirs" after this one loaded
            chrome.storage.local.get.mockResolvedValue({ sessions: [stored('1', 'Mine'), stored('2', 'Theirs')] });
            document.getElementById('session-name').value = 'New';

            await manager.saveSession();

            const written = chrome.storage.local.set.mock.calls[0][0].sessions;
            expect(written.map(session => session.name)).toEqual(['Mine', 'Theirs', 'New']);
            expect(sessionNames()).toEqual(['Mine', 'Theirs', 'New']);
        });

        test('deleting does not undo what another manager page did', async () => {
            const manager = await createManager({ sessions: [stored('1', 'Mine'), stored('2', 'Old')] });
            // Another page deleted "Old" and saved "Theirs"
            chrome.storage.local.get.mockResolvedValue({ sessions: [stored('1', 'Mine'), stored('3', 'Theirs')] });

            await manager.deleteSession('1');

            const written = chrome.storage.local.set.mock.calls[0][0].sessions;
            expect(written.map(session => session.name)).toEqual(['Theirs']);
            expect(sessionNames()).toEqual(['Theirs']);
        });

        test('a failed write leaves the list showing what is really stored', async () => {
            const manager = await createManager({ sessions: [stored('1', 'Mine')] });
            chrome.storage.local.set.mockRejectedValue(new Error('disk error'));

            await manager.deleteSession('1');

            expect(sessionNames()).toEqual(['Mine']);
            expect(manager.sessions).toHaveLength(1);
            expect(document.getElementById('status-message').classList.contains('error')).toBe(true);
        });

        test('running out of storage is reported in plain words', async () => {
            const manager = await createManager();
            useCurrentWindow();
            chrome.storage.local.set.mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));
            document.getElementById('session-name').value = 'Big';

            await manager.saveSession();

            expect(document.getElementById('status-message').textContent).toContain('Storage is full');
            expect(sessionNames()).toEqual([]);
        });

        test('changes made by another manager page show up without a reload', async () => {
            await createManager({ sessions: [stored('1', 'Mine')] });
            const [onChanged] = chrome.storage.onChanged.addListener.mock.calls[0];

            onChanged({ sessions: { newValue: [stored('1', 'Mine'), stored('2', 'Theirs')] } }, 'local');
            expect(sessionNames()).toEqual(['Mine', 'Theirs']);

            onChanged({ sessions: {} }, 'local'); // key removed
            expect(sessionNames()).toEqual([]);
        });

        test('unrelated storage changes are ignored', async () => {
            await createManager({ sessions: [stored('1', 'Mine')] });
            const [onChanged] = chrome.storage.onChanged.addListener.mock.calls[0];

            onChanged({ sessions: { newValue: [] } }, 'sync');
            onChanged({ other: { newValue: 1 } }, 'local');

            expect(sessionNames()).toEqual(['Mine']);
        });

        test('two pages saving at the same moment both keep their session', async () => {
            // Backed by a real value, so an unserialized read-modify-write
            // would lose one of the two writes.
            let storedSessions = [];
            const useRealisticStorage = () => {
                chrome.storage.local.get.mockImplementation(async () => {
                    await flush();
                    return { sessions: storedSessions };
                });
                chrome.storage.local.set.mockImplementation(async ({ sessions }) => {
                    await flush();
                    storedSessions = sessions;
                });
            };
            const pageOne = await createManager();
            useRealisticStorage();
            const pageTwo = new TabManager();
            await flush();
            useCurrentWindow();

            document.getElementById('session-name').value = 'Both';
            await Promise.all([pageOne.saveSession(), pageTwo.saveSession()]);

            expect(storedSessions).toHaveLength(2);
            expect(navigator.locks.request).toHaveBeenCalledWith('tabularasa-sessions', expect.any(Function));
        });

        test('a failure inside the lock releases it for the next write', async () => {
            const manager = await createManager({ sessions: [stored('1', 'Mine'), stored('2', 'Other')] });
            chrome.storage.local.set.mockRejectedValueOnce(new Error('disk error'));

            await manager.deleteSession('1');
            await manager.deleteSession('2');

            expect(chrome.storage.local.set).toHaveBeenLastCalledWith({ sessions: [stored('1', 'Mine')] });
        });

        test('a damaged sessions value in storage is treated as no sessions', async () => {
            const manager = await createManager({ sessions: 'not an array' });
            expect(sessionNames()).toEqual([]);

            useCurrentWindow();
            document.getElementById('session-name').value = 'Fresh';
            await manager.saveSession();

            const written = chrome.storage.local.set.mock.calls[0][0].sessions;
            expect(written.map(session => session.name)).toEqual(['Fresh']);
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
