/**
 * Tabularasa - Manager Window
 * TypeScript implementation with tab grouping functionality
 */

// Types
interface TabInfo {
    id: number;
    title: string;
    url: string;
    favIconUrl?: string;
    active: boolean;
    pinned: boolean;
    windowId: number;
    groupId?: number;
    mutedInfo?: chrome.tabs.MutedInfo;
    audible?: boolean;
    lastAccessed?: number;
}

interface WindowInfo {
    id: number;
    focused: boolean;
    type: string;
    tabs: TabInfo[];
}

interface TabGroupInfo {
    id: number;
    title?: string;
    color: chrome.tabGroups.ColorEnum;
    collapsed: boolean;
    windowId: number;
}

// A rendered section of the tab list: one browser window, one Chrome tab
// group, or one domain, depending on the current view.
interface TabBucket {
    label: string;
    tabs: TabInfo[];
    chromeGroup?: TabGroupInfo;
}

type ViewType = 'windows' | 'groups' | 'domains';

interface SessionInfo {
    id: string;
    name: string;
    created: number;
    windows: {
        id: number;
        tabs: {
            url: string;
            title: string;
            pinned: boolean;
            muted: boolean;
            groupId?: number;
        }[];
        groups: {
            id: number;
            title?: string;
            color: chrome.tabGroups.ColorEnum;
        }[];
    }[];
}

// Global state
class TabManager {
    private static readonly FALLBACK_FAVICON =
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';

    private tabs: TabInfo[] = [];
    private windows: WindowInfo[] = [];
    private tabGroups: TabGroupInfo[] = [];
    private sessions: SessionInfo[] = [];
    private selectedTabs: Set<number> = new Set();
    private currentView: ViewType = 'windows';
    private searchQuery: string = '';
    private filterType: 'all' | 'active' | 'pinned' | 'audible' | 'grouped' = 'all';
    private loading: boolean = false;
    private statusMessageTimer: ReturnType<typeof setTimeout> | null = null;

