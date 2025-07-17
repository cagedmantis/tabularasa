/**
 * Tabula Rasa - Chrome Tab Manager
 * Main popup functionality
 */

// Global state
let state = {
    tabs: [],
    windows: [],
    sessions: [],
    selectedTabs: new Set(),
    currentView: 'windows', // 'windows' or 'domains'
    searchQuery: '',
    loading: false
};

// DOM elements
const elements = {
    searchInput: null,
    tabsContainer: null,
    viewToggle: null,
    sessionsToggle: null,
    tabView: null,
    sessionView: null,
    loadingIndicator: null,
    statusMessage: null,
    modal: null
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    initializeElements();
    setupEventListeners();
    await loadInitialData();
    render();
});

/**
 * Initialize DOM element references
 */
function initializeElements() {
    elements.searchInput = document.getElementById('search-input');
    elements.tabsContainer = document.getElementById('tabs-container');
    elements.viewToggle = document.getElementById('view-toggle');
    elements.sessionsToggle = document.getElementById('sessions-toggle');
    elements.tabView = document.getElementById('tab-view');
    elements.sessionView = document.getElementById('session-view');
    elements.loadingIndicator = document.getElementById('loading');
    elements.statusMessage = document.getElementById('status-message');
    elements.modal = document.getElementById('move-window-modal');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Search functionality
    elements.searchInput.addEventListener('input', handleSearch);
    document.getElementById('clear-search').addEventListener('click', clearSearch);

    // View toggles
    elements.viewToggle.addEventListener('click', toggleView);
    elements.sessionsToggle.addEventListener('click', toggleSessionView);
    document.getElementById('back-to-tabs').addEventListener('click', showTabView);

    // Global actions
    document.getElementById('select-all').addEventListener('click', selectAllTabs);
    document.getElementById('deselect-all').addEventListener('click', deselectAllTabs);
    document.getElementById('move-to-new-window').addEventListener('click', moveToNewWindow);
    document.getElementById('move-to-existing-window').addEventListener('click', showMoveToWindowModal);
    document.getElementById('close-selected').addEventListener('click', closeSelectedTabs);
    document.getElementById('close-duplicates').addEventListener('click', closeDuplicateTabs);
    document.getElementById('new-tab').addEventListener('click', createNewTab);

    // Session management
    document.getElementById('save-session').addEventListener('click', showSaveSessionForm);
    document.getElementById('save-session-confirm').addEventListener('click', saveSession);
    document.getElementById('cancel-session-save').addEventListener('click', hideSaveSessionForm);

    // Modal handlers
    document.getElementById('close-modal').addEventListener('click', hideModal);
    document.getElementById('confirm-move').addEventListener('click', confirmMoveToWindow);
    document.getElementById('cancel-move').addEventListener('click', hideModal);

    // Status message close
    document.querySelector('.close-status').addEventListener('click', hideStatusMessage);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Load initial data
 */
async function loadInitialData() {
    showLoading(true);
    try {
        await Promise.all([
            loadTabs(),
            loadSessions()
        ]);
    } catch (error) {
        console.error('Error loading initial data:', error);
        showStatusMessage('Error loading data', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Load tabs from Chrome API
 */
async function loadTabs() {
    try {
        const [tabs, windows] = await Promise.all([
            chrome.tabs.query({}),
            chrome.windows.getAll({ populate: false })
        ]);

        state.tabs = tabs;
        state.windows = windows;
    } catch (error) {
        console.error('Error loading tabs:', error);
        throw error;
    }
}

/**
 * Load saved sessions from storage
 */
async function loadSessions() {
    try {
        const result = await chrome.storage.local.get(['sessions']);
        state.sessions = result.sessions || [];
    } catch (error) {
        console.error('Error loading sessions:', error);
        throw error;
    }
}

/**
 * Main render function
 */
function render() {
    if (state.loading) {
        showLoading(true);
        return;
    }

    renderTabs();
    renderSessions();
    updateGlobalActions();
    updateViewToggle();
}

/**
 * Render tabs based on current view and search
 */
function renderTabs() {
    const filteredTabs = getFilteredTabs();
    const groupedTabs = groupTabs(filteredTabs);

    elements.tabsContainer.innerHTML = '';

    if (filteredTabs.length === 0) {
        renderEmptyState();
        return;
    }

    Object.entries(groupedTabs).forEach(([groupKey, tabs]) => {
        const groupElement = createTabGroup(groupKey, tabs);
        elements.tabsContainer.appendChild(groupElement);
    });
}

/**
 * Get filtered tabs based on search query
 */
function getFilteredTabs() {
    if (!state.searchQuery) {
        return state.tabs;
    }

    const query = state.searchQuery.toLowerCase();
    return state.tabs.filter(tab => 
        tab.title.toLowerCase().includes(query) || 
        tab.url.toLowerCase().includes(query)
    );
}

/**
 * Group tabs by current view (windows or domains)
 */
function groupTabs(tabs) {
    const groups = {};

    tabs.forEach(tab => {
        let groupKey;
        
        if (state.currentView === 'windows') {
            const window = state.windows.find(w => w.id === tab.windowId);
            groupKey = `Window ${tab.windowId}`;
        } else {
            // Group by domain
            try {
                const url = new URL(tab.url);
                groupKey = url.hostname || 'Unknown';
            } catch {
                groupKey = 'Unknown';
            }
        }

        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(tab);
    });

    return groups;
}

/**
 * Create tab group element
 */
function createTabGroup(groupKey, tabs) {
    const groupElement = document.createElement('div');
    groupElement.className = 'tab-group';

    // Group header
    const header = document.createElement('div');
    header.className = 'tab-group-header';
    header.innerHTML = `
        <span class="tab-group-title">${escapeHtml(groupKey)}</span>
        <span class="tab-group-count">${tabs.length} tabs</span>
        <div class="tab-group-actions">
            <button class="btn btn-small btn-danger" onclick="closeTabGroup('${groupKey}')">
                Close All
            </button>
        </div>
    `;

    groupElement.appendChild(header);

    // Group tabs
    tabs.forEach(tab => {
        const tabElement = createTabElement(tab);
        groupElement.appendChild(tabElement);
    });

    return groupElement;
}

/**
 * Create individual tab element
 */
function createTabElement(tab) {
    const tabElement = document.createElement('div');
    tabElement.className = `tab-item ${tab.active ? 'active' : ''} ${state.selectedTabs.has(tab.id) ? 'selected' : ''}`;
    tabElement.dataset.tabId = tab.id;

    const favicon = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
    
    tabElement.innerHTML = `
        <input type="checkbox" class="tab-checkbox" ${state.selectedTabs.has(tab.id) ? 'checked' : ''}>
        <img src="${favicon}" class="tab-favicon" alt="Favicon">
        <div class="tab-content">
            <div class="tab-title">${escapeHtml(tab.title)}</div>
            <div class="tab-url">${escapeHtml(tab.url)}</div>
        </div>
        <div class="tab-actions">
            <button class="tab-action ${tab.pinned ? 'pinned' : ''}" title="${tab.pinned ? 'Unpin' : 'Pin'} tab">
                ${tab.pinned ? '📌' : '📍'}
            </button>
            <button class="tab-action ${tab.mutedInfo?.muted ? 'muted' : ''}" title="${tab.mutedInfo?.muted ? 'Unmute' : 'Mute'} tab">
                ${tab.mutedInfo?.muted ? '🔇' : '🔊'}
            </button>
            <button class="tab-action close" title="Close tab">
                ✕
            </button>
        </div>
    `;

    setupTabElementListeners(tabElement, tab);
    return tabElement;
}

/**
 * Setup event listeners for tab element
 */
function setupTabElementListeners(tabElement, tab) {
    const checkbox = tabElement.querySelector('.tab-checkbox');
    const content = tabElement.querySelector('.tab-content');
    const pinBtn = tabElement.querySelector('.tab-action:nth-child(1)');
    const muteBtn = tabElement.querySelector('.tab-action:nth-child(2)');
    const closeBtn = tabElement.querySelector('.tab-action.close');

    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        toggleTabSelection(tab.id);
    });

    content.addEventListener('click', (e) => {
        e.stopPropagation();
        switchToTab(tab.id);
    });

    pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTabPin(tab.id);
    });

    muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTabMute(tab.id);
    });

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id);
    });
}

