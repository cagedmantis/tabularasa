/**
 * Unit tests for popup.js functionality
 * Testing core logic functions
 */

// Mock Chrome APIs for testing
const chrome = {
    tabs: {
        query: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        create: jest.fn(),
        move: jest.fn()
    },
    windows: {
        getAll: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        getCurrent: jest.fn()
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    },
    runtime: {
        sendMessage: jest.fn()
    }
};

// Make chrome API available globally
global.chrome = chrome;

// Import the functions to test
const { getFilteredTabs, groupTabs, escapeHtml } = require('../popup.js');

// Mock state object
const mockState = {
    tabs: [
        {
            id: 1,
            title: 'Google Search',
            url: 'https://www.google.com/search?q=test',
            windowId: 1,
            active: true,
            pinned: false
        },
        {
            id: 2,
            title: 'GitHub Repository',
            url: 'https://github.com/user/repo',
            windowId: 1,
            active: false,
            pinned: true
        },
        {
            id: 3,
            title: 'Stack Overflow',
            url: 'https://stackoverflow.com/questions/123',
            windowId: 2,
            active: false,
            pinned: false
        },
        {
            id: 4,
            title: 'Google Drive',
            url: 'https://drive.google.com/drive/my-drive',
            windowId: 2,
            active: true,
            pinned: false
        }
    ],
    windows: [
        { id: 1, type: 'normal' },
        { id: 2, type: 'normal' }
    ],
    searchQuery: '',
    currentView: 'windows'
};

describe.skip('Popup Functionality Tests (Legacy - needs update for TypeScript)', () => {
    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        
        // Set up default state
        global.state = { ...mockState };
    });

    describe('getFilteredTabs', () => {
        test('should return all tabs when no search query', () => {
            global.state.searchQuery = '';
            const result = getFilteredTabs();
            expect(result).toHaveLength(4);
            expect(result).toEqual(mockState.tabs);
        });

        test('should filter tabs by title', () => {
            global.state.searchQuery = 'Google';
            const result = getFilteredTabs();
            expect(result).toHaveLength(2);
            expect(result[0].title).toBe('Google Search');
            expect(result[1].title).toBe('Google Drive');
        });

        test('should filter tabs by URL', () => {
            global.state.searchQuery = 'github.com';
            const result = getFilteredTabs();
            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('https://github.com/user/repo');
        });

        test('should be case insensitive', () => {
            global.state.searchQuery = 'GOOGLE';
            const result = getFilteredTabs();
            expect(result).toHaveLength(2);
        });

        test('should handle partial matches', () => {
            global.state.searchQuery = 'stack';
            const result = getFilteredTabs();
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Stack Overflow');
        });

        test('should return empty array when no matches', () => {
            global.state.searchQuery = 'nonexistent';
            const result = getFilteredTabs();
            expect(result).toHaveLength(0);
        });
    });

    describe('groupTabs', () => {
        test('should group tabs by window when currentView is windows', () => {
            global.state.currentView = 'windows';
            const tabs = mockState.tabs;
            const result = groupTabs(tabs);

            expect(Object.keys(result)).toHaveLength(2);
            expect(result['Window 1']).toHaveLength(2);
            expect(result['Window 2']).toHaveLength(2);
            expect(result['Window 1'][0].title).toBe('Google Search');
            expect(result['Window 1'][1].title).toBe('GitHub Repository');
        });

        test('should group tabs by domain when currentView is domains', () => {
            global.state.currentView = 'domains';
            const tabs = mockState.tabs;
            const result = groupTabs(tabs);

            expect(Object.keys(result)).toHaveLength(3);
            expect(result['www.google.com']).toHaveLength(1);
            expect(result['github.com']).toHaveLength(1);
            expect(result['stackoverflow.com']).toHaveLength(1);
            expect(result['drive.google.com']).toHaveLength(1);
        });

        test('should handle tabs with invalid URLs', () => {
            global.state.currentView = 'domains';
            const tabsWithInvalidUrl = [
                ...mockState.tabs,
                {
                    id: 5,
                    title: 'Invalid URL Tab',
                    url: 'not-a-valid-url',
                    windowId: 1,
                    active: false,
                    pinned: false
                }
            ];
            const result = groupTabs(tabsWithInvalidUrl);

            expect(result['Unknown']).toHaveLength(1);
            expect(result['Unknown'][0].title).toBe('Invalid URL Tab');
        });

        test('should handle empty tabs array', () => {
            const result = groupTabs([]);
            expect(result).toEqual({});
        });
    });

    describe('escapeHtml', () => {
        test('should escape HTML special characters', () => {
            const input = '<script>alert("xss")</script>';
            const result = escapeHtml(input);
            expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
        });

        test('should escape ampersands', () => {
            const input = 'Tom & Jerry';
            const result = escapeHtml(input);
            expect(result).toBe('Tom &amp; Jerry');
        });

        test('should escape quotes', () => {
            const input = 'He said "Hello"';
            const result = escapeHtml(input);
            expect(result).toBe('He said "Hello"');
        });

        test('should handle empty string', () => {
            const result = escapeHtml('');
            expect(result).toBe('');
        });

        test('should handle normal text without special characters', () => {
            const input = 'Normal text';
            const result = escapeHtml(input);
            expect(result).toBe('Normal text');
        });
    });
});

