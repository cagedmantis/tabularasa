/**
 * Unit tests for utility functions and helper methods
 */

describe('Utility Functions', () => {
    describe('URL Validation and Parsing', () => {
        test('should validate URLs correctly', () => {
            const isValidUrl = (string) => {
                try {
                    new URL(string);
                    return true;
                } catch (_) {
                    return false;
                }
            };

            expect(isValidUrl('https://www.google.com')).toBe(true);
            expect(isValidUrl('http://example.com')).toBe(true);
            expect(isValidUrl('ftp://files.example.com')).toBe(true);
            expect(isValidUrl('invalid-url')).toBe(false);
            expect(isValidUrl('www.google.com')).toBe(false);
            expect(isValidUrl('')).toBe(false);
        });

        test('should extract domain from URL', () => {
            const extractDomain = (url) => {
                try {
                    return new URL(url).hostname;
                } catch (_) {
                    return 'Unknown';
                }
            };

            expect(extractDomain('https://www.google.com/search')).toBe('www.google.com');
            expect(extractDomain('https://github.com/user/repo')).toBe('github.com');
            expect(extractDomain('invalid-url')).toBe('Unknown');
        });

        test('should handle protocol-less URLs', () => {
            const normalizeUrl = (url) => {
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    return 'https://' + url;
                }
                return url;
            };

            expect(normalizeUrl('www.google.com')).toBe('https://www.google.com');
            expect(normalizeUrl('https://www.google.com')).toBe('https://www.google.com');
            expect(normalizeUrl('http://www.google.com')).toBe('http://www.google.com');
        });
    });

    describe('Array and Object Utilities', () => {
        test('should group array items by key', () => {
            const groupBy = (array, keyFn) => {
                return array.reduce((groups, item) => {
                    const key = keyFn(item);
                    if (!groups[key]) {
                        groups[key] = [];
                    }
                    groups[key].push(item);
                    return groups;
                }, {});
            };

            const tabs = [
                { id: 1, windowId: 1, title: 'Tab 1' },
                { id: 2, windowId: 1, title: 'Tab 2' },
                { id: 3, windowId: 2, title: 'Tab 3' }
            ];

            const groupedByWindow = groupBy(tabs, tab => tab.windowId);
            expect(Object.keys(groupedByWindow)).toHaveLength(2);
            expect(groupedByWindow[1]).toHaveLength(2);
            expect(groupedByWindow[2]).toHaveLength(1);
        });

        test('should find duplicates in array', () => {
            const findDuplicates = (array, keyFn) => {
                const seen = new Map();
                const duplicates = [];

                array.forEach(item => {
                    const key = keyFn(item);
                    if (seen.has(key)) {
                        duplicates.push(item);
                    } else {
                        seen.set(key, item);
                    }
                });

                return duplicates;
            };

            const tabs = [
                { id: 1, url: 'https://google.com' },
                { id: 2, url: 'https://github.com' },
                { id: 3, url: 'https://google.com' }
            ];

            const duplicates = findDuplicates(tabs, tab => tab.url);
            expect(duplicates).toHaveLength(1);
            expect(duplicates[0].id).toBe(3);
        });

        test('should sort array by multiple criteria', () => {
            const multiSort = (array, ...sortFns) => {
                return array.sort((a, b) => {
                    for (const sortFn of sortFns) {
                        const result = sortFn(a, b);
                        if (result !== 0) return result;
                    }
                    return 0;
                });
            };

            const tabs = [
                { id: 1, pinned: false, lastAccessed: 3000 },
                { id: 2, pinned: true, lastAccessed: 1000 },
                { id: 3, pinned: false, lastAccessed: 2000 },
                { id: 4, pinned: true, lastAccessed: 4000 }
            ];

            const sortByPinnedThenAccessed = multiSort(
                [...tabs],
                (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0), // Pinned first
                (a, b) => b.lastAccessed - a.lastAccessed // Then by last accessed
            );

            expect(sortByPinnedThenAccessed[0].id).toBe(4); // Pinned, most recent
            expect(sortByPinnedThenAccessed[1].id).toBe(2); // Pinned, less recent
            expect(sortByPinnedThenAccessed[2].id).toBe(1); // Not pinned, most recent
            expect(sortByPinnedThenAccessed[3].id).toBe(3); // Not pinned, less recent
        });
    });

    describe('String Utilities', () => {
        test('should truncate strings correctly', () => {
            const truncate = (str, length) => {
                if (str.length <= length) return str;
                return str.substring(0, length - 3) + '...';
            };

            expect(truncate('Short', 10)).toBe('Short');
            expect(truncate('This is a very long string', 10)).toBe('This is...');
            expect(truncate('Exactly10!', 10)).toBe('Exactly10!');
        });

        test('should highlight search terms', () => {
            const highlight = (text, query) => {
                if (!query) return text;
                const regex = new RegExp(`(${query})`, 'gi');
                return text.replace(regex, '<mark>$1</mark>');
            };

            expect(highlight('Google Search', 'google')).toBe('<mark>Google</mark> Search');
            expect(highlight('Google Search', 'search')).toBe('Google <mark>Search</mark>');
            expect(highlight('Google Search', '')).toBe('Google Search');
        });

        test('should sanitize input for HTML', () => {
            const sanitize = (input) => {
                const div = document.createElement('div');
                div.textContent = input;
                return div.innerHTML;
            };

            // Mock document.createElement for testing
            global.document = {
                createElement: (tag) => {
                    if (tag === 'div') {
                        return {
                            textContent: '',
                            innerHTML: '',
                            set textContent(value) {
                                this.innerHTML = value
                                    .replace(/&/g, '&amp;')
                                    .replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;')
                                    .replace(/"/g, '&quot;')
                                    .replace(/'/g, '&#39;');
                            }
                        };
                    }
                }
            };

            expect(sanitize('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
            expect(sanitize('Normal text')).toBe('Normal text');
        });
    });

    describe('Time and Date Utilities', () => {
        test('should format timestamps correctly', () => {
            const formatTime = (timestamp) => {
                const date = new Date(timestamp);
                return date.toLocaleString();
            };

            const now = Date.now();
            const formatted = formatTime(now);
            expect(formatted).toBeTruthy();
            expect(typeof formatted).toBe('string');
        });

        test('should calculate relative time', () => {
            const getRelativeTime = (timestamp) => {
                const now = Date.now();
                const diff = now - timestamp;
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);

                if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
                if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
                if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
                return 'Just now';
            };

            const now = Date.now();
            expect(getRelativeTime(now)).toBe('Just now');
            expect(getRelativeTime(now - 60000)).toBe('1 minute ago');
            expect(getRelativeTime(now - 120000)).toBe('2 minutes ago');
            expect(getRelativeTime(now - 3600000)).toBe('1 hour ago');
            expect(getRelativeTime(now - 7200000)).toBe('2 hours ago');
            expect(getRelativeTime(now - 86400000)).toBe('1 day ago');
        });
    });

    describe('Storage Utilities', () => {
        test('should serialize and deserialize session data', () => {
            const serializeSession = (session) => {
                return JSON.stringify(session);
            };

            const deserializeSession = (data) => {
                try {
                    return JSON.parse(data);
                } catch (e) {
                    return null;
                }
            };

            const originalSession = {
                id: '123',
                name: 'Test Session',
                created: 1234567890,
                windows: [
                    {
                        id: 1,
                        tabs: [
                            { url: 'https://google.com', title: 'Google' }
                        ]
                    }
                ]
            };

            const serialized = serializeSession(originalSession);
            const deserialized = deserializeSession(serialized);

            expect(deserialized).toEqual(originalSession);
            expect(deserializeSession('invalid json')).toBeNull();
        });

        test('should validate session data structure', () => {
            const isValidSession = (session) => {
                if (!session) return false;
                return typeof session.id === 'string' &&
                    typeof session.name === 'string' &&
                    typeof session.created === 'number' &&
                    Array.isArray(session.windows) &&
                    session.windows.every(window => 
                        typeof window.id === 'number' &&
                        Array.isArray(window.tabs) &&
                        window.tabs.every(tab => 
                            typeof tab.url === 'string' &&
                            typeof tab.title === 'string'
                        )
                    );
            };

            const validSession = {
                id: '123',
                name: 'Test',
                created: 123456789,
                windows: [{
                    id: 1,
                    tabs: [{
                        url: 'https://google.com',
                        title: 'Google'
                    }]
                }]
            };

            expect(isValidSession(validSession)).toBe(true);
            expect(isValidSession(null)).toBe(false);
            expect(isValidSession({ id: '123' })).toBe(false);
            expect(isValidSession({ ...validSession, name: 123 })).toBe(false);
        });
    });

    describe('Performance Utilities', () => {
        test('should debounce function calls', (done) => {
            const debounce = (func, delay) => {
                let timeoutId;
                return (...args) => {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => func.apply(this, args), delay);
                };
            };

            let callCount = 0;
            const testFunction = () => callCount++;
            const debouncedFunction = debounce(testFunction, 100);

            // Call multiple times quickly
            debouncedFunction();
            debouncedFunction();
            debouncedFunction();

            expect(callCount).toBe(0);

            setTimeout(() => {
                expect(callCount).toBe(1);
                done();
            }, 150);
        });

        test('should throttle function calls', () => {
            const throttle = (func, delay) => {
                let lastCall = 0;
                return (...args) => {
                    const now = Date.now();
                    if (now - lastCall >= delay) {
                        lastCall = now;
                        func.apply(this, args);
                    }
                };
            };

            let callCount = 0;
            const testFunction = () => callCount++;
            
            // Mock Date.now to control time
            const originalDateNow = Date.now;
            let currentTime = 100; // Start at 100 to ensure first call executes
            Date.now = jest.fn(() => currentTime);
            
            const throttledFunction = throttle(testFunction, 100);

            // First call at time 100
            currentTime = 100;
            throttledFunction();
            expect(callCount).toBe(1);

            // Second call at time 150 (should be throttled - only 50ms passed)
            currentTime = 150;
            throttledFunction();
            expect(callCount).toBe(1);

            // Third call at time 250 (should execute - 150ms passed since last call)
            currentTime = 250;
            throttledFunction();
            expect(callCount).toBe(2);
            
            // Restore original Date.now
            Date.now = originalDateNow;
        });
    });
});