/**
 * Render empty state
 */
function renderEmptyState() {
    elements.tabsContainer.innerHTML = `
        <div class="empty-state">
            <span class="icon">🔍</span>
            <h3>No tabs found</h3>
            <p>Try adjusting your search query or create a new tab.</p>
        </div>
    `;
}

/**
 * Render sessions list
 */
function renderSessions() {
    const sessionsList = document.getElementById('sessions-list');
    
    if (state.sessions.length === 0) {
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

    state.sessions.forEach(session => {
        const sessionElement = createSessionElement(session);
        sessionsList.appendChild(sessionElement);
    });
}

/**
 * Create session element
 */
function createSessionElement(session) {
    const sessionElement = document.createElement('div');
    sessionElement.className = 'session-item';
    sessionElement.dataset.sessionId = session.id;

    const tabCount = session.windows.reduce((count, window) => count + window.tabs.length, 0);
    const windowCount = session.windows.length;

    sessionElement.innerHTML = `
        <div class="session-info">
            <div class="session-name">${escapeHtml(session.name)}</div>
            <div class="session-details">
                ${tabCount} tabs • ${windowCount} windows • ${new Date(session.created).toLocaleDateString()}
            </div>
        </div>
        <div class="session-actions">
            <button class="btn btn-small btn-primary" onclick="openSession('${session.id}')">
                Open
            </button>
            <button class="btn btn-small btn-danger" onclick="deleteSession('${session.id}')">
                Delete
            </button>
        </div>
    `;

    return sessionElement;
}

/**
 * Event Handlers
 */

function handleSearch() {
    state.searchQuery = elements.searchInput.value.trim();
    render();
}

function clearSearch() {
    elements.searchInput.value = '';
    state.searchQuery = '';
    render();
}

function toggleView() {
    state.currentView = state.currentView === 'windows' ? 'domains' : 'windows';
    render();
}

function updateViewToggle() {
    const icon = state.currentView === 'windows' ? '🪟' : '🌐';
    const text = state.currentView === 'windows' ? 'Windows' : 'Domains';
    
    elements.viewToggle.innerHTML = `
        <span class="icon">${icon}</span>
        <span class="text">${text}</span>
    `;
}

function toggleSessionView() {
    elements.tabView.classList.toggle('active');
    elements.sessionView.classList.toggle('active');
}

function showTabView() {
    elements.tabView.classList.add('active');
    elements.sessionView.classList.remove('active');
}

function toggleTabSelection(tabId) {
    if (state.selectedTabs.has(tabId)) {
        state.selectedTabs.delete(tabId);
    } else {
        state.selectedTabs.add(tabId);
    }
    render();
}

function selectAllTabs() {
    const filteredTabs = getFilteredTabs();
    filteredTabs.forEach(tab => state.selectedTabs.add(tab.id));
    render();
}

function deselectAllTabs() {
    state.selectedTabs.clear();
    render();
}

function updateGlobalActions() {
    const selectedCount = state.selectedTabs.size;
    const moveToNewBtn = document.getElementById('move-to-new-window');
    const moveToExistingBtn = document.getElementById('move-to-existing-window');
    const closeSelectedBtn = document.getElementById('close-selected');

    moveToNewBtn.disabled = selectedCount === 0;
    moveToExistingBtn.disabled = selectedCount === 0;
    closeSelectedBtn.disabled = selectedCount === 0;

    closeSelectedBtn.textContent = selectedCount > 0 ? `Close Selected (${selectedCount})` : 'Close Selected';
}

async function switchToTab(tabId) {
    try {
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
            await chrome.tabs.update(tabId, { active: true });
            await chrome.windows.update(tab.windowId, { focused: true });
            window.close();
        }
    } catch (error) {
        console.error('Error switching to tab:', error);
        showStatusMessage('Error switching to tab', 'error');
    }
}

