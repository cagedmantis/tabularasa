/**
 * Jest setup file for Tabularasa tests
 * Sets up global mocks and utilities for testing
 *
 * Note: tests run in jsdom, so document/window/URL are the real jsdom
 * implementations. Only the Chrome extension APIs are mocked here.
 */

// Mock Chrome Extension APIs
global.chrome = {
    tabs: {
        query: jest.fn(),
        get: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        create: jest.fn(),
        move: jest.fn(),
        group: jest.fn(),
        ungroup: jest.fn(),
        onCreated: {
            addListener: jest.fn()
        },
        onRemoved: {
            addListener: jest.fn()
        },
        onUpdated: {
            addListener: jest.fn()
        },
        onActivated: {
            addListener: jest.fn()
        },
        onMoved: {
            addListener: jest.fn()
        },
        onAttached: {
            addListener: jest.fn()
        }
    },
    tabGroups: {
        query: jest.fn(),
        update: jest.fn(),
        onCreated: {
            addListener: jest.fn()
        },
        onUpdated: {
            addListener: jest.fn()
        },
        onRemoved: {
            addListener: jest.fn()
        }
    },
    windows: {
        getAll: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        getCurrent: jest.fn(),
        onRemoved: {
            addListener: jest.fn()
        }
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
            clear: jest.fn()
        }
    },
    runtime: {
        getURL: jest.fn((path) => `chrome-extension://test-extension-id/${path}`),
        onInstalled: {
            addListener: jest.fn()
        },
        onMessage: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn()
    },
    action: {
        setPopup: jest.fn(),
        onClicked: {
            addListener: jest.fn()
        }
    }
};

// Silence console output from the code under test
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

// Reset mock call records before each test (mock implementations set at
// module scope in test files are preserved)
beforeEach(() => {
    jest.clearAllMocks();
});

// Helper function to create mock tab objects
global.createMockTab = (overrides = {}) => {
    return {
        id: 1,
        title: 'Test Tab',
        url: 'https://example.com',
        windowId: 1,
        active: false,
        pinned: false,
        groupId: -1,
        mutedInfo: { muted: false },
        audible: false,
        lastAccessed: 1000,
        ...overrides
    };
};

// Helper function to create mock window objects
global.createMockWindow = (overrides = {}) => {
    return {
        id: 1,
        type: 'normal',
        focused: false,
        tabs: [],
        ...overrides
    };
};

// Helper function to create mock session objects
global.createMockSession = (overrides = {}) => {
    return {
        id: '1234567890',
        name: 'Test Session',
        created: 1234567890000,
        windows: [
            {
                id: 1,
                tabs: [
                    {
                        url: 'https://example.com',
                        title: 'Example',
                        pinned: false,
                        muted: false,
                        groupId: -1
                    }
                ],
                groups: []
            }
        ],
        ...overrides
    };
};
