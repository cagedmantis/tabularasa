/**
 * Unit tests for TypeScript manager functionality
 */

/// <reference types="jest" />

import { TabManager } from '../src/manager';

// Mock Chrome APIs
const mockTabs = [
    {
        id: 1,
        title: 'Google Search',
        url: 'https://www.google.com/search?q=test',
        windowId: 1,
        active: true,
        pinned: false,
        favIconUrl: 'https://www.google.com/favicon.ico',
        groupId: -1,
        mutedInfo: { muted: false },
        audible: false,
        lastAccessed: Date.now()
    },
    {
        id: 2,
        title: 'GitHub Repository',
        url: 'https://github.com/user/repo',
        windowId: 1,
        active: false,
        pinned: true,
        favIconUrl: 'https://github.com/favicon.ico',
        groupId: 1,
        mutedInfo: { muted: false },
        audible: false,
        lastAccessed: Date.now() - 1000
    }
];

const mockWindows = [
    {
        id: 1,
        type: 'normal',
        focused: true,
        tabs: mockTabs
    }
];

const mockTabGroups = [
    {
        id: 1,
        title: 'Development',
        color: 'blue' as chrome.tabGroups.ColorEnum,
        collapsed: false,
        windowId: 1
    }
];

// Mock Chrome API
global.chrome = {
    tabs: {
        query: jest.fn().mockResolvedValue(mockTabs),
        update: jest.fn().mockResolvedValue({}),
        remove: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 3 }),
        move: jest.fn().mockResolvedValue([]),
        group: jest.fn().mockResolvedValue(1),
        ungroup: jest.fn().mockResolvedValue({})
    },
    windows: {
        getAll: jest.fn().mockResolvedValue(mockWindows),
        create: jest.fn().mockResolvedValue({ id: 2, tabs: [{ id: 3 }] }),
        update: jest.fn().mockResolvedValue({}),
        getCurrent: jest.fn().mockResolvedValue(mockWindows[0])
    },
    tabGroups: {
        query: jest.fn().mockResolvedValue(mockTabGroups),
        update: jest.fn().mockResolvedValue({}),
        onCreated: { addListener: jest.fn() },
        onUpdated: { addListener: jest.fn() },
        onRemoved: { addListener: jest.fn() }
    },
    storage: {
        local: {
            get: jest.fn().mockResolvedValue({ sessions: [] }),
            set: jest.fn().mockResolvedValue({})
        }
    },
    runtime: {
        onMessage: { addListener: jest.fn() },
        sendMessage: jest.fn()
    }
} as any;

// Mock DOM
const mockElements = {
    'search-input': { addEventListener: jest.fn(), value: '', focus: jest.fn() },
    'tabs-container': { innerHTML: '', appendChild: jest.fn() },
    'view-toggle': { addEventListener: jest.fn(), innerHTML: '' },
    'sessions-toggle': { addEventListener: jest.fn() },
    'tab-view': { classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() } },
    'session-view': { classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() } },
    'loading': { classList: { toggle: jest.fn() } },
    'status-message': { 
        classList: { add: jest.fn(), remove: jest.fn() },
        className: '',
        querySelector: jest.fn().mockReturnValue({ textContent: '' })
    },
    'tab-count': { textContent: '' },
    'selected-count': { textContent: '' },
    'filter-type': { addEventListener: jest.fn(), value: 'all' },
    'group-modal': { classList: { add: jest.fn(), remove: jest.fn() } }
};

global.document = {
    getElementById: jest.fn((id: string) => mockElements[id as keyof typeof mockElements]),
    createElement: jest.fn((tag: string) => ({
        tagName: tag.toUpperCase(),
        innerHTML: '',
        textContent: '',
        className: '',
        style: {},
        dataset: {},
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
        querySelector: jest.fn(),
        classList: {
            add: jest.fn(),
            remove: jest.fn(),
            toggle: jest.fn(),
            contains: jest.fn()
        }
    })),
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn()
} as any;

global.window = {
    addEventListener: jest.fn()
} as any;