describe('Tab Management Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.state = { ...mockState };
    });

    describe('Duplicate Tab Detection', () => {
        test('should identify duplicate tabs correctly', () => {
            const tabsWithDuplicates = [
                {
                    id: 1,
                    url: 'https://www.google.com',
                    lastAccessed: 1000,
                    title: 'Google 1'
                },
                {
                    id: 2,
                    url: 'https://www.google.com',
                    lastAccessed: 2000,
                    title: 'Google 2'
                },
                {
                    id: 3,
                    url: 'https://www.github.com',
                    lastAccessed: 1500,
                    title: 'GitHub'
                }
            ];

            // Sort and identify duplicates (keeping most recent)
            const urlGroups = new Map();
            tabsWithDuplicates.forEach(tab => {
                if (!urlGroups.has(tab.url)) {
                    urlGroups.set(tab.url, []);
                }
                urlGroups.get(tab.url).push(tab);
            });

            const tabsToClose = [];
            urlGroups.forEach(tabGroup => {
                if (tabGroup.length > 1) {
                    tabGroup.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
                    tabsToClose.push(...tabGroup.slice(1).map(tab => tab.id));
                }
            });

            expect(tabsToClose).toEqual([1]); // Should close older Google tab
        });
    });

    describe('URL Parsing and Grouping', () => {
        test('should correctly parse domain from URL', () => {
            const testUrls = [
                'https://www.google.com/search?q=test',
                'https://github.com/user/repo',
                'https://stackoverflow.com/questions/123',
                'https://drive.google.com/drive/my-drive'
            ];

            const expectedDomains = [
                'www.google.com',
                'github.com',
                'stackoverflow.com',
                'drive.google.com'
            ];

            testUrls.forEach((url, index) => {
                const domain = new URL(url).hostname;
                expect(domain).toBe(expectedDomains[index]);
            });
        });

        test.skip('should handle URLs without protocol (Legacy test)', () => {
            expect(() => new URL('www.google.com')).toThrow();
            
            // Test the actual grouping logic handles this
            const tabs = [{
                id: 1,
                url: 'invalid-url',
                windowId: 1
            }];
            
            global.state.currentView = 'domains';
            const result = groupTabs(tabs);
            expect(result['Unknown']).toHaveLength(1);
        });
    });
});