async function closeTab(tabId) {
    try {
        await chrome.tabs.remove(tabId);
        state.selectedTabs.delete(tabId);
        await loadTabs();
        render();
        showStatusMessage('Tab closed');
    } catch (error) {
        console.error('Error closing tab:', error);
        showStatusMessage('Error closing tab', 'error');
    }
}

async function closeSelectedTabs() {
    if (state.selectedTabs.size === 0) return;

    try {
        const tabIds = Array.from(state.selectedTabs);
        await chrome.tabs.remove(tabIds);
        state.selectedTabs.clear();
        await loadTabs();
        render();
        showStatusMessage(`${tabIds.length} tabs closed`);
    } catch (error) {
        console.error('Error closing selected tabs:', error);
        showStatusMessage('Error closing tabs', 'error');
    }
}

async function closeTabGroup(groupKey) {
    try {
        const filteredTabs = getFilteredTabs();
        const groupedTabs = groupTabs(filteredTabs);
        const tabsToClose = groupedTabs[groupKey];

        if (tabsToClose && tabsToClose.length > 0) {
            const tabIds = tabsToClose.map(tab => tab.id);
            await chrome.tabs.remove(tabIds);
            await loadTabs();
            render();
            showStatusMessage(`${tabIds.length} tabs closed`);
        }
    } catch (error) {
        console.error('Error closing tab group:', error);
        showStatusMessage('Error closing tab group', 'error');
    }
}

