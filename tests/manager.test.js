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
            chrome.tabs.remove.mockRejectedValueOnce(new Error('No tab with id: 2'));
            chrome.tabs.query.mockResolvedValue([]);

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
            await setup(4);

            closeAll().click();
            await flush();

            expect(window.confirm).not.toHaveBeenCalled();
            expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2, 3, 4]);
        });

        test('a large close asks first and does nothing when declined', async () => {
            await setup(5);
            window.confirm.mockReturnValue(false);

            closeAll().click();
            await flush();

            expect(window.confirm).toHaveBeenCalledWith('Close 5 tabs?');
            expect(chrome.tabs.remove).not.toHaveBeenCalled();
            expect(document.querySelectorAll('.tab-item')).toHaveLength(5);
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
            expect(window.confirm.mock.calls[0][0]).toContain('1 of them are hidden');
            expect(chrome.tabs.remove).not.toHaveBeenCalled();
            expect(document.getElementById('selected-count').textContent).toContain('2 selected');
        });

        test('Close Duplicates confirms a large close', async () => {
            const manager = await createManager({
                tabs: Array.from({ length: 6 }, (_, i) =>
                    createMockTab({ id: i + 1, index: i, url: 'https://example.com/', lastAccessed: 6 - i }))
            });
            window.confirm.mockReturnValue(false);

            await manager.closeDuplicateTabs();

            expect(window.confirm).toHaveBeenCalledWith('Close 5 tabs?');
            expect(chrome.tabs.remove).not.toHaveBeenCalled();
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

        test('Undo falls back to the current window when the old window is gone', async () => {
            const manager = await setup(1);
            await manager.closeTab(1);
            chrome.tabs.create
                .mockRejectedValueOnce(new Error('No window with id: 1'))
                .mockResolvedValueOnce({ id: 900 });

            undoButton().click();
            await flush();

            expect(chrome.tabs.create).toHaveBeenLastCalledWith(
                { url: 'https://example.com/1', pinned: false, active: false });
            expect(document.getElementById('status-message').textContent).toContain('1 tabs reopened');
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

        test('a message offering Undo stays up longer than a plain one', async () => {
            jest.useFakeTimers();
            try {
                document.body.innerHTML = bodyHtml;
                chrome.tabs.getCurrent.mockResolvedValue(undefined);
                const manager = new TabManager();
                manager.showStatusMessage('Closed', 'success', { label: 'Undo', handler: () => {} });

                jest.advanceTimersByTime(9000);
                expect(document.getElementById('status-message').classList.contains('hidden')).toBe(false);
                jest.advanceTimersByTime(1500);
                expect(document.getElementById('status-message').classList.contains('hidden')).toBe(true);
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
