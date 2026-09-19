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

    describe('live updates', () => {
        const REFRESH_DELAY_MS = 150;
        const fire = (event, ...args) =>
            event.addListener.mock.calls.forEach(([listener]) => listener(...args));
        const setHidden = (hidden) => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
            document.dispatchEvent(new window.Event('visibilitychange'));
        };
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

            setHidden(false);
            await wait(REFRESH_DELAY_MS + 50);
            expect(chrome.tabs.query).toHaveBeenCalledTimes(1);
            expect(document.querySelectorAll('.tab-item')).toHaveLength(0);
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

            const search = document.getElementById('search-input');
            search.value = 'Tab 1';
            search.dispatchEvent(new window.Event('input'));

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

        test('Close Duplicates confirms a large close', async () => {
            const manager = await createManager({
                tabs: Array.from({ length: 11 }, (_, i) =>
                    createMockTab({ id: i + 1, index: i, url: 'https://example.com/', lastAccessed: 11 - i }))
            });
            window.confirm.mockReturnValue(false);

            await manager.closeDuplicateTabs();

            expect(window.confirm).toHaveBeenCalledWith('Close 10 tabs?');
            expect(chrome.tabs.remove).not.toHaveBeenCalled();
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