async function toggleTabPin(tabId) {
    try {
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
            await chrome.tabs.update(tabId, { pinned: !tab.pinned });
            await loadTabs();
            render();
            showStatusMessage(`Tab ${tab.pinned ? 'unpinned' : 'pinned'}`);
        }
    } catch (error) {
        console.error('Error toggling tab pin:', error);
        showStatusMessage('Error toggling tab pin', 'error');
    }
}

async function toggleTabMute(tabId) {
    try {
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
            const muted = tab.mutedInfo?.muted || false;
            await chrome.tabs.update(tabId, { muted: !muted });
            await loadTabs();
            render();
            showStatusMessage(`Tab ${muted ? 'unmuted' : 'muted'}`);
        }
    } catch (error) {
        console.error('Error toggling tab mute:', error);
        showStatusMessage('Error toggling tab mute', 'error');
    }
}

async function moveToNewWindow() {
    if (state.selectedTabs.size === 0) return;

    try {
        const tabIds = Array.from(state.selectedTabs);
        const firstTabId = tabIds[0];
        
        // Create new window with first tab
        const newWindow = await chrome.windows.create({ tabId: firstTabId });
        
        // Move remaining tabs to new window
        if (tabIds.length > 1) {
            await chrome.tabs.move(tabIds.slice(1), { windowId: newWindow.id, index: -1 });
        }

        state.selectedTabs.clear();
        await loadTabs();
        render();
        showStatusMessage(`${tabIds.length} tabs moved to new window`);
    } catch (error) {
        console.error('Error moving tabs to new window:', error);
        showStatusMessage('Error moving tabs to new window', 'error');
    }
}

async function showMoveToWindowModal() {
    if (state.selectedTabs.size === 0) return;

    const windowList = document.getElementById('window-list');
    windowList.innerHTML = '';

    // Get current window to exclude it or mark it differently
    const currentWindow = await chrome.windows.getCurrent();
    
    state.windows.forEach(window => {
        if (window.type === 'normal') {
            const windowElement = document.createElement('div');
            windowElement.className = 'window-option';
            windowElement.dataset.windowId = window.id;
            
            const isCurrent = window.id === currentWindow.id;
            const windowTabs = state.tabs.filter(tab => tab.windowId === window.id);
            
            windowElement.innerHTML = `
                <div class="window-title">
                    Window ${window.id} ${isCurrent ? '(Current)' : ''}
                </div>
                <div class="window-info">
                    ${windowTabs.length} tabs
                </div>
            `;

            windowElement.addEventListener('click', () => {
                document.querySelectorAll('.window-option').forEach(el => el.classList.remove('selected'));
                windowElement.classList.add('selected');
                document.getElementById('confirm-move').disabled = false;
            });

            windowList.appendChild(windowElement);
        }
    });

    showModal();
}