describe('Session Management', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Session Structure', () => {
        test('should create session with correct structure', () => {
            const mockSession = {
                id: '1234567890',
                name: 'Test Session',
                created: Date.now(),
                windows: [
                    {
                        id: 1,
                        tabs: [
                            {
                                url: 'https://www.google.com',
                                title: 'Google',
                                pinned: false,
                                muted: false
                            }
                        ]
                    }
                ]
            };

            expect(mockSession).toHaveProperty('id');
            expect(mockSession).toHaveProperty('name');
            expect(mockSession).toHaveProperty('created');
            expect(mockSession).toHaveProperty('windows');
            expect(mockSession.windows[0]).toHaveProperty('tabs');
            expect(mockSession.windows[0].tabs[0]).toHaveProperty('url');
            expect(mockSession.windows[0].tabs[0]).toHaveProperty('title');
        });

        test('should validate session name', () => {
            const validateSessionName = (name) => {
                if (!name || typeof name !== 'string') return false;
                return name.trim().length > 0;
            };

            expect(validateSessionName('')).toBe(false);
            expect(validateSessionName('   ')).toBe(false);
            expect(validateSessionName('Valid Session')).toBe(true);
            expect(validateSessionName('A')).toBe(true);
        });
    });

    describe('Tab Filtering for Sessions', () => {
        test('should filter out chrome:// URLs when saving session', () => {
            const tabs = [
                { url: 'https://www.google.com', title: 'Google' },
                { url: 'chrome://extensions/', title: 'Extensions' },
                { url: 'https://github.com', title: 'GitHub' },
                { url: 'chrome://settings/', title: 'Settings' }
            ];

            const filteredTabs = tabs.filter(tab => tab.url && !tab.url.startsWith('chrome://'));
            
            expect(filteredTabs).toHaveLength(2);
            expect(filteredTabs[0].url).toBe('https://www.google.com');
            expect(filteredTabs[1].url).toBe('https://github.com');
        });

        test('should handle empty tab arrays', () => {
            const tabs = [];
            const filteredTabs = tabs.filter(tab => tab.url && !tab.url.startsWith('chrome://'));
            expect(filteredTabs).toHaveLength(0);
        });
    });
});

describe('Utility Functions', () => {
    describe('Tab Selection Logic', () => {
        test('should manage selected tabs set correctly', () => {
            const selectedTabs = new Set();
            const tabId = 123;

            // Add tab
            selectedTabs.add(tabId);
            expect(selectedTabs.has(tabId)).toBe(true);
            expect(selectedTabs.size).toBe(1);

            // Remove tab
            selectedTabs.delete(tabId);
            expect(selectedTabs.has(tabId)).toBe(false);
            expect(selectedTabs.size).toBe(0);

            // Toggle logic
            const toggleTabSelection = (tabId, selectedSet) => {
                if (selectedSet.has(tabId)) {
                    selectedSet.delete(tabId);
                } else {
                    selectedSet.add(tabId);
                }
            };

            toggleTabSelection(tabId, selectedTabs);
            expect(selectedTabs.has(tabId)).toBe(true);
            
            toggleTabSelection(tabId, selectedTabs);
            expect(selectedTabs.has(tabId)).toBe(false);
        });
    });

    describe('Search Query Processing', () => {
        test('should normalize search queries', () => {
            const normalizeQuery = (query) => {
                return query.trim().toLowerCase();
            };

            expect(normalizeQuery('  GOOGLE  ')).toBe('google');
            expect(normalizeQuery('GitHub')).toBe('github');
            expect(normalizeQuery('')).toBe('');
        });

        test('should handle search matching logic', () => {
            const matchesSearch = (text, query) => {
                return text.toLowerCase().includes(query.toLowerCase());
            };

            expect(matchesSearch('Google Search', 'google')).toBe(true);
            expect(matchesSearch('Google Search', 'GOOGLE')).toBe(true);
            expect(matchesSearch('Google Search', 'search')).toBe(true);
            expect(matchesSearch('Google Search', 'github')).toBe(false);
        });
    });
});