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
const onTabCreated = chrome.tabs.onCreated.addListener.mock.calls[0][0];
const onTabRemoved = chrome.tabs.onRemoved.addListener.mock.calls[0][0];
const onTabUpdated = chrome.tabs.onUpdated.addListener.mock.calls[0][0];
const onTabActivated = chrome.tabs.onActivated.addListener.mock.calls[0][0];
const onMessage = chrome.runtime.onMessage.addListener.mock.calls[0][0];

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
    chrome.runtime.sendMessage.mockResolvedValue(undefined);
});

describe('background service worker', () => {
    describe('event forwarding to the manager', () => {
        test('forwards tab removal without requiring prior manager registration', () => {
            // Regression: forwarding used to depend on an in-memory set of
            // manager tab ids, which is lost whenever the service worker is
            // restarted, silently breaking live updates.
            onTabRemoved(5, { windowId: 1, isWindowClosing: false });

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'TAB_REMOVED',
                tabId: 5,
                removeInfo: { windowId: 1, isWindowClosing: false }
            });
        });

        test('forwards tab creation, update, and activation events', () => {
            const tab = createMockTab({ id: 7 });

            onTabCreated(tab);
            onTabUpdated(7, { status: 'complete' }, tab);
            onTabActivated({ tabId: 7, windowId: 1 });

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'TAB_CREATED', tab });
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'TAB_UPDATED',
                tabId: 7,
                changeInfo: { status: 'complete' },
                tab
            });
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'TAB_ACTIVATED',
                activeInfo: { tabId: 7, windowId: 1 }
            });
        });

        test('ignores send failures when no manager tab is open', async () => {
            chrome.runtime.sendMessage.mockRejectedValue(new Error('no receiver'));

            expect(() => onTabRemoved(5, {})).not.toThrow();
            await flush(); // would fail the test on an unhandled rejection
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