async function confirmMoveToWindow() {
    const selectedWindow = document.querySelector('.window-option.selected');
    if (!selectedWindow || state.selectedTabs.size === 0) return;

    const windowId = parseInt(selectedWindow.dataset.windowId);
    const tabIds = Array.from(state.selectedTabs);

    try {
        await chrome.tabs.move(tabIds, { windowId: windowId, index: -1 });
        state.selectedTabs.clear();
        await loadTabs();
        render();
        hideModal();
        showStatusMessage(`${tabIds.length} tabs moved to window ${windowId}`);
    } catch (error) {
        console.error('Error moving tabs to window:', error);
        showStatusMessage('Error moving tabs to window', 'error');
    }
}

async function closeDuplicateTabs() {
    try {
        const urlGroups = new Map();
        
        // Group tabs by URL
        state.tabs.forEach(tab => {
            if (tab.url) {
                if (!urlGroups.has(tab.url)) {
                    urlGroups.set(tab.url, []);
                }
                urlGroups.get(tab.url).push(tab);
            }
        });

        const tabsToClose = [];
        
        // Find duplicates (keep the most recently accessed)
        urlGroups.forEach(tabGroup => {
            if (tabGroup.length > 1) {
                // Sort by last accessed time (most recent first)
                tabGroup.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
                // Add all but the first (most recent) to close list
                tabsToClose.push(...tabGroup.slice(1).map(tab => tab.id));
            }
        });

        if (tabsToClose.length > 0) {
            await chrome.tabs.remove(tabsToClose);
            await loadTabs();
            render();
            showStatusMessage(`${tabsToClose.length} duplicate tabs closed`);
        } else {
            showStatusMessage('No duplicate tabs found');
        }
    } catch (error) {
        console.error('Error closing duplicate tabs:', error);
        showStatusMessage('Error closing duplicate tabs', 'error');
    }
}

async function createNewTab() {
    try {
        await chrome.tabs.create({ url: 'chrome://newtab/' });
        window.close();
    } catch (error) {
        console.error('Error creating new tab:', error);
        showStatusMessage('Error creating new tab', 'error');
    }
}

function showSaveSessionForm() {
    const form = document.getElementById('session-save-form');
    form.classList.remove('hidden');
    document.getElementById('session-name').focus();
}

function hideSaveSessionForm() {
    const form = document.getElementById('session-save-form');
    form.classList.add('hidden');
    document.getElementById('session-name').value = '';
}

async function saveSession() {
    const sessionName = document.getElementById('session-name').value.trim();
    const saveType = document.querySelector('input[name="save-type"]:checked').value;

    if (!sessionName) {
        showStatusMessage('Please enter a session name', 'error');
        return;
    }

    try {
        const session = {
            id: Date.now().toString(),
            name: sessionName,
            created: Date.now(),
            windows: []
        };

        if (saveType === 'current') {
            const currentWindow = await chrome.windows.getCurrent({ populate: true });
            session.windows.push({
                id: currentWindow.id,
                tabs: currentWindow.tabs.map(tab => ({
                    url: tab.url,
                    title: tab.title,
                    pinned: tab.pinned,
                    muted: tab.mutedInfo?.muted || false
                }))
            });
        } else {
            const windows = await chrome.windows.getAll({ populate: true });
            session.windows = windows.filter(window => window.type === 'normal').map(window => ({
                id: window.id,
                tabs: window.tabs.map(tab => ({
                    url: tab.url,
                    title: tab.title,
                    pinned: tab.pinned,
                    muted: tab.mutedInfo?.muted || false
                }))
            }));
        }

        state.sessions.push(session);
        await chrome.storage.local.set({ sessions: state.sessions });
        
        hideSaveSessionForm();
        renderSessions();
        showStatusMessage('Session saved successfully');
    } catch (error) {
        console.error('Error saving session:', error);
        showStatusMessage('Error saving session', 'error');
    }
}

