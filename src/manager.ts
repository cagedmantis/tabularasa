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
    index: number;
}

interface WindowInfo {
    id: number;
    focused: boolean;
    type: string;
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
    // Closing this many tabs at once (or any tab hidden by the current
    // search/filter) asks for confirmation first.
    private static readonly CONFIRM_CLOSE_THRESHOLD = 10;
    private static readonly STATUS_DURATION_MS = 3000;
    // Messages offering Undo stay up longer so there is time to react.
    private static readonly UNDO_DURATION_MS = 10000;

    // Schemes a saved session may contain. Everything else (chrome://,
    // chrome-extension:// including this page, devtools://, javascript:,
    // about:, ...) either cannot be opened by an extension or must not be,
    // and is skipped both when saving and when restoring.
    private static readonly RESTORABLE_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

    // Browser events are coalesced into at most one refresh per this window.
    private static readonly REFRESH_DELAY_MS = 150;

    private static readonly SEARCH_DELAY_MS = 100;

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
    private searchTimer: ReturnType<typeof setTimeout> | null = null;
    // Rendered rows by tab id, with a signature of the data they show. A
    // row whose signature is unchanged is reused instead of rebuilt, which
    // also spares its favicon from being fetched and decoded again.
    private tabRows: Map<number, { signature: string; element: HTMLElement }> = new Map();
    // Signature of everything the list last rendered. Most browser events
    // change nothing that is shown; when it matches, the list is left alone.
    private renderedListSignature: string | null = null;
    // Every load takes the next generation number, and a snapshot is
    // committed only if it is newer than the last one committed. Loads that
    // finish out of order therefore cannot put an older snapshot on screen,
    // while a load whose successor fails still gets to commit.
    private refreshGeneration: number = 0;
    private committedGeneration: number = 0;
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;
    // Set when a browser event arrives while this page is hidden; the
    // refresh it calls for happens when the page is shown again.
    private refreshPending: boolean = false;
    private statusMessageDuration: number = TabManager.STATUS_DURATION_MS;
    private restoringSession: boolean = false;
    // Id of the tab hosting this page. It is listed like any other tab but is
    // kept out of selections and bulk closes: removing it destroys this page
    // and abandons whatever operation is in flight.
    private ownTabId: number | null = null;

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
        // Subscribe before the first load so nothing that happens while it
        // is in flight is missed.
        this.setupBrowserListeners();
        this.setupStorageListener();
        await this.loadInitialData();
        this.render();
        this.renderSessions();
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
        document.getElementById('cancel-session-save')?.addEventListener('click', () => this.cancelSessionSave());