    // DOM elements
    private elements = {
        searchInput: document.getElementById('search-input') as HTMLInputElement,
        tabsContainer: document.getElementById('tabs-container') as HTMLElement,
        viewToggle: document.getElementById('view-toggle') as HTMLButtonElement,
        sessionsToggle: document.getElementById('sessions-toggle') as HTMLButtonElement,
        tabView: document.getElementById('tab-view') as HTMLElement,
        sessionView: document.getElementById('session-view') as HTMLElement,
        loadingIndicator: document.getElementById('loading') as HTMLElement,
        statusMessage: document.getElementById('status-message') as HTMLElement,
        tabCount: document.getElementById('tab-count') as HTMLElement,
        selectedCount: document.getElementById('selected-count') as HTMLElement,
        filterType: document.getElementById('filter-type') as HTMLSelectElement,
        groupModal: document.getElementById('group-modal') as HTMLElement,
    };

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        this.setupEventListeners();
        await this.loadInitialData();
        this.render();
        this.setupMessageListener();
    }

    private setupEventListeners(): void {
        // Search functionality
        this.elements.searchInput.addEventListener('input', () => this.handleSearch());
        document.getElementById('clear-search')?.addEventListener('click', () => this.clearSearch());

        // View toggles
        this.elements.viewToggle.addEventListener('click', () => this.toggleView());
        this.elements.sessionsToggle.addEventListener('click', () => this.toggleSessionView());
        document.getElementById('back-to-tabs')?.addEventListener('click', () => this.showTabView());

        // Filter
        this.elements.filterType.addEventListener('change', () => this.handleFilterChange());

        // Global actions
        document.getElementById('select-all')?.addEventListener('click', () => this.selectAllTabs());
        document.getElementById('deselect-all')?.addEventListener('click', () => this.deselectAllTabs());
        document.getElementById('group-selected')?.addEventListener('click', () => this.showGroupModal());
        document.getElementById('ungroup-selected')?.addEventListener('click', () => this.ungroupSelectedTabs());
        document.getElementById('move-to-new-window')?.addEventListener('click', () => this.moveToNewWindow());
        document.getElementById('close-selected')?.addEventListener('click', () => this.closeSelectedTabs());
        document.getElementById('close-duplicates')?.addEventListener('click', () => this.closeDuplicateTabs());
        document.getElementById('new-tab')?.addEventListener('click', () => this.createNewTab());
        document.getElementById('refresh-tabs')?.addEventListener('click', () => this.refreshTabs());

        // Group management
        document.getElementById('create-tab-group')?.addEventListener('click', () => this.showGroupModal());
        document.getElementById('close-group-modal')?.addEventListener('click', () => this.hideGroupModal());
        document.getElementById('confirm-group-creation')?.addEventListener('click', () => this.confirmGroupCreation());
        document.getElementById('cancel-group-creation')?.addEventListener('click', () => this.hideGroupModal());

        // Session management
        document.getElementById('save-session')?.addEventListener('click', () => this.showSaveSessionForm());
        document.getElementById('save-session-confirm')?.addEventListener('click', () => this.saveSession());
        document.getElementById('cancel-session-save')?.addEventListener('click', () => this.hideSaveSessionForm());

        // Status message close
        document.querySelector('.close-status')?.addEventListener('click', () => this.hideStatusMessage());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    private setupMessageListener(): void {
        chrome.runtime.onMessage.addListener((message) => {
            switch (message.type) {
                case 'TAB_UPDATED':
                case 'TAB_CREATED':
                case 'TAB_REMOVED':
                case 'TAB_ACTIVATED':
                case 'TAB_MOVED':
                case 'WINDOW_REMOVED':
                case 'GROUP_CREATED':
                case 'GROUP_UPDATED':
                case 'GROUP_REMOVED':
                    this.refreshTabs();
                    break;
            }
        });
    }

    private async loadInitialData(): Promise<void> {
        this.showLoading(true);
        try {
            await Promise.all([
                this.loadTabs(),
                this.loadTabGroups(),
                this.loadSessions()
            ]);
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showStatusMessage('Error loading data', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    private async loadTabs(): Promise<void> {
        try {
            const [tabs, windows] = await Promise.all([
                chrome.tabs.query({}),
                chrome.windows.getAll({ populate: true })
            ]);

            this.tabs = tabs.map(tab => ({
                id: tab.id!,
                title: tab.title || '',
                url: tab.url || '',
                favIconUrl: tab.favIconUrl,
                active: tab.active,
                pinned: tab.pinned,
                windowId: tab.windowId,
                groupId: tab.groupId,
                mutedInfo: tab.mutedInfo,
                audible: tab.audible,
                lastAccessed: tab.lastAccessed
            }));
            
            this.windows = windows.map(window => ({
                id: window.id!,
                focused: window.focused,
                type: window.type!,
                tabs: (window.tabs || []).map(tab => ({
                    id: tab.id!,
                    title: tab.title || '',
                    url: tab.url || '',
                    favIconUrl: tab.favIconUrl,
                    active: tab.active,
                    pinned: tab.pinned,
                    windowId: tab.windowId,
                    groupId: tab.groupId,
                    mutedInfo: tab.mutedInfo,
                    audible: tab.audible,
                    lastAccessed: tab.lastAccessed
                }))
            }));

            // Drop selections for tabs that no longer exist (closed outside
            // the manager), otherwise bulk operations fail on stale ids.
            const existingIds = new Set(this.tabs.map(tab => tab.id));
            this.selectedTabs.forEach(id => {
                if (!existingIds.has(id)) {
                    this.selectedTabs.delete(id);
                }
            });
        } catch (error) {
            console.error('Error loading tabs:', error);
            throw error;
        }
    }

    private async loadTabGroups(): Promise<void> {
        try {
            const groups = await chrome.tabGroups.query({});
            this.tabGroups = groups;
        } catch (error) {
            console.error('Error loading tab groups:', error);
            // Tab groups might not be available in all Chrome versions
            this.tabGroups = [];
        }
    }

    private async loadSessions(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(['sessions']);
            this.sessions = result.sessions || [];
        } catch (error) {
            console.error('Error loading sessions:', error);
            throw error;
        }
    }

    private async refreshTabs(): Promise<void> {
        await this.loadTabs();
        await this.loadTabGroups();
        this.render();
    }

    private render(): void {
        if (this.loading) {
            this.showLoading(true);
            return;
        }

        this.renderTabs();
        this.renderSessions();
        this.updateGlobalActions();
        this.updateViewToggle();
        this.updateTabCount();
    }

    private renderTabs(): void {
        const filteredTabs = this.getFilteredTabs();

        this.elements.tabsContainer.innerHTML = '';

        if (filteredTabs.length === 0) {
            this.renderEmptyState();
            return;
        }

        this.buildBuckets(filteredTabs).forEach(bucket => {
            this.elements.tabsContainer.appendChild(this.createTabGroup(bucket));
        });
    }

    private getFilteredTabs(): TabInfo[] {
        let filtered = this.tabs;

        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(tab => 
                tab.title.toLowerCase().includes(query) || 
                tab.url.toLowerCase().includes(query)
            );
        }

        // Apply type filter
        switch (this.filterType) {
            case 'active':
                filtered = filtered.filter(tab => tab.active);
                break;
            case 'pinned':
                filtered = filtered.filter(tab => tab.pinned);
                break;
            case 'audible':
                filtered = filtered.filter(tab => tab.audible);
                break;
            case 'grouped':
                filtered = filtered.filter(tab => tab.groupId !== undefined && tab.groupId !== -1);
                break;
        }

        return filtered;
    }

    private buildBuckets(tabs: TabInfo[]): TabBucket[] {
        if (this.currentView === 'windows') {
            const byWindow = new Map<number, TabInfo[]>();
            tabs.forEach(tab => {
                if (!byWindow.has(tab.windowId)) {
                    byWindow.set(tab.windowId, []);
                }
                byWindow.get(tab.windowId)!.push(tab);
            });

            // Number windows by the browser's window order
            const buckets: TabBucket[] = [];
            const placed = new Set<number>();
            this.windows.forEach((window, index) => {
                const windowTabs = byWindow.get(window.id);
                if (windowTabs) {
                    placed.add(window.id);
                    buckets.push({
                        label: `Window ${index + 1}${window.focused ? ' (current)' : ''}`,
                        tabs: windowTabs
                    });
                }
            });
            // Windows that appeared after the last refresh of this.windows
            byWindow.forEach((windowTabs, windowId) => {
                if (!placed.has(windowId)) {
                    buckets.push({ label: `Window ${windowId}`, tabs: windowTabs });
                }
            });
            return buckets;
        }

        if (this.currentView === 'groups') {
            // Bucket by group id, not title, so groups that share a title
            // stay separate.
            const ungrouped: TabInfo[] = [];
            const byGroup = new Map<number, TabInfo[]>();
            tabs.forEach(tab => {
                const group = tab.groupId && tab.groupId !== -1
                    ? this.tabGroups.find(g => g.id === tab.groupId)
                    : undefined;
                if (group) {
                    if (!byGroup.has(group.id)) {
                        byGroup.set(group.id, []);
                    }
                    byGroup.get(group.id)!.push(tab);
                } else {
                    ungrouped.push(tab);
                }
            });

            const buckets: TabBucket[] = [];
            if (ungrouped.length > 0) {
                buckets.push({ label: 'Ungrouped', tabs: ungrouped });
            }
            Array.from(byGroup.entries())
                .sort(([, tabsA], [, tabsB]) => tabsB.length - tabsA.length)
                .forEach(([groupId, groupTabs]) => {
                    const chromeGroup = this.tabGroups.find(g => g.id === groupId)!;
                    buckets.push({
                        label: chromeGroup.title || `Group ${chromeGroup.id}`,
                        tabs: groupTabs,
                        chromeGroup
                    });
                });
            return buckets;
        }

        // Domain view
        const byDomain = new Map<string, TabInfo[]>();
        tabs.forEach(tab => {
            let domain: string;
            try {
                domain = new URL(tab.url).hostname || 'Unknown';
            } catch {
                domain = 'Unknown';
            }
            if (!byDomain.has(domain)) {
                byDomain.set(domain, []);
            }
            byDomain.get(domain)!.push(tab);
        });
        return Array.from(byDomain.entries())
            .sort(([, tabsA], [, tabsB]) => tabsB.length - tabsA.length)
            .map(([domain, domainTabs]) => ({ label: domain, tabs: domainTabs }));
    }

    private createTabGroup(bucket: TabBucket): HTMLElement {
        const { label: groupKey, tabs, chromeGroup: tabGroup } = bucket;
        const groupElement = document.createElement('div');
        groupElement.className = 'tab-group';

        if (tabGroup) {
            groupElement.classList.add('chrome-group');
        }

        // Group header
        const header = document.createElement('div');
        header.className = 'tab-group-header';
        
        const groupInfo = document.createElement('div');
        groupInfo.className = 'tab-group-info';
        
        if (tabGroup) {
            const colorIndicator = document.createElement('div');
            colorIndicator.className = `tab-group-color group-color-${tabGroup.color}`;
            groupInfo.appendChild(colorIndicator);
        }
        
        const title = document.createElement('span');
        title.className = 'tab-group-title';
        // textContent does not parse HTML, so the raw string is safe here;
        // escaping first would render literal entities like "&amp;".
        title.textContent = groupKey;
        groupInfo.appendChild(title);
        
        const count = document.createElement('span');
        count.className = 'tab-group-count';
        count.textContent = `${tabs.length} tabs`;
        groupInfo.appendChild(count);
        
        header.appendChild(groupInfo);

        // Group actions
        const actions = document.createElement('div');
        actions.className = 'tab-group-actions';
        
        // Select All button for domain groupings
        const selectAllBtn = document.createElement('button');
        selectAllBtn.className = 'btn btn-small btn-secondary';
        selectAllBtn.textContent = 'Select All';
        selectAllBtn.addEventListener('click', () => this.selectAllTabsInGroup(tabs));
        actions.appendChild(selectAllBtn);
        
        // Unselect All button for domain groupings
        const unselectAllBtn = document.createElement('button');
        unselectAllBtn.className = 'btn btn-small btn-secondary';
        unselectAllBtn.textContent = 'Unselect All';
        unselectAllBtn.addEventListener('click', () => this.unselectAllTabsInGroup(tabs));
        actions.appendChild(unselectAllBtn);
        
        if (tabGroup) {
            const collapseBtn = document.createElement('button');
            collapseBtn.className = 'btn btn-small btn-secondary';
            collapseBtn.textContent = tabGroup.collapsed ? 'Expand' : 'Collapse';
            collapseBtn.addEventListener('click', () => this.toggleGroupCollapse(tabGroup.id));
            actions.appendChild(collapseBtn);
            
            const ungroupBtn = document.createElement('button');
            ungroupBtn.className = 'btn btn-small btn-secondary';
            ungroupBtn.textContent = 'Ungroup';
            ungroupBtn.addEventListener('click', () => this.ungroupTabs(tabGroup.id));
            actions.appendChild(ungroupBtn);
        }
        
        const closeAllBtn = document.createElement('button');
        closeAllBtn.className = 'btn btn-small btn-danger';
        closeAllBtn.textContent = 'Close All';
        closeAllBtn.addEventListener('click', () => this.closeTabGroupOptimized(groupKey, tabs));
        actions.appendChild(closeAllBtn);
        
        header.appendChild(actions);
        groupElement.appendChild(header);

        // Group tabs
        tabs.forEach(tab => {
            const tabElement = this.createTabElement(tab);
            groupElement.appendChild(tabElement);
        });

        return groupElement;
    }

    private createTabElement(tab: TabInfo): HTMLElement {
        const tabElement = document.createElement('div');
        tabElement.className = `tab-item ${tab.active ? 'active' : ''} ${this.selectedTabs.has(tab.id) ? 'selected' : ''} ${tab.pinned ? 'pinned' : ''} ${tab.audible ? 'audible' : ''}`;
        tabElement.dataset.tabId = tab.id.toString();

        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tab-checkbox';
        checkbox.checked = this.selectedTabs.has(tab.id);
        tabElement.appendChild(checkbox);

        // Create favicon
        const favicon = document.createElement('img');
        favicon.className = 'tab-favicon';
        favicon.alt = 'Favicon';
        favicon.src = this.getFaviconUrl(tab.url);
        favicon.addEventListener('error', () => {
            favicon.src = TabManager.FALLBACK_FAVICON;
        }, { once: true });
        tabElement.appendChild(favicon);

        // Create single line content with title and truncated URL
        const content = document.createElement('div');
        content.className = 'tab-content';
        
        const title = document.createElement('span');
        title.className = 'tab-title';
        title.textContent = tab.title;
        
        const separator = document.createElement('span');
        separator.className = 'tab-separator';
        separator.textContent = ' • ';
        
        const url = document.createElement('span');
        url.className = 'tab-url';
        url.textContent = this.truncateUrl(tab.url);
        
        content.appendChild(title);
        content.appendChild(separator);
        content.appendChild(url);
        tabElement.appendChild(content);

        // Create indicators
        const indicators = document.createElement('div');
        indicators.className = 'tab-indicators';
        
        if (tab.pinned) {
            const pinIndicator = document.createElement('div');
            pinIndicator.className = 'tab-indicator pinned';
            pinIndicator.textContent = '📌';
            indicators.appendChild(pinIndicator);
        }
        
        if (tab.audible) {
            const audioIndicator = document.createElement('div');
            audioIndicator.className = 'tab-indicator audible';
            audioIndicator.textContent = '🔊';
            indicators.appendChild(audioIndicator);
        }
        
        if (tab.mutedInfo?.muted) {
            const muteIndicator = document.createElement('div');
            muteIndicator.className = 'tab-indicator muted';
            muteIndicator.textContent = '🔇';
            indicators.appendChild(muteIndicator);
        }
        
        tabElement.appendChild(indicators);

        // Create actions
        const actions = document.createElement('div');
        actions.className = 'tab-actions';
        
        const pinBtn = document.createElement('button');
        pinBtn.className = `tab-action ${tab.pinned ? 'pinned' : ''}`;
        pinBtn.title = `${tab.pinned ? 'Unpin' : 'Pin'} tab`;
        pinBtn.textContent = tab.pinned ? '📌' : '📍';
        actions.appendChild(pinBtn);
        
        const muteBtn = document.createElement('button');
        muteBtn.className = `tab-action ${tab.mutedInfo?.muted ? 'muted' : ''}`;
        muteBtn.title = `${tab.mutedInfo?.muted ? 'Unmute' : 'Mute'} tab`;
        muteBtn.textContent = tab.mutedInfo?.muted ? '🔇' : '🔊';
        actions.appendChild(muteBtn);
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-action close';
        closeBtn.title = 'Close tab';
        closeBtn.textContent = '✕';
        actions.appendChild(closeBtn);
        
        tabElement.appendChild(actions);

        this.setupTabElementListeners(tabElement, tab);
        return tabElement;
    }

    private setupTabElementListeners(tabElement: HTMLElement, tab: TabInfo): void {
        const checkbox = tabElement.querySelector('.tab-checkbox') as HTMLInputElement;
        const content = tabElement.querySelector('.tab-content') as HTMLElement;
        const actions = tabElement.querySelector('.tab-actions') as HTMLElement;
        const pinBtn = actions.children[0] as HTMLButtonElement;
        const muteBtn = actions.children[1] as HTMLButtonElement;
        const closeBtn = actions.children[2] as HTMLButtonElement;

        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            this.toggleTabSelection(tab.id);
        });

        content.addEventListener('click', (e) => {
            e.stopPropagation();
            this.switchToTab(tab.id);
        });

        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTabPin(tab.id);
        });

        muteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTabMute(tab.id);
        });

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tab.id);
        });
    }

    private renderEmptyState(): void {
        this.elements.tabsContainer.innerHTML = `
            <div class="empty-state">
                <span class="icon">🔍</span>
                <h3>No tabs found</h3>
                <p>Try adjusting your search query or filter settings.</p>
            </div>
        `;
    }

    private renderSessions(): void {
        const sessionsList = document.getElementById('sessions-list');
        if (!sessionsList) {return;}
        
        if (this.sessions.length === 0) {
            sessionsList.innerHTML = `
                <div class="empty-state">
                    <span class="icon">💾</span>
                    <h3>No saved sessions</h3>
                    <p>Save your current tabs to quickly restore them later.</p>
                </div>
            `;
            return;
        }

        sessionsList.innerHTML = '';

        this.sessions.forEach(session => {
            const sessionElement = this.createSessionElement(session);
            sessionsList.appendChild(sessionElement);
        });
    }

    private createSessionElement(session: SessionInfo): HTMLElement {
        const sessionElement = document.createElement('div');
        sessionElement.className = 'session-item';
        sessionElement.dataset.sessionId = session.id;

        const tabCount = session.windows.reduce((count, window) => count + window.tabs.length, 0);
        const windowCount = session.windows.length;

        // Note: inline onclick handlers are blocked by the Manifest V3 CSP,
        // so buttons must be wired up with addEventListener.
        const info = document.createElement('div');
        info.className = 'session-info';

        const name = document.createElement('div');
        name.className = 'session-name';
        name.textContent = session.name;
        info.appendChild(name);

        const details = document.createElement('div');
        details.className = 'session-details';
        details.textContent = `${tabCount} tabs • ${windowCount} windows • ${new Date(session.created).toLocaleDateString()}`;
        info.appendChild(details);

        const actions = document.createElement('div');
        actions.className = 'session-actions';

        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-small btn-primary';
        openBtn.textContent = 'Open';
        openBtn.addEventListener('click', () => this.openSession(session.id));
        actions.appendChild(openBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-small btn-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => this.deleteSession(session.id));
        actions.appendChild(deleteBtn);

        sessionElement.appendChild(info);
        sessionElement.appendChild(actions);

        return sessionElement;
    }

    // Event handlers
    private handleSearch(): void {
        this.searchQuery = this.elements.searchInput.value.trim();
        this.render();
    }

    private clearSearch(): void {
        this.elements.searchInput.value = '';
        this.searchQuery = '';
        this.render();
    }

    private handleFilterChange(): void {
        this.filterType = this.elements.filterType.value as 'all' | 'active' | 'pinned' | 'audible' | 'grouped';
        this.render();
    }

    private toggleView(): void {
        const order: ViewType[] = ['windows', 'groups', 'domains'];
        this.currentView = order[(order.indexOf(this.currentView) + 1) % order.length];
        this.render();
    }

    private updateViewToggle(): void {
        const views: Record<ViewType, { icon: string; text: string }> = {
            windows: { icon: '🪟', text: 'Windows' },
            groups: { icon: '📁', text: 'Groups' },
            domains: { icon: '🌐', text: 'Domains' }
        };
        const { icon, text } = views[this.currentView];

        this.elements.viewToggle.innerHTML = `
            <span class="icon">${icon}</span>
            <span class="text">${text}</span>
        `;
    }

    private toggleSessionView(): void {
        this.elements.tabView.classList.toggle('active');
        this.elements.sessionView.classList.toggle('active');
    }

    private showTabView(): void {
        this.elements.tabView.classList.add('active');
        this.elements.sessionView.classList.remove('active');
    }

    private toggleTabSelection(tabId: number): void {
        if (this.selectedTabs.has(tabId)) {
            this.selectedTabs.delete(tabId);
        } else {
            this.selectedTabs.add(tabId);
        }
        this.render();
    }

    private selectAllTabs(): void {
        const filteredTabs = this.getFilteredTabs();
        filteredTabs.forEach(tab => this.selectedTabs.add(tab.id));
        this.render();
    }

    private deselectAllTabs(): void {
        this.selectedTabs.clear();
        this.render();
    }

    private updateGlobalActions(): void {
        const selectedCount = this.selectedTabs.size;
        
        const buttons = {
            groupSelected: document.getElementById('group-selected') as HTMLButtonElement,
            ungroupSelected: document.getElementById('ungroup-selected') as HTMLButtonElement,
            moveToNew: document.getElementById('move-to-new-window') as HTMLButtonElement,
            closeSelected: document.getElementById('close-selected') as HTMLButtonElement,
        };

        Object.values(buttons).forEach(btn => {
            if (btn) {btn.disabled = selectedCount === 0;}
        });

        if (buttons.closeSelected) {
            buttons.closeSelected.textContent = selectedCount > 0 ? `Close Selected (${selectedCount})` : 'Close Selected';
        }
    }

    private updateTabCount(): void {
        const totalTabs = this.tabs.length;
        const selectedCount = this.selectedTabs.size;
        
        this.elements.tabCount.textContent = `${totalTabs} tabs`;
        this.elements.selectedCount.textContent = `${selectedCount} selected`;
    }

    // Tab operations
    private async switchToTab(tabId: number): Promise<void> {
        try {
            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) {
                await chrome.tabs.update(tabId, { active: true });
                await chrome.windows.update(tab.windowId, { focused: true });
                this.showStatusMessage('Switched to tab');
            }
        } catch (error) {
            console.error('Error switching to tab:', error);
            this.showStatusMessage('Error switching to tab', 'error');
        }
    }

    private async closeTab(tabId: number): Promise<void> {
        try {
            await chrome.tabs.remove(tabId);
            this.selectedTabs.delete(tabId);
            this.showStatusMessage('Tab closed');
            // Refresh the view immediately after closing
            await this.refreshTabs();
        } catch (error) {
            console.error('Error closing tab:', error);
            this.showStatusMessage('Error closing tab', 'error');
        }
    }

    private async closeSelectedTabs(): Promise<void> {
        if (this.selectedTabs.size === 0) {return;}

        try {
            const tabIds = Array.from(this.selectedTabs);
            await chrome.tabs.remove(tabIds);
            this.selectedTabs.clear();
            this.showStatusMessage(`${tabIds.length} tabs closed`);
            // Refresh the view immediately after closing
            await this.refreshTabs();
        } catch (error) {
            console.error('Error closing selected tabs:', error);
            this.showStatusMessage('Error closing tabs', 'error');
        }
    }

    private async closeTabGroupOptimized(groupKey: string, tabs: TabInfo[]): Promise<void> {
        try {
            if (tabs.length > 0) {
                // Remove tabs from selection to avoid re-rendering issues
                tabs.forEach(tab => this.selectedTabs.delete(tab.id));
                
                // Close tabs in batches to improve performance
                const batchSize = 10;
                const tabIds = tabs.map(tab => tab.id);
                
                for (let i = 0; i < tabIds.length; i += batchSize) {
                    const batch = tabIds.slice(i, i + batchSize);
                    await chrome.tabs.remove(batch);
                    
                    // Small delay to prevent overwhelming the Chrome API
                    if (i + batchSize < tabIds.length) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
                
                this.showStatusMessage(`${tabIds.length} tabs closed from ${groupKey}`);
                // Refresh the view immediately after closing
                await this.refreshTabs();
            }
        } catch (error) {
            console.error('Error closing tab group:', error);
            this.showStatusMessage('Error closing tab group', 'error');
        }
    }

    private selectAllTabsInGroup(tabs: TabInfo[]): void {
        tabs.forEach(tab => this.selectedTabs.add(tab.id));
        this.updateGlobalActions();
        this.updateTabCount();
        this.render();
    }

    private unselectAllTabsInGroup(tabs: TabInfo[]): void {
        tabs.forEach(tab => this.selectedTabs.delete(tab.id));
        this.updateGlobalActions();
        this.updateTabCount();
        this.render();
    }

    private async toggleTabPin(tabId: number): Promise<void> {
        try {
            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) {
                await chrome.tabs.update(tabId, { pinned: !tab.pinned });
                this.showStatusMessage(`Tab ${tab.pinned ? 'unpinned' : 'pinned'}`);
                await this.refreshTabs();
            }
        } catch (error) {
            console.error('Error toggling tab pin:', error);
            this.showStatusMessage('Error toggling tab pin', 'error');
        }
    }

    private async toggleTabMute(tabId: number): Promise<void> {
        try {
            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) {
                const muted = tab.mutedInfo?.muted || false;
                await chrome.tabs.update(tabId, { muted: !muted });
                this.showStatusMessage(`Tab ${muted ? 'unmuted' : 'muted'}`);
                await this.refreshTabs();
            }
        } catch (error) {
            console.error('Error toggling tab mute:', error);
            this.showStatusMessage('Error toggling tab mute', 'error');
        }
    }

    private async moveToNewWindow(): Promise<void> {
        if (this.selectedTabs.size === 0) {return;}

        try {
            const tabIds = Array.from(this.selectedTabs);
            const firstTabId = tabIds[0];
            
            const newWindow = await chrome.windows.create({ tabId: firstTabId });
            
            if (tabIds.length > 1) {
                await chrome.tabs.move(tabIds.slice(1), { windowId: newWindow.id!, index: -1 });
            }

            this.selectedTabs.clear();
            this.showStatusMessage(`${tabIds.length} tabs moved to new window`);
            await this.refreshTabs();
        } catch (error) {
            console.error('Error moving tabs to new window:', error);
            this.showStatusMessage('Error moving tabs to new window', 'error');
        }
    }

    private async closeDuplicateTabs(): Promise<void> {
        try {
            const urlGroups = new Map<string, TabInfo[]>();
            
            this.tabs.forEach(tab => {
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

            if (tabsToClose.length > 0) {
                // Close tabs individually to handle cases where some tabs may already be closed
                let closedCount = 0;
                for (const tabId of tabsToClose) {
                    try {
                        await chrome.tabs.remove(tabId);
                        closedCount++;
                    } catch (error) {
                        // Tab may already be closed, continue with others
                        console.warn(`Tab ${tabId} could not be closed (may already be closed):`, error);
                    }
                }
                
                if (closedCount > 0) {
                    this.showStatusMessage(`${closedCount} duplicate tabs closed`);
                    // Refresh the tab list to update the UI
                    await this.refreshTabs();
                } else {
                    this.showStatusMessage('No duplicate tabs could be closed');
                }
            } else {
                this.showStatusMessage('No duplicate tabs found');
            }
        } catch (error) {
            console.error('Error closing duplicate tabs:', error);
            this.showStatusMessage('Error closing duplicate tabs', 'error');
        }
    }

    private async createNewTab(): Promise<void> {
        try {
            await chrome.tabs.create({ url: 'chrome://newtab/' });
            this.showStatusMessage('New tab created');
        } catch (error) {
            console.error('Error creating new tab:', error);
            this.showStatusMessage('Error creating new tab', 'error');
        }
    }

    // Tab grouping operations
    private showGroupModal(): void {
        this.elements.groupModal.classList.remove('hidden');
        const groupNameInput = document.getElementById('group-name') as HTMLInputElement;
        groupNameInput.focus();
    }

    private hideGroupModal(): void {
        this.elements.groupModal.classList.add('hidden');
        const groupNameInput = document.getElementById('group-name') as HTMLInputElement;
        const groupColorSelect = document.getElementById('group-color') as HTMLSelectElement;
        groupNameInput.value = '';
        groupColorSelect.value = 'grey';
    }

    private async confirmGroupCreation(): Promise<void> {
        const groupName = (document.getElementById('group-name') as HTMLInputElement).value.trim();
        const groupColor = (document.getElementById('group-color') as HTMLSelectElement).value as chrome.tabGroups.ColorEnum;

        if (this.selectedTabs.size === 0) {
            this.showStatusMessage('Please select tabs to group', 'error');
            return;
        }

        try {
            const tabIds = Array.from(this.selectedTabs);
            const groupId = await chrome.tabs.group({ tabIds });

            await chrome.tabGroups.update(groupId, {
                title: groupName || undefined,
                color: groupColor
            });

            this.selectedTabs.clear();
            this.hideGroupModal();
            this.showStatusMessage(`Created group ${groupName || 'Untitled'} with ${tabIds.length} tabs`);
            await this.refreshTabs();
        } catch (error) {
            console.error('Error creating tab group:', error);
            this.showStatusMessage('Error creating tab group', 'error');
        }
    }

    private async ungroupSelectedTabs(): Promise<void> {
        if (this.selectedTabs.size === 0) {return;}

        try {
            const tabIds = Array.from(this.selectedTabs);
            await chrome.tabs.ungroup(tabIds);
            this.selectedTabs.clear();
            this.showStatusMessage(`${tabIds.length} tabs ungrouped`);
            await this.refreshTabs();
        } catch (error) {
            console.error('Error ungrouping tabs:', error);
            this.showStatusMessage('Error ungrouping tabs', 'error');
        }
    }

    private async ungroupTabs(groupId: number): Promise<void> {
        try {
            const tabsInGroup = this.tabs.filter(tab => tab.groupId === groupId);
            const tabIds = tabsInGroup.map(tab => tab.id);
            await chrome.tabs.ungroup(tabIds);
            this.showStatusMessage(`Ungrouped ${tabIds.length} tabs`);
            await this.refreshTabs();
        } catch (error) {
            console.error('Error ungrouping tabs:', error);
            this.showStatusMessage('Error ungrouping tabs', 'error');
        }
    }

    private async toggleGroupCollapse(groupId: number): Promise<void> {
        try {
            const group = this.tabGroups.find(g => g.id === groupId);
            if (group) {
                await chrome.tabGroups.update(groupId, { collapsed: !group.collapsed });
                this.showStatusMessage(`Group ${group.collapsed ? 'expanded' : 'collapsed'}`);
                await this.refreshTabs();
            }
        } catch (error) {
            console.error('Error toggling group collapse:', error);
            this.showStatusMessage('Error toggling group collapse', 'error');
        }
    }

    // Session management
    private showSaveSessionForm(): void {
        const form = document.getElementById('session-save-form');
        if (form) {
            form.classList.remove('hidden');
            const nameInput = document.getElementById('session-name') as HTMLInputElement;
            nameInput.focus();
        }
    }

    private hideSaveSessionForm(): void {
        const form = document.getElementById('session-save-form');
        if (form) {
            form.classList.add('hidden');
            const nameInput = document.getElementById('session-name') as HTMLInputElement;
            nameInput.value = '';
        }
    }

    private async saveSession(): Promise<void> {
        const sessionName = (document.getElementById('session-name') as HTMLInputElement).value.trim();
        const saveType = (document.querySelector('input[name="save-type"]:checked') as HTMLInputElement).value;

        if (!sessionName) {
            this.showStatusMessage('Please enter a session name', 'error');
            return;
        }

        try {
            const session: SessionInfo = {
                id: Date.now().toString(),
                name: sessionName,
                created: Date.now(),
                windows: []
            };

            if (saveType === 'current') {
                const currentWindow = await chrome.windows.getCurrent({ populate: true });
                const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
                
                session.windows.push({
                    id: currentWindow.id!,
                    tabs: (currentWindow.tabs || []).map(tab => ({
                        url: tab.url || '',
                        title: tab.title || '',
                        pinned: tab.pinned,
                        muted: tab.mutedInfo?.muted || false,
                        groupId: tab.groupId
                    })),
                    groups: groups.map(group => ({
                        id: group.id,
                        title: group.title,
                        color: group.color
                    }))
                });
            } else {
                const windows = await chrome.windows.getAll({ populate: true });
                for (const window of windows.filter(w => w.type === 'normal')) {
                    const groups = await chrome.tabGroups.query({ windowId: window.id });
                    session.windows.push({
                        id: window.id!,
                        tabs: (window.tabs || []).map(tab => ({
                            url: tab.url || '',
                            title: tab.title || '',
                            pinned: tab.pinned,
                            muted: tab.mutedInfo?.muted || false,
                            groupId: tab.groupId
                        })),
                        groups: groups.map(group => ({
                            id: group.id,
                            title: group.title,
                            color: group.color
                        }))
                    });
                }
            }

            this.sessions.push(session);
            await chrome.storage.local.set({ sessions: this.sessions });
            
            this.hideSaveSessionForm();
            this.renderSessions();
            this.showStatusMessage('Session saved successfully');
        } catch (error) {
            console.error('Error saving session:', error);
            this.showStatusMessage('Error saving session', 'error');
        }
    }

    async openSession(sessionId: string): Promise<void> {
        try {
            const session = this.sessions.find(s => s.id === sessionId);
            if (!session) {return;}

            for (const windowData of session.windows) {
                const tabs = windowData.tabs.filter(tab => tab.url && !tab.url.startsWith('chrome://'));
                if (tabs.length === 0) {continue;}

                const newWindow = await chrome.windows.create({ 
                    url: tabs[0].url,
                    focused: false 
                });

                // Create tab groups first
                const tabsRestoredInGroups = new Set<typeof tabs[number]>();
                for (const groupData of windowData.groups) {
                    const tabsInGroup = tabs.filter(tab => tab.groupId === groupData.id);
                    if (tabsInGroup.length > 0) {
                        const tabIds = [];
                        for (const tab of tabsInGroup) {
                            tabsRestoredInGroups.add(tab);
                            if (tab !== tabs[0]) { // Skip first tab as it's already created
                                const newTab = await chrome.tabs.create({
                                    windowId: newWindow.id,
                                    url: tab.url,
                                    pinned: tab.pinned,
                                    active: false
                                });
                                if (tab.muted) {
                                    await chrome.tabs.update(newTab.id!, { muted: true });
                                }
                                tabIds.push(newTab.id!);
                            } else {
                                tabIds.push(newWindow.tabs![0].id!);
                            }
                        }

                        const newGroupId = await chrome.tabs.group({ tabIds });
                        await chrome.tabGroups.update(newGroupId, {
                            title: groupData.title,
                            color: groupData.color
                        });
                    }
                }

                // Add remaining tabs. Ungrouped tabs have a groupId of -1 (or
                // undefined), so restore every tab that wasn't part of a group
                // recreated above.
                for (let i = 1; i < tabs.length; i++) {
                    const tab = tabs[i];
                    if (!tabsRestoredInGroups.has(tab)) {
                        const newTab = await chrome.tabs.create({
                            windowId: newWindow.id,
                            url: tab.url,
                            pinned: tab.pinned,
                            active: false
                        });

                        if (tab.muted) {
                            await chrome.tabs.update(newTab.id!, { muted: true });
                        }
                    }
                }
            }

            this.showStatusMessage(`Session "${session.name}" opened`);
        } catch (error) {
            console.error('Error opening session:', error);
            this.showStatusMessage('Error opening session', 'error');
        }
    }

    async deleteSession(sessionId: string): Promise<void> {
        try {
            const sessionIndex = this.sessions.findIndex(s => s.id === sessionId);
            if (sessionIndex === -1) {return;}

            const session = this.sessions[sessionIndex];
            this.sessions.splice(sessionIndex, 1);
            await chrome.storage.local.set({ sessions: this.sessions });
            
            this.renderSessions();
            this.showStatusMessage(`Session "${session.name}" deleted`);
        } catch (error) {
            console.error('Error deleting session:', error);
            this.showStatusMessage('Error deleting session', 'error');
        }
    }

    private handleKeyboardShortcuts(event: KeyboardEvent): void {
        // Leave shortcuts alone while the user is typing in a form field
        // (e.g. Ctrl+A in the search box should select the text, not tabs).
        const target = event.target as HTMLElement;
        if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
            return;
        }

        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'f':
                    event.preventDefault();
                    this.elements.searchInput.focus();
                    break;
                case 'a':
                    event.preventDefault();
                    this.selectAllTabs();
                    break;
                case 'n':
                    event.preventDefault();
                    this.createNewTab();
                    break;
                case 'g':
                    event.preventDefault();
                    if (this.selectedTabs.size > 0) {
                        this.showGroupModal();
                    }
                    break;
            }
        }
    }

    // Utility functions
    private showLoading(show: boolean): void {
        this.loading = show;
        this.elements.loadingIndicator.classList.toggle('hidden', !show);
    }

    private showStatusMessage(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
        const messageElement = this.elements.statusMessage.querySelector('.message-text') as HTMLElement;
        messageElement.textContent = message;
        this.elements.statusMessage.className = `status-message ${type}`;
        this.elements.statusMessage.classList.remove('hidden');

        // Reset the hide timer so an earlier message's timeout doesn't
        // dismiss this one prematurely.
        if (this.statusMessageTimer !== null) {
            clearTimeout(this.statusMessageTimer);
        }
        this.statusMessageTimer = setTimeout(() => {
            this.hideStatusMessage();
        }, 3000);
    }

    private hideStatusMessage(): void {
        this.elements.statusMessage.classList.add('hidden');
    }

    /**
     * Resolves a tab's favicon through Chrome's local favicon cache
     * (chrome-extension://<id>/_favicon) instead of fetching tab.favIconUrl
     * directly. Sites that send a Cross-Origin-Resource-Policy header block
     * that direct cross-origin fetch (ERR_BLOCKED_BY_RESPONSE.NotSameOrigin);
     * the _favicon endpoint reads Chrome's cache locally, so it never issues
     * a cross-origin request and never hits that block. Requires the
     * "favicon" permission in manifest.json.
     */
    private getFaviconUrl(pageUrl: string): string {
        if (!pageUrl) {
            return TabManager.FALLBACK_FAVICON;
        }
        const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
        faviconUrl.searchParams.set('pageUrl', pageUrl);
        faviconUrl.searchParams.set('size', '32');
        return faviconUrl.toString();
    }

    private truncateUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            const path = urlObj.pathname + urlObj.search;
            
            // Show domain + path, but truncate if too long
            const maxLength = 60;
            const fullUrl = domain + path;
            
            if (fullUrl.length <= maxLength) {
                return fullUrl;
            }
            
            // Truncate the path part if too long
            const availableLength = maxLength - domain.length - 3; // -3 for "..."
            if (availableLength > 0 && path.length > availableLength) {
                return domain + path.substring(0, availableLength) + '...';
            }
            
            return domain + '...';
        } catch {
            // If URL parsing fails, just truncate the original URL
            return url.length > 60 ? url.substring(0, 57) + '...' : url;
        }
    }
}

// Initialize the tab manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    (window as unknown as { tabManager: TabManager }).tabManager = new TabManager();
});

// Make TabManager available globally
(window as unknown as { TabManager: typeof TabManager }).TabManager = TabManager;