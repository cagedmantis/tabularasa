/**
 * Jest setup file for Tabularasa tests
 * Sets up global mocks and utilities for testing
 */

// Mock Chrome Extension APIs
global.chrome = {
    tabs: {
        query: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        create: jest.fn(),
        move: jest.fn(),
        onCreated: {
            addListener: jest.fn()
        },
        onRemoved: {
            addListener: jest.fn()
        },
        onUpdated: {
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
        onInstalled: {
            addListener: jest.fn()
        },
        onMessage: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn()
    },
    action: {
        onClicked: {
            addListener: jest.fn()
        }
    }
};

// Mock DOM APIs
global.document = {
    createElement: jest.fn((tag) => {
        const element = {
            tagName: tag.toUpperCase(),
            innerHTML: '',
            textContent: '',
            className: '',
            style: {},
            dataset: {},
            addEventListener: jest.fn(),
            appendChild: jest.fn(),
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(),
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
                toggle: jest.fn(),
                contains: jest.fn()
            }
        };

        // Special handling for div elements (used in escapeHtml)
        if (tag === 'div') {
            Object.defineProperty(element, 'textContent', {
                get() {
                    return this._textContent || '';
                },
                set(value) {
                    this._textContent = value;
                    this.innerHTML = value
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                }
            });
        }

        return element;
    }),
    getElementById: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    addEventListener: jest.fn()
};

global.window = {
    location: {
        href: 'chrome-extension://test/popup.html'
    },
    close: jest.fn(),
    addEventListener: jest.fn()
};

// Mock console methods to avoid noise in tests
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

// Mock fetch for any future API calls
global.fetch = jest.fn();

// Mock URL constructor
global.URL = jest.fn((url) => {
    if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL');
    }
    
    // More realistic URL validation
    const validUrlPattern = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
    if (!validUrlPattern.test(url)) {
        throw new Error('Invalid URL');
    }
    
    // Simple URL parsing mock for valid URLs
    const match = url.match(/^(https?|ftp):\/\/([^\/]+)(\/.*)?$/);
    if (!match) {
        throw new Error('Invalid URL');
    }
    
    const protocol = match[1] + ':';
    const hostname = match[2];
    const pathname = match[3] || '/';
    
    return {
        href: url,
        protocol: protocol,
        hostname: hostname,
        pathname: pathname,
        toString: () => url
    };
});

// Mock Date.now for consistent testing
const originalDateNow = Date.now;
Date.now = jest.fn(() => 1234567890000);

// Reset mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Date.now
    Date.now.mockReturnValue(1234567890000);
});

// Restore original implementations after all tests
afterAll(() => {
    Date.now = originalDateNow;
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
        mutedInfo: { muted: false },
        lastAccessed: Date.now(),
        ...overrides
    };
};

// Helper function to create mock window objects
global.createMockWindow = (overrides = {}) => {
    return {
        id: 1,
        type: 'normal',
        focused: false,
        ...overrides
    };
};

// Helper function to create mock session objects
global.createMockSession = (overrides = {}) => {
    return {
        id: Date.now().toString(),
        name: 'Test Session',
        created: Date.now(),
        windows: [
            {
                id: 1,
                tabs: [
                    {
                        url: 'https://example.com',
                        title: 'Example',
                        pinned: false,
                        muted: false
                    }
                ]
            }
        ],
        ...overrides
    };
};

// Global test utilities
global.testUtils = {
    // Simulate user input
    simulateInput: (element, value) => {
        element.value = value;
        element.dispatchEvent(new Event('input'));
    },
    
    // Simulate click
    simulateClick: (element) => {
        element.dispatchEvent(new Event('click'));
    },
    
    // Wait for async operations
    waitFor: (condition, timeout = 1000) => {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                if (condition()) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Timeout waiting for condition'));
                } else {
                    setTimeout(check, 10);
                }
            };
            check();
        });
    }
};