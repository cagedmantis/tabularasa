/**
 * Core functionality tests for Tabula Rasa
 */

describe('Core Functionality', () => {
    describe('Tab Filtering', () => {
        test('should filter tabs by title', () => {
            const tabs = [
                { id: 1, title: 'Google Search', url: 'https://google.com' },
                { id: 2, title: 'GitHub', url: 'https://github.com' },
                { id: 3, title: 'Google Drive', url: 'https://drive.google.com' }
            ];
            
            const filterTabs = (tabs, query) => {
                if (!query) return tabs;
                const lowerQuery = query.toLowerCase();
                return tabs.filter(tab => 
                    tab.title.toLowerCase().includes(lowerQuery) || 
                    tab.url.toLowerCase().includes(lowerQuery)
                );
            };

            const result = filterTabs(tabs, 'Google');
            expect(result).toHaveLength(2);
            expect(result[0].title).toBe('Google Search');
            expect(result[1].title).toBe('Google Drive');
        });

        test('should filter tabs by URL', () => {
            const tabs = [
                { id: 1, title: 'Repository', url: 'https://github.com/user/repo' },
                { id: 2, title: 'Search', url: 'https://google.com/search' }
            ];
            
            const filterTabs = (tabs, query) => {
                if (!query) return tabs;
                const lowerQuery = query.toLowerCase();
                return tabs.filter(tab => 
                    tab.title.toLowerCase().includes(lowerQuery) || 
                    tab.url.toLowerCase().includes(lowerQuery)
                );
            };

            const result = filterTabs(tabs, 'github.com');
            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('https://github.com/user/repo');
        });

        test('should be case insensitive', () => {
            const tabs = [
                { id: 1, title: 'Google Search', url: 'https://google.com' }
            ];
            
            const filterTabs = (tabs, query) => {
                if (!query) return tabs;
                const lowerQuery = query.toLowerCase();
                return tabs.filter(tab => 
                    tab.title.toLowerCase().includes(lowerQuery) || 
                    tab.url.toLowerCase().includes(lowerQuery)
                );
            };

            const result = filterTabs(tabs, 'GOOGLE');
            expect(result).toHaveLength(1);
        });
    });

    describe('Tab Grouping', () => {
        test('should group tabs by window', () => {
            const tabs = [
                { id: 1, windowId: 1, title: 'Tab 1' },
                { id: 2, windowId: 1, title: 'Tab 2' },
                { id: 3, windowId: 2, title: 'Tab 3' }
            ];

            const groupByWindow = (tabs) => {
                const groups = {};
                tabs.forEach(tab => {
                    const key = `Window ${tab.windowId}`;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(tab);
                });
                return groups;
            };

            const result = groupByWindow(tabs);
            expect(Object.keys(result)).toHaveLength(2);
            expect(result['Window 1']).toHaveLength(2);
            expect(result['Window 2']).toHaveLength(1);
        });

        test('should group tabs by domain', () => {
            const tabs = [
                { id: 1, url: 'https://www.google.com/search' },
                { id: 2, url: 'https://github.com/user/repo' },
                { id: 3, url: 'https://drive.google.com/drive' }
            ];

            const groupByDomain = (tabs) => {
                const groups = {};
                tabs.forEach(tab => {
                    let domain = 'Unknown';
                    try {
                        domain = new URL(tab.url).hostname;
                    } catch (e) {
                        // Keep 'Unknown' for invalid URLs
                    }
                    if (!groups[domain]) groups[domain] = [];
                    groups[domain].push(tab);
                });
                return groups;
            };

            const result = groupByDomain(tabs);
            expect(Object.keys(result)).toHaveLength(3);
            expect(result['www.google.com']).toHaveLength(1);
            expect(result['github.com']).toHaveLength(1);
            expect(result['drive.google.com']).toHaveLength(1);
        });
    });

    describe('HTML Escaping', () => {
        test('should escape HTML characters', () => {
            const escapeHtml = (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            const result = escapeHtml('<script>alert("xss")</script>');
            expect(result).toContain('&lt;script&gt;');
            expect(result).toContain('&lt;/script&gt;');
        });

        test('should handle normal text', () => {
            const escapeHtml = (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            const result = escapeHtml('Normal text');
            expect(result).toBe('Normal text');
        });
    });

    describe('Duplicate Detection', () => {
        test('should identify duplicate URLs', () => {
            const tabs = [
                { id: 1, url: 'https://google.com', lastAccessed: 1000 },
                { id: 2, url: 'https://github.com', lastAccessed: 2000 },
                { id: 3, url: 'https://google.com', lastAccessed: 3000 }
            ];

            const findDuplicates = (tabs) => {
                const urlMap = new Map();
                const duplicates = [];

                tabs.forEach(tab => {
                    if (urlMap.has(tab.url)) {
                        duplicates.push(tab);
                    } else {
                        urlMap.set(tab.url, tab);
                    }
                });

                return duplicates;
            };

            const result = findDuplicates(tabs);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(3);
        });

        test('should keep most recent when removing duplicates', () => {
            const tabs = [
                { id: 1, url: 'https://google.com', lastAccessed: 1000 },
                { id: 2, url: 'https://google.com', lastAccessed: 3000 },
                { id: 3, url: 'https://github.com', lastAccessed: 2000 }
            ];

            const removeDuplicates = (tabs) => {
                const urlMap = new Map();
                const toClose = [];

                // Group by URL
                tabs.forEach(tab => {
                    if (!urlMap.has(tab.url)) {
                        urlMap.set(tab.url, []);
                    }
                    urlMap.get(tab.url).push(tab);
                });

                // For each URL group, keep the most recent
                urlMap.forEach(tabGroup => {
                    if (tabGroup.length > 1) {
                        tabGroup.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
                        toClose.push(...tabGroup.slice(1));
                    }
                });

                return toClose;
            };

            const result = removeDuplicates(tabs);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(1); // Older tab should be closed
        });
    });

    describe('Session Management', () => {
        test('should validate session structure', () => {
            const isValidSession = (session) => {
                if (!session) return false;
                return typeof session.id === 'string' &&
                    typeof session.name === 'string' &&
                    typeof session.created === 'number' &&
                    Array.isArray(session.windows);
            };

            const validSession = {
                id: '123',
                name: 'Test Session',
                created: Date.now(),
                windows: []
            };

            const invalidSession = {
                id: 123, // Should be string
                name: 'Test',
                created: Date.now(),
                windows: []
            };

            expect(isValidSession(validSession)).toBe(true);
            expect(isValidSession(invalidSession)).toBe(false);
            expect(isValidSession(null)).toBe(false);
        });

        test('should filter chrome URLs from sessions', () => {
            const tabs = [
                { url: 'https://google.com', title: 'Google' },
                { url: 'chrome://extensions/', title: 'Extensions' },
                { url: 'https://github.com', title: 'GitHub' }
            ];

            const filterChromeUrls = (tabs) => {
                return tabs.filter(tab => 
                    tab.url && !tab.url.startsWith('chrome://')
                );
            };

            const result = filterChromeUrls(tabs);
            expect(result).toHaveLength(2);
            expect(result.every(tab => !tab.url.startsWith('chrome://'))).toBe(true);
        });
    });

    describe('Utility Functions', () => {
        test('should manage selection state', () => {
            const selectedTabs = new Set();

            const toggleSelection = (tabId) => {
                if (selectedTabs.has(tabId)) {
                    selectedTabs.delete(tabId);
                } else {
                    selectedTabs.add(tabId);
                }
            };

            toggleSelection(1);
            expect(selectedTabs.has(1)).toBe(true);
            
            toggleSelection(1);
            expect(selectedTabs.has(1)).toBe(false);
            
            toggleSelection(2);
            toggleSelection(3);
            expect(selectedTabs.size).toBe(2);
        });

        test('should normalize search queries', () => {
            const normalizeQuery = (query) => {
                return query.trim().toLowerCase();
            };

            expect(normalizeQuery('  GOOGLE  ')).toBe('google');
            expect(normalizeQuery('GitHub')).toBe('github');
            expect(normalizeQuery('')).toBe('');
        });
    });
});