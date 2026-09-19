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
const onMessage = chrome.runtime.onMessage.addListener.mock.calls[0][0];

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
    chrome.runtime.sendMessage.mockResolvedValue(undefined);
});

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

        test('opens the manager in a new tab when none exists', async () => {
            chrome.tabs.query.mockResolvedValue([]);
            chrome.tabs.create.mockResolvedValue({ id: 9 });

            await onActionClicked();

            expect(chrome.tabs.create).toHaveBeenCalledWith({
                url: 'manager.html',
                active: true
            });
        });
    });

    describe('session messages', () => {
        test('GET_SESSIONS responds with stored sessions', () => {
            const sessions = [createMockSession()];
            chrome.storage.local.get.mockImplementation((keys, callback) => callback({ sessions }));
            const sendResponse = jest.fn();

            const keepChannelOpen = onMessage({ type: 'GET_SESSIONS' }, {}, sendResponse);

            expect(keepChannelOpen).toBe(true);
            expect(sendResponse).toHaveBeenCalledWith({ sessions });
        });

        test('SAVE_SESSION appends the session and confirms', () => {
            const existing = createMockSession({ id: 'existing' });
            const added = createMockSession({ id: 'added' });
            chrome.storage.local.get.mockImplementation((keys, callback) => callback({ sessions: [existing] }));
            chrome.storage.local.set.mockImplementation((data, callback) => callback());
            const sendResponse = jest.fn();

            onMessage({ type: 'SAVE_SESSION', session: added }, {}, sendResponse);

            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                { sessions: [existing, added] },
                expect.any(Function)
            );
            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });

        test('DELETE_SESSION removes only the matching session', () => {
            const keep = createMockSession({ id: 'keep' });
            const drop = createMockSession({ id: 'drop' });
            chrome.storage.local.get.mockImplementation((keys, callback) => callback({ sessions: [keep, drop] }));
            chrome.storage.local.set.mockImplementation((data, callback) => callback());
            const sendResponse = jest.fn();

            onMessage({ type: 'DELETE_SESSION', sessionId: 'drop' }, {}, sendResponse);

            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                { sessions: [keep] },
                expect.any(Function)
            );
            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });
    });

    describe('installation', () => {
        test('initializes session storage when empty', () => {
            chrome.storage.local.get.mockImplementation((keys, callback) => callback({}));
            // background.ts calls set without a callback here, so clear any
            // callback-invoking implementation left over from other tests
            chrome.storage.local.set.mockImplementation(() => {});

            onInstalled();

            expect(chrome.action.setPopup).toHaveBeenCalledWith({ popup: '' });
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
