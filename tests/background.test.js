/**
 * Tests for the real background service worker (src/background.ts) with the
 * Chrome APIs mocked.
 */

// Loading the source registers all listeners on the chrome mocks. The
// listener callbacks are captured here, at module scope, because the
// jest.clearAllMocks() in setup.js wipes call records before each test.
require('../src/background.ts');

const onInstalled = chrome.runtime.onInstalled.addListener.mock.calls[0][0];
const onActionClicked = chrome.action.onClicked.addListener.mock.calls[0][0];
// Counted here for the same reason: how many browser-event listeners the
// worker registered while loading.
const browserEventListeners = [
    ...Object.values(chrome.tabs),
    ...Object.values(chrome.tabGroups),
    ...Object.values(chrome.windows)
].filter(member => member && member.addListener)
    .reduce((count, event) => count + event.addListener.mock.calls.length, 0);
const messageListeners = chrome.runtime.onMessage.addListener.mock.calls.length;

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('background service worker', () => {
    describe('browser events', () => {
        test('the worker listens to no tab, window or group events', () => {
            // The manager page subscribes to these itself. A listener here
            // would wake the service worker for every tab event in the
            // browser, even with no manager open.
            expect(browserEventListeners).toBe(0);
        });
    });

    describe('toolbar action', () => {
        test('focuses an existing manager tab instead of opening another', async () => {
            chrome.tabs.query.mockResolvedValue([{ id: 3, windowId: 4 }]);
            chrome.tabs.update.mockResolvedValue(undefined);
            chrome.windows.update.mockResolvedValue(undefined);

            await onActionClicked();

            expect(chrome.tabs.update).toHaveBeenCalledWith(3, { active: true });
            expect(chrome.windows.update).toHaveBeenCalledWith(4, { focused: true });
            expect(chrome.tabs.create).not.toHaveBeenCalled();
        });

        test('finds a manager tab opened with a hash or query string', async () => {
            chrome.tabs.query.mockResolvedValue([]);
            chrome.tabs.create.mockResolvedValue({ id: 9 });

            await onActionClicked();

            expect(chrome.tabs.query).toHaveBeenCalledWith({
                url: 'chrome-extension://test-extension-id/manager.html*'
            });
        });

        test('opens the manager in a new tab when none exists', async () => {
            chrome.tabs.query.mockResolvedValue([]);
            chrome.tabs.create.mockResolvedValue({ id: 9 });

            await onActionClicked();

            expect(chrome.tabs.create).toHaveBeenCalledWith({
                url: 'manager.html',
                active: true
            });
        });

        test('opens a new manager when the found one closed before it could be focused', async () => {
            chrome.tabs.query.mockResolvedValue([{ id: 3, windowId: 4 }]);
            chrome.tabs.update.mockRejectedValue(new Error('No tab with id: 3'));
            chrome.tabs.create.mockResolvedValue({ id: 9 });

            await expect(onActionClicked()).resolves.toBeUndefined();

            expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'manager.html', active: true });
        });

        test('never rejects, even when nothing can be opened', async () => {
            chrome.tabs.query.mockRejectedValue(new Error('query failed'));
            chrome.tabs.create.mockRejectedValue(new Error('create failed'));

            await expect(onActionClicked()).resolves.toBeUndefined();
        });
    });

    describe('messages', () => {
        test('the worker exposes no message API', () => {
            // The manager reads and writes sessions itself; the old
            // GET/SAVE/DELETE_SESSION handlers were unused and racy.
            expect(messageListeners).toBe(0);
        });
    });

    describe('installation', () => {
        test('initializes session storage when empty', () => {
            chrome.storage.local.get.mockImplementation((keys, callback) => callback({}));
            // background.ts calls set without a callback here, so clear any
            // callback-invoking implementation left over from other tests
            chrome.storage.local.set.mockImplementation(() => {});

            onInstalled();

            expect(chrome.storage.local.set).toHaveBeenCalledWith({ sessions: [] });
        });

        test('preserves existing sessions on reinstall', () => {
            const sessions = [createMockSession()];
            chrome.storage.local.get.mockImplementation((keys, callback) => callback({ sessions }));

            onInstalled();

            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });
    });
});