async function openSession(sessionId) {
    try {
        const session = state.sessions.find(s => s.id === sessionId);
        if (!session) return;

        for (const windowData of session.windows) {
            const tabs = windowData.tabs.filter(tab => tab.url && !tab.url.startsWith('chrome://'));
            if (tabs.length === 0) continue;

            // Create new window with first tab
            const newWindow = await chrome.windows.create({ 
                url: tabs[0].url,
                focused: false 
            });

            // Add remaining tabs
            for (let i = 1; i < tabs.length; i++) {
                const tab = tabs[i];
                const newTab = await chrome.tabs.create({
                    windowId: newWindow.id,
                    url: tab.url,
                    pinned: tab.pinned,
                    active: false
                });

                if (tab.muted) {
                    await chrome.tabs.update(newTab.id, { muted: true });
                }
            }
        }

        await loadTabs();
        render();
        showStatusMessage(`Session "${session.name}" opened`);
    } catch (error) {
        console.error('Error opening session:', error);
        showStatusMessage('Error opening session', 'error');
    }
}

async function deleteSession(sessionId) {
    try {
        const sessionIndex = state.sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex === -1) return;

        const session = state.sessions[sessionIndex];
        state.sessions.splice(sessionIndex, 1);
        await chrome.storage.local.set({ sessions: state.sessions });
        
        renderSessions();
        showStatusMessage(`Session "${session.name}" deleted`);
    } catch (error) {
        console.error('Error deleting session:', error);
        showStatusMessage('Error deleting session', 'error');
    }
}

function handleKeyboardShortcuts(event) {
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'f':
                event.preventDefault();
                elements.searchInput.focus();
                break;
            case 'a':
                event.preventDefault();
                selectAllTabs();
                break;
            case 'n':
                event.preventDefault();
                createNewTab();
                break;
        }
    }
}

/**
 * Utility Functions
 */

function showLoading(show) {
    state.loading = show;
    elements.loadingIndicator.classList.toggle('hidden', !show);
}

function showModal() {
    elements.modal.classList.remove('hidden');
}

function hideModal() {
    elements.modal.classList.add('hidden');
    document.getElementById('confirm-move').disabled = true;
}

function showStatusMessage(message, type = 'success') {
    elements.statusMessage.querySelector('.message-text').textContent = message;
    elements.statusMessage.className = `status-message ${type}`;
    elements.statusMessage.classList.remove('hidden');
    
    setTimeout(() => {
        hideStatusMessage();
    }, 3000);
}

function hideStatusMessage() {
    elements.statusMessage.classList.add('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getFilteredTabs: function() {
            if (!state.searchQuery) {
                return state.tabs;
            }
        
            const query = state.searchQuery.toLowerCase();
            return state.tabs.filter(tab => 
                tab.title.toLowerCase().includes(query) || 
                tab.url.toLowerCase().includes(query)
            );
        },
        groupTabs: function(tabs) {
            const groups = {};
        
            tabs.forEach(tab => {
                let groupKey;
                
                if (state.currentView === 'windows') {
                    groupKey = `Window ${tab.windowId}`;
                } else {
                    // Group by domain
                    try {
                        const url = new URL(tab.url);
                        groupKey = url.hostname || 'Unknown';
                    } catch {
                        groupKey = 'Unknown';
                    }
                }
        
                if (!groups[groupKey]) {
                    groups[groupKey] = [];
                }
                groups[groupKey].push(tab);
            });
        
            return groups;
        },
        escapeHtml: function(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };
}