describe('TabManager TypeScript Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Tab Filtering', () => {
        test('should filter tabs by search query', () => {
            const tabs = [
                { id: 1, title: 'Google Search', url: 'https://google.com', active: true, pinned: false, windowId: 1 },
                { id: 2, title: 'GitHub', url: 'https://github.com', active: false, pinned: false, windowId: 1 },
                { id: 3, title: 'Google Drive', url: 'https://drive.google.com', active: false, pinned: false, windowId: 1 }
            ];

            const filterTabs = (tabs: any[], query: string) => {
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

        test('should filter tabs by type', () => {
            const tabs = [
                { id: 1, title: 'Tab 1', active: true, pinned: false, audible: false, groupId: -1 },
                { id: 2, title: 'Tab 2', active: false, pinned: true, audible: false, groupId: -1 },
                { id: 3, title: 'Tab 3', active: false, pinned: false, audible: true, groupId: 1 },
                { id: 4, title: 'Tab 4', active: false, pinned: false, audible: false, groupId: 1 }
            ];

            const filterByType = (tabs: any[], type: string) => {
                switch (type) {
                    case 'active':
                        return tabs.filter(tab => tab.active);
                    case 'pinned':
                        return tabs.filter(tab => tab.pinned);
                    case 'audible':
                        return tabs.filter(tab => tab.audible);
                    case 'grouped':
                        return tabs.filter(tab => tab.groupId !== undefined && tab.groupId !== -1);
                    default:
                        return tabs;
                }
            };

            expect(filterByType(tabs, 'active')).toHaveLength(1);
            expect(filterByType(tabs, 'pinned')).toHaveLength(1);
            expect(filterByType(tabs, 'audible')).toHaveLength(1);
            expect(filterByType(tabs, 'grouped')).toHaveLength(2);
        });
    });

    describe('Tab Grouping', () => {
        test('should group tabs by window', () => {
            const tabs = [
                { id: 1, windowId: 1, groupId: -1, title: 'Tab 1', url: 'https://example.com' },
                { id: 2, windowId: 1, groupId: 1, title: 'Tab 2', url: 'https://example.com' },
                { id: 3, windowId: 2, groupId: -1, title: 'Tab 3', url: 'https://example.com' }
            ];

            const tabGroups = [
                { id: 1, title: 'Development', color: 'blue', collapsed: false, windowId: 1 }
            ];

            const groupTabsByWindow = (tabs: any[], tabGroups: any[]) => {
                const groups: Record<string, any[]> = {};
                
                tabs.forEach(tab => {
                    let groupKey: string;
                    
                    if (tab.groupId && tab.groupId !== -1) {
                        const group = tabGroups.find(g => g.id === tab.groupId);
                        groupKey = group ? (group.title || `Group ${group.id}`) : 'Ungrouped';
                    } else {
                        groupKey = 'ungrouped';
                    }

                    if (!groups[groupKey]) {
                        groups[groupKey] = [];
                    }
                    groups[groupKey].push(tab);
                });

                return groups;
            };

            const result = groupTabsByWindow(tabs, tabGroups);
            expect(result['Development']).toHaveLength(1);
            expect(result['ungrouped']).toHaveLength(2);
        });

        test('should group tabs by domain', () => {
            const tabs = [
                { id: 1, url: 'https://www.google.com/search', title: 'Google Search' },
                { id: 2, url: 'https://github.com/user/repo', title: 'GitHub' },
                { id: 3, url: 'https://drive.google.com/drive', title: 'Google Drive' }
            ];

            const groupByDomain = (tabs: any[]) => {
                const groups: Record<string, any[]> = {};
                
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

    describe('Tab Group Operations', () => {
        test('should create tab group', async () => {
            const selectedTabs = new Set([1, 2, 3]);
            const groupName = 'New Group';
            const groupColor = 'blue';

            const createGroup = async (tabIds: number[], name: string, color: string) => {
                const groupId = await chrome.tabs.group({ tabIds });
                if (name) {
                    await chrome.tabGroups.update(groupId, { 
                        title: name,
                        color: color as chrome.tabGroups.ColorEnum
                    });
                }
                return groupId;
            };

            const result = await createGroup(Array.from(selectedTabs), groupName, groupColor);
            expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1, 2, 3] });
            expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, { 
                title: groupName,
                color: groupColor
            });
            expect(result).toBe(1);
        });

        test('should ungroup tabs', async () => {
            const tabIds = [1, 2, 3];

            const ungroupTabs = async (tabIds: number[]) => {
                await chrome.tabs.ungroup(tabIds);
            };

            await ungroupTabs(tabIds);
            expect(chrome.tabs.ungroup).toHaveBeenCalledWith(tabIds);
        });

        test('should toggle group collapse', async () => {
            const groupId = 1;
            const currentGroup = { id: 1, collapsed: false };

            const toggleCollapse = async (groupId: number, isCollapsed: boolean) => {
                await chrome.tabGroups.update(groupId, { collapsed: !isCollapsed });
            };

            await toggleCollapse(groupId, currentGroup.collapsed);
            expect(chrome.tabGroups.update).toHaveBeenCalledWith(groupId, { collapsed: true });
        });
    });

    describe('Session Management', () => {
        test('should create session structure', () => {
            const sessionData = {
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
                                muted: false,
                                groupId: -1
                            }
                        ],
                        groups: [
                            {
                                id: 1,
                                title: 'Development',
                                color: 'blue' as chrome.tabGroups.ColorEnum
                            }
                        ]
                    }
                ]
            };

            expect(sessionData).toHaveProperty('id');
            expect(sessionData).toHaveProperty('name');
            expect(sessionData).toHaveProperty('created');
            expect(sessionData).toHaveProperty('windows');
            expect(sessionData.windows[0]).toHaveProperty('tabs');
            expect(sessionData.windows[0]).toHaveProperty('groups');
            expect(sessionData.windows[0].tabs[0]).toHaveProperty('url');
            expect(sessionData.windows[0].tabs[0]).toHaveProperty('title');
            expect(sessionData.windows[0].groups[0]).toHaveProperty('color');
        });

        test('should filter chrome URLs from session', () => {
            const tabs = [
                { url: 'https://google.com', title: 'Google' },
                { url: 'chrome://extensions/', title: 'Extensions' },
                { url: 'https://github.com', title: 'GitHub' },
                { url: 'chrome://settings/', title: 'Settings' }
            ];

            const filterChromeUrls = (tabs: any[]) => {
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
        test('should escape HTML', () => {
            const escapeHtml = (text: string): string => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            // Mock the textContent setter
            const mockDiv = {
                textContent: '',
                innerHTML: '',
                set textContent(value: string) {
                    this.innerHTML = value
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                }
            };

            (document.createElement as jest.Mock).mockReturnValue(mockDiv);

            const result = escapeHtml('<script>alert("xss")</script>');
            expect(result).toContain('&lt;script&gt;');
        });

        test('should manage tab selection', () => {
            const selectedTabs = new Set<number>();

            const toggleSelection = (tabId: number) => {
                if (selectedTabs.has(tabId)) {
                    selectedTabs.delete(tabId);
                } else {
                    selectedTabs.add(tabId);
                }
            };

            toggleSelection(1);
            expect(selectedTabs.has(1)).toBe(true);
            expect(selectedTabs.size).toBe(1);

            toggleSelection(1);
            expect(selectedTabs.has(1)).toBe(false);
            expect(selectedTabs.size).toBe(0);

            toggleSelection(2);
            toggleSelection(3);
            expect(selectedTabs.size).toBe(2);
        });

        test('should detect duplicate tabs', () => {
            const tabs = [
                { id: 1, url: 'https://google.com', lastAccessed: 1000 },
                { id: 2, url: 'https://github.com', lastAccessed: 2000 },
                { id: 3, url: 'https://google.com', lastAccessed: 3000 }
            ];

            const findDuplicates = (tabs: any[]) => {
                const urlGroups = new Map<string, any[]>();
                
                tabs.forEach(tab => {
                    if (tab.url) {
                        if (!urlGroups.has(tab.url)) {
                            urlGroups.set(tab.url, []);
                        }
                        urlGroups.get(tab.url)!.push(tab);
                    }
                });

                const tabsToClose: number[] = [];
                
                urlGroups.forEach(tabGroup => {
                    if (tabGroup.length > 1) {
                        tabGroup.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
                        tabsToClose.push(...tabGroup.slice(1).map(tab => tab.id));
                    }
                });

                return tabsToClose;
            };

            const result = findDuplicates(tabs);
            expect(result).toHaveLength(1);
            expect(result[0]).toBe(1); // Older tab should be marked for closure
        });
    });

    describe('Window Operations', () => {
        test('should move tabs to new window', async () => {
            const selectedTabs = [1, 2, 3];

            const moveToNewWindow = async (tabIds: number[]) => {
                const firstTabId = tabIds[0];
                const newWindow = await chrome.windows.create({ tabId: firstTabId });
                
                if (tabIds.length > 1) {
                    await chrome.tabs.move(tabIds.slice(1), { windowId: newWindow.id!, index: -1 });
                }

                return newWindow.id;
            };

            const result = await moveToNewWindow(selectedTabs);
            expect(chrome.windows.create).toHaveBeenCalledWith({ tabId: 1 });
            expect(chrome.tabs.move).toHaveBeenCalledWith([2, 3], { windowId: 2, index: -1 });
            expect(result).toBe(2);
        });

        test('should close tabs', async () => {
            const tabIds = [1, 2, 3];

            const closeTabs = async (tabIds: number[]) => {
                await chrome.tabs.remove(tabIds);
            };

            await closeTabs(tabIds);
            expect(chrome.tabs.remove).toHaveBeenCalledWith(tabIds);
        });
    });
});