        // Status message close
        document.querySelector('.close-status')?.addEventListener('click', () => this.hideStatusMessage());
        ['mouseenter', 'focusin'].forEach(type =>
            this.elements.statusMessage.addEventListener(type, () => this.pauseStatusMessageTimer()));
        ['mouseleave', 'focusout'].forEach(type =>
            this.elements.statusMessage.addEventListener(type, () => {
                if (!this.elements.statusMessage.classList.contains('hidden')) {
                    this.startStatusMessageTimer();
                }
            }));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    /**
     * This page has full access to the Chrome APIs, so it listens for tab,
     * window and group changes itself rather than having the service worker
     * relay them, which would wake the worker for every tab event in the
     * browser whether or not a manager is open.
     */
    private setupBrowserListeners(): void {
        const events: { addListener(callback: () => void): void }[] = [
            chrome.tabs.onCreated,
            chrome.tabs.onUpdated,
            chrome.tabs.onRemoved,
            chrome.tabs.onActivated,
            chrome.tabs.onMoved,
            chrome.tabs.onAttached,
            chrome.tabs.onDetached,
            chrome.windows.onCreated,
            chrome.windows.onRemoved,
            chrome.tabGroups.onCreated,
            chrome.tabGroups.onUpdated,
            chrome.tabGroups.onMoved,
            chrome.tabGroups.onRemoved
        ];
        events.forEach(event => event.addListener(() => this.scheduleRefresh()));

        // Chrome can swap a tab for another (prerendered pages), giving it a
        // new id. Carry the selection over before refreshing.
        chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
            if (this.selectedTabs.delete(removedTabId)) {
                this.selectedTabs.add(addedTabId);
            }
            this.scheduleRefresh();
        });

        // Keeps the "(current)" label right. Chrome also fires this with
        // WINDOW_ID_NONE whenever the user switches to another application,
        // which changes nothing worth a refresh.
        chrome.windows.onFocusChanged.addListener(windowId => {
            if (windowId !== chrome.windows.WINDOW_ID_NONE) {
                this.scheduleRefresh();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.refreshPending) {
                // Refresh at once rather than after the coalescing delay:
                // the list on screen is stale and already clickable.
                this.refreshPending = false;
                this.refreshTabs().catch(error => console.error('Error refreshing tabs:', error));
            }
        });
    }

    /**
     * Requests a refresh in response to a browser event. One page load
     * fires several events and a bulk close fires one per tab, so requests
     * are coalesced; while this page is hidden they are only remembered.
     */
    private scheduleRefresh(): void {
        if (document.hidden) {
            this.refreshPending = true;
            return;
        }
        this.refreshPending = false;
        // Not reset by later events, so a steady stream cannot starve it.
        if (this.refreshTimer !== null) {return;}

        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null;
            this.refreshTabs().catch(error => console.error('Error refreshing tabs:', error));
        }, TabManager.REFRESH_DELAY_MS);
    }

    private async loadInitialData(): Promise<void> {
        this.showLoading(true);
        try {
            await Promise.all([
                this.loadOwnTabId(),
                this.loadBrowserState(),
                this.loadSessions()
            ]);
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showStatusMessage('Error loading data', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    private async loadOwnTabId(): Promise<void> {
        try {
            const ownTab = await chrome.tabs.getCurrent();
            this.ownTabId = ownTab?.id ?? null;
        } catch (error) {
            console.error('Error resolving the manager tab:', error);
        }
    }

    private isOwnTab(tabId: number): boolean {
        return tabId === this.ownTabId;
    }

    /**
     * Fetches tabs, windows and groups and commits them together, so the
     * three always describe the same moment. Returns false, committing
     * nothing, when a newer snapshot has already been committed.
     */
    private async loadBrowserState(): Promise<boolean> {
        const generation = ++this.refreshGeneration;
        let allTabs: chrome.tabs.Tab[];
        let allWindows: chrome.windows.Window[];
        let tabGroups: TabGroupInfo[];
        try {
            [allTabs, allWindows, tabGroups] = await Promise.all([
                chrome.tabs.query({}),
                // Window metadata only: tabs.query already returns every tab,
                // so populating the windows would transfer them all twice.
                // Every type is asked for: the default leaves out app and
                // devtools windows, whose tabs tabs.query still returns.
                chrome.windows.getAll({ windowTypes: ['normal', 'popup', 'panel', 'app', 'devtools'] }),
                this.queryTabGroups()
            ]);
        } catch (error) {
            console.error('Error loading tabs:', error);
            throw error;
        }
        if (generation < this.committedGeneration) {return false;}
        this.committedGeneration = generation;

        // The manifest sets "incognito": "not_allowed", so Chrome never
        // reports incognito tabs. Filter anyway so that a manifest change
        // cannot silently start listing (and saving) private browsing.
        const tabs = allTabs.filter(tab => !tab.incognito);
        const windows = allWindows.filter(window => !window.incognito);

        const toTabInfo = (tab: chrome.tabs.Tab): TabInfo => ({
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
            lastAccessed: tab.lastAccessed,
            index: tab.index
        });

        this.tabs = tabs.map(toTabInfo);
        this.windows = windows.map(window => ({
            id: window.id!,
            focused: window.focused,
            type: window.type!
        }));
        this.tabGroups = tabGroups;

        // Drop selections for tabs that no longer exist (closed outside
        // the manager), otherwise bulk operations fail on stale ids.
        const existingIds = new Set(this.tabs.map(tab => tab.id));
        this.selectedTabs.forEach(id => {
            if (!existingIds.has(id)) {
                this.selectedTabs.delete(id);
            }
        });
        return true;
    }

    private async queryTabGroups(): Promise<TabGroupInfo[]> {
        try {
            return await chrome.tabGroups.query({});
        } catch (error) {
            console.error('Error loading tab groups:', error);
            // Tab groups might not be available in all Chrome versions
            return [];
        }
    }

    /**
     * Applies a change to the sessions as they are in storage now, not as
     * this page last saw them: another manager page may have saved or
     * deleted a session since, and writing this.sessions back whole would
     * silently undo that. Memory is updated only from what was written, so
     * a failed write leaves the list showing what is really stored.
     */
    private async updateStoredSessions(update: (sessions: SessionInfo[]) => SessionInfo[]): Promise<void> {
        // Manager pages share an origin, so a Web Lock serializes the
        // read-modify-write across all of them.
        await navigator.locks.request('tabularasa-sessions', async () => {
            const stored = await chrome.storage.local.get(['sessions']);
            const sessions = update(this.asSessions(stored.sessions));
            await chrome.storage.local.set({ sessions });
            this.sessions = sessions;
        });
    }

    // Anything but an array under the storage key is treated as no sessions,
    // so damaged storage cannot make every load and save throw.
    private asSessions(stored: unknown): SessionInfo[] {
        return Array.isArray(stored) ? stored : [];
    }

    private isQuotaError(error: unknown): boolean {
        return /quota/i.test(error instanceof Error ? error.message : String(error));
    }

    // Keeps the list current when another manager page changes the sessions.
    private setupStorageListener(): void {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.sessions) {
                this.sessions = this.asSessions(changes.sessions.newValue);
                this.renderSessions();
            }
        });
    }

    private async loadSessions(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(['sessions']);
            this.sessions = this.asSessions(result.sessions);
        } catch (error) {
            console.error('Error loading sessions:', error);
            throw error;
        }
    }

    private async refreshTabs(): Promise<void> {
        if (await this.loadBrowserState()) {
            this.render();
        }
    }

    private render(): void {
        if (this.loading) {
            this.showLoading(true);
            return;
        }

        // Sessions are not rendered here: they change only through session
        // operations, which render the list themselves.
        this.renderTabs();
        this.updateGlobalActions();
        this.updateViewToggle();
        this.updateTabCount();
    }

    private renderTabs(): void {
        const buckets = this.buildBuckets(this.getFilteredTabs());

        // Leave the DOM alone when nothing shown has changed: a rebuild
        // blurs and refocuses the focused control, which a screen reader
        // announces again every time.
        const listSignature = JSON.stringify(buckets.map(bucket => [
            bucket.label,
            bucket.chromeGroup?.color,
            bucket.chromeGroup?.collapsed,
            bucket.tabs.map(tab => [tab.id, this.rowSignature(tab)])
        ]));
        if (listSignature === this.renderedListSignature) {
            this.renderSelection();
            return;
        }
        this.renderedListSignature = listSignature;

        const restoreFocus = this.captureFocus();

        this.elements.tabsContainer.innerHTML = '';

        if (buckets.length === 0) {
            this.renderEmptyState();
        } else {
            buckets.forEach(bucket => {
                this.elements.tabsContainer.appendChild(this.createTabGroup(bucket));
            });
        }

        // Forget rows of tabs that no longer exist
        const existingIds = new Set(this.tabs.map(tab => tab.id));
        this.tabRows.forEach((_, tabId) => {
            if (!existingIds.has(tabId)) {
                this.tabRows.delete(tabId);
            }
        });

        restoreFocus();
    }

    /**
     * Rebuilding the list detaches every row, which drops keyboard focus to
     * the page body. Remember which control of which tab had focus and
     * return a function that puts it back after the rebuild.
     */
    private captureFocus(): () => void {
        const focused = document.activeElement;
        const row = focused?.closest<HTMLElement>('.tab-item');
        if (!focused || !row || !this.elements.tabsContainer.contains(row)) {
            return () => undefined;
        }
        const tabId = row.dataset.tabId;
        const controlIndex = Array.from(row.querySelectorAll('input, button')).indexOf(focused);

        return () => {
            const newRow = this.elements.tabsContainer.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
            const control = newRow?.querySelectorAll<HTMLElement>('input, button')[controlIndex];
            // The row is gone when its tab was closed or filtered out; keep
            // focus in the list rather than letting it fall to the body.
            (control ?? this.elements.tabsContainer).focus();
        };
    }

    /**
     * Everything a row shows. favIconUrl is not rendered itself (the image
     * comes from chrome's _favicon cache, keyed by page URL), but it is what
     * changes when a page's icon becomes known: Chrome reports url, then
     * title, then favIconUrl, so without it a row built at the title change
     * would keep the placeholder icon for good.
     */
    private rowSignature(tab: TabInfo): string {
        return JSON.stringify([
            tab.title, tab.url, tab.favIconUrl, tab.active, tab.pinned, tab.audible,
            tab.mutedInfo?.muted ?? false, this.isOwnTab(tab.id)
        ]);
    }

    private getTabRow(tab: TabInfo): HTMLElement {
        const signature = this.rowSignature(tab);
        let row = this.tabRows.get(tab.id);
        if (!row || row.signature !== signature) {
            row = { signature, element: this.createTabElement(tab) };
            this.tabRows.set(tab.id, row);
        }
        this.syncRowSelection(row.element, tab.id);
        return row.element;
    }

    private syncRowSelection(row: HTMLElement, tabId: number): void {
        const selected = this.selectedTabs.has(tabId);
        row.classList.toggle('selected', selected);
        (row.querySelector('.tab-checkbox') as HTMLInputElement).checked = selected;
    }

    // Applies a selection change to the rows already on screen, without
    // rebuilding them.
    private renderSelection(): void {
        this.elements.tabsContainer.querySelectorAll<HTMLElement>('.tab-item').forEach(row => {
            this.syncRowSelection(row, Number(row.dataset.tabId));
        });
        this.updateGlobalActions();
        this.updateTabCount();
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
            const groupsById = new Map(this.tabGroups.map(group => [group.id, group]));
            const ungrouped: TabInfo[] = [];
            const byGroup = new Map<number, TabInfo[]>();
            tabs.forEach(tab => {
                const group = tab.groupId && tab.groupId !== -1
                    ? groupsById.get(tab.groupId)
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
            const groupBuckets = Array.from(byGroup.entries()).map(([groupId, groupTabs]) => {
                const chromeGroup = groupsById.get(groupId)!;
                return {
                    label: chromeGroup.title || `Group ${chromeGroup.id}`,
                    tabs: groupTabs,
                    chromeGroup
                };
            });
            return buckets.concat(groupBuckets.sort(TabManager.compareBuckets));
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
            .map(([domain, domainTabs]) => ({ label: domain, tabs: domainTabs }))
            .sort(TabManager.compareBuckets);
    }

    // Largest first; ties broken by label (then group id) so that sections
    // of equal size do not swap places from one render to the next.
    private static compareBuckets(a: TabBucket, b: TabBucket): number {
        return b.tabs.length - a.tabs.length
            || a.label.localeCompare(b.label)
            || (a.chromeGroup?.id ?? 0) - (b.chromeGroup?.id ?? 0);
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
        closeAllBtn.addEventListener('click', () => this.closeTabGroup(groupKey, tabs));
        actions.appendChild(closeAllBtn);
        
        header.appendChild(actions);
        groupElement.appendChild(header);

        // Group tabs
        tabs.forEach(tab => {
            groupElement.appendChild(this.getTabRow(tab));
        });

        return groupElement;
    }

    private createTabElement(tab: TabInfo): HTMLElement {
        const tabElement = document.createElement('div');
        tabElement.className = `tab-item ${tab.active ? 'active' : ''} ${tab.pinned ? 'pinned' : ''} ${tab.audible ? 'audible' : ''}`;
        tabElement.dataset.tabId = tab.id.toString();

        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tab-checkbox';
        // Selection state is applied by syncRowSelection so rows can be reused.
        checkbox.setAttribute('aria-label', `Select ${tab.title}`);
        if (this.isOwnTab(tab.id)) {
            checkbox.disabled = true;
            checkbox.setAttribute('aria-label', 'This tab (Tabularasa) cannot be selected');
        }
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
        if (this.isOwnTab(tab.id)) {
            // Visible explanation for the disabled checkbox and for bulk
            // actions skipping this row.
            const ownBadge = document.createElement('span');
            ownBadge.className = 'tab-own-badge';
            ownBadge.textContent = 'This tab';
            content.appendChild(ownBadge);
        }
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
        openBtn.disabled = this.restoringSession;
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
        // The query takes effect at once, so Select All and the "hidden by
        // filter" checks never act on an older query than the box shows;
        // only the rebuild waits for typing to pause.
        this.searchQuery = this.elements.searchInput.value.trim();
        if (this.searchTimer !== null) {
            clearTimeout(this.searchTimer);
        }
        this.searchTimer = setTimeout(() => {
            this.searchTimer = null;
            this.render();
        }, TabManager.SEARCH_DELAY_MS);
    }

    private clearSearch(): void {
        if (this.searchTimer !== null) {
            clearTimeout(this.searchTimer);
            this.searchTimer = null;
        }
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

    private showSessionView(): void {
        this.elements.sessionView.classList.add('active');
        this.elements.tabView.classList.remove('active');
    }

    private toggleTabSelection(tabId: number): void {
        if (this.isOwnTab(tabId)) {
            return;
        }
        if (this.selectedTabs.has(tabId)) {
            this.selectedTabs.delete(tabId);
        } else {
            this.selectedTabs.add(tabId);
        }
        this.renderSelection();
    }

    private selectAllTabs(): void {
        const filteredTabs = this.getFilteredTabs();
        this.selectTabs(filteredTabs);
        this.renderSelection();
    }

    private selectTabs(tabs: TabInfo[]): void {
        tabs.forEach(tab => {
            if (!this.isOwnTab(tab.id)) {
                this.selectedTabs.add(tab.id);
            }
        });
    }

    private deselectAllTabs(): void {
        this.selectedTabs.clear();
        this.renderSelection();
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
        const hiddenCount = this.countHidden(Array.from(this.selectedTabs));
        this.elements.selectedCount.textContent = hiddenCount > 0
            ? `${selectedCount} selected (${hiddenCount} hidden by filter)`
            : `${selectedCount} selected`;
    }

    // Number of the given tabs that the current search/filter keeps off screen.
    private countHidden(tabIds: number[]): number {
        const visible = new Set(this.getFilteredTabs().map(tab => tab.id));
        return tabIds.filter(tabId => !visible.has(tabId)).length;
    }

    private plural(count: number, noun: string): string {
        return `${count} ${noun}${count === 1 ? '' : 's'}`;
    }

    /**
     * Gate for every bulk close. Asks before a large close, or one that
     * includes tabs the user cannot currently see; small, fully visible
     * closes go ahead because they can be undone. Returns the tabs to close,
     * which is empty when the user declined.
     */
    private async confirmClose(tabs: TabInfo[]): Promise<TabInfo[]> {
        const hiddenCount = this.countHidden(tabs.map(tab => tab.id));
        if (tabs.length >= TabManager.CONFIRM_CLOSE_THRESHOLD || hiddenCount > 0) {
            let question = `Close ${this.plural(tabs.length, 'tab')}?`;
            if (hiddenCount > 0) {
                question += `\n\n${hiddenCount} of them ${hiddenCount === 1 ? 'is' : 'are'} hidden by the current search or filter.`;
            }
            if (!window.confirm(question)) {
                // Also reached, silently, if the user told Chrome to stop
                // this page from showing dialogs; say that nothing happened.
                this.showStatusMessage('Nothing was closed');
                return [];
            }
        }

        // confirm() blocks this page, so tabs may have closed while it was
        // up. tabs.remove rejects part-way on a stale id; drop those first.
        const open = new Set((await chrome.tabs.query({})).map(tab => tab.id));
        return tabs.filter(tab => open.has(tab.id));
    }

    /**
     * Shows a status message with an Undo button that reopens the given
     * tabs. Best effort: it reopens URLs at their old position, so page
     * state, history and group membership are not recovered.
     */
    private offerUndo(message: string, closedTabs: TabInfo[]): void {
        if (!closedTabs.some(tab => tab.url)) {
            this.showStatusMessage(message);
            return;
        }
        this.showStatusMessage(message, 'success', {
            label: 'Undo',
            handler: () => this.reopenTabs(closedTabs)
        });
    }

    private async reopenTabs(closedTabs: TabInfo[]): Promise<void> {
        let reopened = 0;
        // A window that closed with its last tab is recreated once and its
        // remaining tabs follow it there.
        const replacementWindows = new Map<number, number>();
        // Ascending index order keeps each saved index valid as tabs return.
        const ordered = closedTabs
            .filter(tab => tab.url)
            .sort((a, b) => a.windowId - b.windowId || a.index - b.index);

        for (const tab of ordered) {
            const properties = { url: tab.url, pinned: tab.pinned, active: false };
            try {
                const replacement = replacementWindows.get(tab.windowId);
                if (replacement !== undefined) {
                    await chrome.tabs.create({ ...properties, windowId: replacement });
                } else {
                    try {
                        await chrome.tabs.create({ ...properties, windowId: tab.windowId, index: tab.index });
                    } catch {
                        const newWindow = await chrome.windows.create({ url: tab.url, focused: false });
                        replacementWindows.set(tab.windowId, newWindow.id!);
                        const newTabId = newWindow.tabs?.[0]?.id;
                        if (tab.pinned && newTabId !== undefined) {
                            await chrome.tabs.update(newTabId, { pinned: true });
                        }
                    }
                }
                reopened++;
            } catch (error) {
                console.warn(`Could not reopen ${tab.url}:`, error);
            }
        }

        if (reopened === closedTabs.length) {
            this.showStatusMessage(`${this.plural(reopened, 'tab')} reopened`);
        } else {
            this.showStatusMessage(`${reopened} of ${this.plural(closedTabs.length, 'tab')} reopened`, 'warning');
        }

        await this.refreshSafely();
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
            const closedTabs = this.tabs.filter(tab => tab.id === tabId);
            await chrome.tabs.remove(tabId);
            this.selectedTabs.delete(tabId);
            this.offerUndo('Tab closed', closedTabs);
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
            const tabs = await this.confirmClose(this.tabs.filter(tab => this.selectedTabs.has(tab.id)));
            if (tabs.length === 0) {return;}

            await chrome.tabs.remove(tabs.map(tab => tab.id));
            this.selectedTabs.clear();
            this.offerUndo(`${this.plural(tabs.length, 'tab')} closed`, tabs);
            // Refresh the view immediately after closing
            await this.refreshTabs();
        } catch (error) {
            console.error('Error closing selected tabs:', error);
            this.showStatusMessage('Error closing tabs', 'error');
        }
    }

    private async closeTabGroup(groupKey: string, bucketTabs: TabInfo[]): Promise<void> {
        const closable = bucketTabs.filter(tab => !this.isOwnTab(tab.id));
        if (closable.length === 0) {
            this.showStatusMessage(`No tabs to close in ${groupKey}`);
            return;
        }

        try {
            // Empty when declined, or when every tab closed in the meantime;
            // fall through to the refresh either way.
            const tabs = await this.confirmClose(closable);
            if (tabs.length > 0) {
                await chrome.tabs.remove(tabs.map(tab => tab.id));
                tabs.forEach(tab => this.selectedTabs.delete(tab.id));
                this.offerUndo(`${this.plural(tabs.length, 'tab')} closed from ${groupKey}`, tabs);
            }
        } catch (error) {
            // A stale id rejects the call after some of the tabs have
            // already been closed, so this may be a partial close.
            console.error('Error closing tab group:', error);
            this.showStatusMessage(`Some tabs in ${groupKey} could not be closed`, 'warning');
        }

        // Refresh on failure too, so the list shows what actually closed.
        try {
            await this.refreshTabs();
        } catch (error) {
            console.error('Error refreshing tabs:', error);
            this.showStatusMessage('Error refreshing tabs', 'error');
        }
    }

    private selectAllTabsInGroup(tabs: TabInfo[]): void {
        this.selectTabs(tabs);
        this.renderSelection();
    }

    private unselectAllTabsInGroup(tabs: TabInfo[]): void {
        tabs.forEach(tab => this.selectedTabs.delete(tab.id));
        this.renderSelection();
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

    // Selected tabs ordered by window, then position in the tab strip, so
    // bulk operations keep each window's left-to-right order rather than
    // the order the boxes were ticked in.
    private getSelectedTabs(): TabInfo[] {
        return this.tabs
            .filter(tab => this.selectedTabs.has(tab.id))
            .sort((a, b) => a.windowId - b.windowId || a.index - b.index);
    }

    // Tabs of popup, app and devtools windows cannot be grouped or moved.
    // this.windows holds windows of every type, so a window missing from it
    // is one that opened since the last refresh; assume normal and let
    // Chrome reject it otherwise.
    private isInNormalWindow(tab: TabInfo): boolean {
        const window = this.windows.find(w => w.id === tab.windowId);
        return (window?.type ?? 'normal') === 'normal';
    }

    // A refresh that reports its own failure. Used where a bulk operation
    // may have rejected part-way: the list must show what really happened
    // rather than stay as it was, and must not mask the operation's error.
    private async refreshSafely(): Promise<void> {
        try {
            await this.refreshTabs();
        } catch (error) {
            console.error('Error refreshing tabs:', error);
        }
    }

    private async moveToNewWindow(): Promise<void> {
        if (this.selectedTabs.size === 0) {return;}

        const selected = this.getSelectedTabs();
        const movable = selected.filter(tab => this.isInNormalWindow(tab));
        const leftOut = selected.length - movable.length;
        if (movable.length === 0) {
            this.showStatusMessage('Tabs of popup and app windows cannot be moved', 'error');
            return;
        }

        try {
            const [first, ...rest] = movable.map(tab => tab.id);
            const newWindow = await chrome.windows.create({ tabId: first });
            if (rest.length > 0) {
                await chrome.tabs.move(rest, { windowId: newWindow.id!, index: -1 });
            }

            this.selectedTabs.clear();
            const moved = `${this.plural(movable.length, 'tab')} moved to new window`;
            if (leftOut === 0) {
                this.showStatusMessage(moved);
            } else {
                this.showStatusMessage(`${moved}; ${this.plural(leftOut, 'tab')} in popup or app windows left in place`, 'warning');
            }
            await this.refreshTabs();
        } catch (error) {
            // The new window may already exist with some of the tabs in it.
            console.error('Error moving tabs to new window:', error);
            this.showStatusMessage('Not every tab could be moved to the new window', 'error');
            await this.refreshSafely();
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

            // Work on the TabInfo objects captured here, never on this.tabs:
            // each removal triggers a refresh that replaces this.tabs while
            // the loop below is still awaiting.
            const duplicates: TabInfo[] = [];
            urlGroups.forEach(tabGroup => {
                if (tabGroup.length > 1) {
                    tabGroup.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
                    const keep = tabGroup.find(tab => this.isOwnTab(tab.id)) ?? tabGroup[0];
                    duplicates.push(...tabGroup.filter(tab => tab !== keep));
                }
            });

            if (duplicates.length === 0) {
                this.showStatusMessage('No duplicate tabs found');
                return;
            }

            const tabsToClose = await this.confirmClose(duplicates);
            if (tabsToClose.length === 0) {return;}

            // Close tabs individually to handle cases where some tabs may already be closed
            const closedTabs: TabInfo[] = [];
            for (const tab of tabsToClose) {
                try {
                    await chrome.tabs.remove(tab.id);
                    closedTabs.push(tab);
                } catch (error) {
                    // Tab may already be closed, continue with others
                    console.warn(`Tab ${tab.id} could not be closed (may already be closed):`, error);
                }
            }

            if (closedTabs.length > 0) {
                this.offerUndo(`${this.plural(closedTabs.length, 'duplicate tab')} closed`, closedTabs);
                // Refresh the tab list to update the UI
                await this.refreshTabs();
            } else {
                this.showStatusMessage('No duplicate tabs could be closed');
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

        // Grouping a pinned tab unpins it, and tabs outside normal windows
        // cannot be grouped at all, so both are left out.
        const selected = this.getSelectedTabs();
        const groupable = selected.filter(tab => !tab.pinned && this.isInNormalWindow(tab));
        const leftOut = selected.length - groupable.length;
        if (groupable.length === 0) {
            this.showStatusMessage('Pinned tabs and tabs of popup or app windows cannot be grouped', 'error');
            return;
        }

        // A group lives in one window. Without an explicit window Chrome
        // creates it in the current one, dragging every selected tab into
        // the manager's window, so make one group per window, in place.
        const byWindow = new Map<number, number[]>();
        groupable.forEach(tab => {
            byWindow.set(tab.windowId, [...(byWindow.get(tab.windowId) ?? []), tab.id]);
        });

        let groupsCreated = 0;
        const groupedTabIds: number[] = [];
        for (const [windowId, tabIds] of byWindow) {
            let groupId: number;
            try {
                groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
            } catch (error) {
                console.error(`Error creating tab group in window ${windowId}:`, error);
                continue;
            }
            groupsCreated++;
            groupedTabIds.push(...tabIds);

            try {
                await chrome.tabGroups.update(groupId, {
                    title: groupName || undefined,
                    color: groupColor
                });
            } catch (error) {
                // The tabs are grouped all the same, only unnamed.
                console.warn(`Could not name the tab group in window ${windowId}:`, error);
            }
        }

        if (groupsCreated === 0) {
            this.showStatusMessage('Error creating tab group', 'error');
            await this.refreshSafely();
            return;
        }

        // Keep what was not grouped selected, so it can be retried or
        // handled another way.
        groupedTabIds.forEach(tabId => this.selectedTabs.delete(tabId));
        this.hideGroupModal();

        const name = groupName || 'Untitled';
        const notes: string[] = [];
        if (leftOut > 0) {
            notes.push(`${this.plural(leftOut, 'pinned or app-window tab')} left out`);
        }
        const failed = groupable.length - groupedTabIds.length;
        if (failed > 0) {
            notes.push(`${this.plural(failed, 'tab')} could not be grouped`);
        }
        const created = groupsCreated === 1
            ? `Created group ${name} with ${this.plural(groupedTabIds.length, 'tab')}`
            : `Created ${groupsCreated} groups named ${name} (one per window) with ${this.plural(groupedTabIds.length, 'tab')}`;
        this.showStatusMessage([created, ...notes].join('; '), notes.length > 0 ? 'warning' : 'success');
        await this.refreshSafely();
    }

    private async ungroupSelectedTabs(): Promise<void> {
        if (this.selectedTabs.size === 0) {return;}

        try {
            const tabIds = Array.from(this.selectedTabs);
            await chrome.tabs.ungroup(tabIds);
            this.selectedTabs.clear();
            this.showStatusMessage(`${this.plural(tabIds.length, 'tab')} ungrouped`);
            await this.refreshTabs();
        } catch (error) {
            console.error('Error ungrouping tabs:', error);
            this.showStatusMessage('Error ungrouping tabs', 'error');
            await this.refreshSafely();
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
            // The form lives inside the session view, but the button that
            // opens it is in the tab view, so switch views first; otherwise
            // the form is revealed inside a display:none container.
            this.showSessionView();
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

    // The form is only ever opened from the tab view, so cancelling returns
    // there. A successful save stays on the session view to show the result.
    private cancelSessionSave(): void {
        this.hideSaveSessionForm();
        this.showTabView();
    }

    // Returns the URL in its parsed, normalised form if a session may hold
    // it, otherwise null. Callers store and open the returned string rather
    // than the input, so what was checked is exactly what gets opened.
    private restorableUrl(url: string): string | null {
        try {
            const parsed = new URL(url);
            return TabManager.RESTORABLE_PROTOCOLS.has(parsed.protocol) ? parsed.href : null;
        } catch {
            return null;
        }
    }

    private async snapshotWindow(window: chrome.windows.Window): Promise<SessionInfo['windows'][number]> {
        const groups = await chrome.tabGroups.query({ windowId: window.id });
        return {
            id: window.id!,
            tabs: (window.tabs || [])
                // A tab that is still loading has no url yet, only pendingUrl.
                .map(tab => ({ tab, url: this.restorableUrl(tab.url || tab.pendingUrl || '') }))
                .filter((entry): entry is { tab: chrome.tabs.Tab; url: string } => entry.url !== null)
                .map(({ tab, url }) => ({
                    url,
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
        };
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

            // "All windows" never includes incognito windows (see loadTabs).
            const windows = saveType === 'current'
                ? [await chrome.windows.getCurrent({ populate: true })]
                : (await chrome.windows.getAll({ populate: true }))
                    .filter(w => w.type === 'normal' && !w.incognito);

            let leftOut = 0;
            for (const window of windows) {
                const snapshot = await this.snapshotWindow(window);
                // This page is never saved, but that is not worth a warning.
                const candidates = (window.tabs || []).filter(tab => tab.id === undefined || !this.isOwnTab(tab.id));
                leftOut += candidates.length - snapshot.tabs.length;
                if (snapshot.tabs.length > 0) {
                    session.windows.push(snapshot);
                }
            }

            if (session.windows.length === 0) {
                this.showStatusMessage('No tabs that can be saved', 'warning');
                return;
            }

            await this.updateStoredSessions(sessions => [...sessions, session]);

            this.hideSaveSessionForm();
            this.renderSessions();
            if (leftOut === 0) {
                this.showStatusMessage('Session saved successfully');
            } else {
                // Browser and extension pages (chrome://, this page, ...)
                // cannot be reopened by an extension.
                this.showStatusMessage(
                    `Session saved; ${leftOut} ${leftOut === 1 ? 'tab' : 'tabs'} that cannot be restored ${leftOut === 1 ? 'was' : 'were'} left out`,
                    'warning'
                );
            }
        } catch (error) {
            console.error('Error saving session:', error);
            this.showStatusMessage(
                this.isQuotaError(error)
                    ? 'Storage is full: delete sessions you no longer need, then save again'
                    : 'Error saving session',
                'error'
            );
        }
    }

    async openSession(sessionId: string): Promise<void> {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) {return;}

        // Restoring awaits one Chrome call per tab, so a second click on
        // Open would otherwise restore the session twice.
        if (this.restoringSession) {
            this.showStatusMessage('A session is already being restored', 'warning');
            return;
        }

        this.restoringSession = true;
        this.renderSessions();
        try {
            let total = 0;
            let restored = 0;
            for (const windowData of session.windows) {
                total += windowData.tabs.length;
                restored += await this.restoreWindow(windowData);
            }

            if (restored === 0) {
                this.showStatusMessage(`Session "${session.name}": no tabs could be restored`, 'error');
            } else if (restored === total) {
                this.showStatusMessage(`Session "${session.name}" opened`);
            } else {
                this.showStatusMessage(
                    `Session "${session.name}": restored ${restored} of ${total} tabs (${total - restored} skipped)`,
                    'warning'
                );
            }
        } catch (error) {
            console.error('Error opening session:', error);
            this.showStatusMessage('Error opening session', 'error');
        } finally {
            this.restoringSession = false;
            this.renderSessions();
        }
    }

    /**
     * Recreates one saved window and returns how many of its tabs were
     * restored. Tabs are created in saved order (Chrome keeps pinned tabs
     * first and group members adjacent, so appending preserves the layout)
     * and each failure is contained to the tab or group it concerns.
     */
    private async restoreWindow(windowData: SessionInfo['windows'][number]): Promise<number> {
        // Sessions saved by older versions may hold URLs that are no longer
        // accepted, so filter (and normalise) here as well as when saving.
        const tabs = windowData.tabs
            .map(tab => ({ ...tab, url: this.restorableUrl(tab.url) }))
            .filter((tab): tab is typeof tab & { url: string } => tab.url !== null);

        const restoredTabIds = new Map<typeof tabs[number], number>();

        // The window comes with its first tab. Chrome can refuse an allowed
        // URL (file: without "Allow access to file URLs", enterprise
        // blocklists), so fall through to the next tab rather than losing
        // the whole window to its first entry.
        let windowId: number | undefined;
        let firstIndex = 0;
        for (; firstIndex < tabs.length && windowId === undefined; firstIndex++) {
            const first = tabs[firstIndex];
            try {
                const newWindow = await chrome.windows.create({ url: first.url, focused: false });
                windowId = newWindow.id!;
                const firstTabId = newWindow.tabs?.[0]?.id;
                if (firstTabId === undefined) {continue;}

                restoredTabIds.set(first, firstTabId);
                if (first.pinned || first.muted) {
                    // windows.create cannot set these, so apply them afterwards.
                    await chrome.tabs.update(firstTabId, { pinned: first.pinned, muted: first.muted });
                }
            } catch (error) {
                console.warn(`Could not restore ${first.url}:`, error);
            }
        }
        if (windowId === undefined) {return 0;}

        for (const tab of tabs.slice(firstIndex)) {
            try {
                const newTab = await chrome.tabs.create({
                    windowId,
                    url: tab.url,
                    pinned: tab.pinned,
                    active: false
                });
                restoredTabIds.set(tab, newTab.id!);
                if (tab.muted) {
                    await chrome.tabs.update(newTab.id!, { muted: true });
                }
            } catch (error) {
                console.warn(`Could not restore ${tab.url}:`, error);
            }
        }

        for (const groupData of windowData.groups) {
            const tabIds = tabs
                .filter(tab => tab.groupId === groupData.id && restoredTabIds.has(tab))
                .map(tab => restoredTabIds.get(tab)!);
            if (tabIds.length === 0) {continue;}

            try {
                // Without an explicit windowId the group is created in the
                // current window, which would pull the tabs into the
                // manager's window.
                const newGroupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
                await chrome.tabGroups.update(newGroupId, {
                    title: groupData.title,
                    color: groupData.color
                });
            } catch (error) {
                console.warn(`Could not restore group ${groupData.title || groupData.id}:`, error);
            }
        }

        return restoredTabIds.size;
    }

    async deleteSession(sessionId: string): Promise<void> {
        try {
            const sessionIndex = this.sessions.findIndex(s => s.id === sessionId);
            if (sessionIndex === -1) {return;}

            const session = this.sessions[sessionIndex];
            // Deleting a session cannot be undone.
            if (!window.confirm(`Delete session "${session.name}"? This cannot be undone.`)) {
                return;
            }
            await this.updateStoredSessions(sessions => sessions.filter(s => s.id !== sessionId));

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

    private showStatusMessage(
        message: string,
        type: 'success' | 'error' | 'warning' = 'success',
        action?: { label: string; handler: () => void }
    ): void {
        const messageElement = this.elements.statusMessage.querySelector('.message-text') as HTMLElement;
        messageElement.textContent = message;
        this.elements.statusMessage.className = `status-message ${type}`;
        this.elements.statusMessage.classList.remove('hidden');

        // The action belongs to this message only: replace the button's
        // handler each time so a stale Undo can never outlive its message.
        const actionButton = this.elements.statusMessage.querySelector('.status-action') as HTMLButtonElement;
        actionButton.classList.toggle('hidden', !action);
        actionButton.textContent = action?.label ?? '';
        actionButton.onclick = action
            ? (): void => {
                this.hideStatusMessage();
                // The button just disappeared; keep keyboard focus in the page.
                this.elements.tabsContainer.focus();
                action.handler();
            }
            : null;

        this.statusMessageDuration = action ? TabManager.UNDO_DURATION_MS : TabManager.STATUS_DURATION_MS;
        this.startStatusMessageTimer();
    }

    private startStatusMessageTimer(): void {
        // Reset the hide timer so an earlier message's timeout doesn't
        // dismiss this one prematurely.
        if (this.statusMessageTimer !== null) {
            clearTimeout(this.statusMessageTimer);
        }
        this.statusMessageTimer = setTimeout(() => {
            this.hideStatusMessage();
        }, this.statusMessageDuration);
    }

    // The countdown stops while the pointer or keyboard focus is on the
    // message, so there is always time to reach Undo (WCAG 2.2.1).
    private pauseStatusMessageTimer(): void {
        if (this.statusMessageTimer !== null) {
            clearTimeout(this.statusMessageTimer);
            this.statusMessageTimer = null;
        }
    }

    private hideStatusMessage(): void {
        this.elements.statusMessage.classList.add('hidden');
        // A hidden message must not leave a live Undo behind.
        (this.elements.statusMessage.querySelector('.status-action') as HTMLButtonElement).onclick = null;
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