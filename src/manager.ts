interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  windowId: number;
}

interface WindowGroup {
  id: number;
  tabs: TabInfo[];
}

let selectedTabs: Set<number> = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  await loadTabs();
  
  document.getElementById('refresh-btn')?.addEventListener('click', loadTabs);
  document.getElementById('close-duplicates-btn')?.addEventListener('click', closeDuplicateTabs);
  document.getElementById('close-selected-btn')?.addEventListener('click', closeSelectedTabs);
  document.getElementById('search-box')?.addEventListener('input', filterTabs);
});

async function loadTabs() {
  const tabsContainer = document.getElementById('tabs-container');
  if (!tabsContainer) return;
  
  try {
    const tabs = await chrome.tabs.query({});
    const windows = await chrome.windows.getAll();
    
    const windowGroups: WindowGroup[] = [];
    
    windows.forEach(window => {
      if (window.type === 'normal') {
        const windowTabs = tabs.filter(tab => tab.windowId === window.id);
        if (windowTabs.length > 0) {
          windowGroups.push({
            id: window.id!,
            tabs: windowTabs.map(tab => ({
              id: tab.id!,
              title: tab.title || 'Untitled',
              url: tab.url || '',
              favIconUrl: tab.favIconUrl,
              active: tab.active,
              windowId: tab.windowId
            }))
          });
        }
      }
    });
    
    renderWindowGroups(windowGroups);
  } catch (error) {
    console.error('Error loading tabs:', error);
  }
}

function renderWindowGroups(windowGroups: WindowGroup[]) {
  const tabsContainer = document.getElementById('tabs-container');
  if (!tabsContainer) return;
  
  tabsContainer.innerHTML = '';
  
  windowGroups.forEach(windowGroup => {
    const windowElement = document.createElement('div');
    windowElement.className = 'window-group';
    
    const headerElement = document.createElement('div');
    headerElement.className = 'window-header';
    headerElement.textContent = `Window ${windowGroup.id} (${windowGroup.tabs.length} tabs)`;
    windowElement.appendChild(headerElement);
    
    windowGroup.tabs.forEach(tab => {
      const tabElement = createTabElement(tab);
      windowElement.appendChild(tabElement);
    });
    
    tabsContainer.appendChild(windowElement);
  });
  
  updateCloseSelectedButton();
}

function createTabElement(tab: TabInfo): HTMLElement {
  const tabElement = document.createElement('div');
  tabElement.className = `tab-item ${tab.active ? 'active' : ''}`;
  tabElement.dataset.tabId = tab.id.toString();
  
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
  favicon.onerror = () => {
    favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
  };
  
  const contentElement = document.createElement('div');
  contentElement.className = 'tab-content';
  
  const titleElement = document.createElement('div');
  titleElement.className = 'tab-title';
  titleElement.textContent = tab.title;
  
  const urlElement = document.createElement('div');
  urlElement.className = 'tab-url';
  urlElement.textContent = tab.url;
  
  contentElement.appendChild(titleElement);
  contentElement.appendChild(urlElement);
  
  const closeButton = document.createElement('button');
  closeButton.className = 'tab-close';
  closeButton.textContent = '×';
  closeButton.title = 'Close tab';
  
  tabElement.appendChild(favicon);
  tabElement.appendChild(contentElement);
  tabElement.appendChild(closeButton);
  
  tabElement.addEventListener('click', (e) => {
    if (e.target === closeButton) {
      closeTab(tab.id);
    } else if (e.ctrlKey || e.metaKey) {
      toggleTabSelection(tab.id, tabElement);
    } else {
      switchToTab(tab.id, tab.windowId);
    }
  });
  
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tab.id);
  });
  
  return tabElement;
}

function toggleTabSelection(tabId: number, tabElement: HTMLElement) {
  if (selectedTabs.has(tabId)) {
    selectedTabs.delete(tabId);
    tabElement.style.backgroundColor = '';
  } else {
    selectedTabs.add(tabId);
    tabElement.style.backgroundColor = '#fff3cd';
  }
  updateCloseSelectedButton();
}

function updateCloseSelectedButton() {
  const button = document.getElementById('close-selected-btn') as HTMLButtonElement;
  if (button) {
    button.disabled = selectedTabs.size === 0;
    button.textContent = selectedTabs.size > 0 ? `Close Selected (${selectedTabs.size})` : 'Close Selected';
  }
}

async function switchToTab(tabId: number, windowId: number) {
  try {
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(windowId, { focused: true });
  } catch (error) {
    console.error('Error switching to tab:', error);
  }
}

async function closeTab(tabId: number) {
  try {
    await chrome.tabs.remove(tabId);
    selectedTabs.delete(tabId);
    await loadTabs();
  } catch (error) {
    console.error('Error closing tab:', error);
  }
}

async function closeSelectedTabs() {
  if (selectedTabs.size === 0) return;
  
  try {
    await chrome.tabs.remove(Array.from(selectedTabs));
    selectedTabs.clear();
    await loadTabs();
  } catch (error) {
    console.error('Error closing selected tabs:', error);
  }
}

async function closeDuplicateTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const urlGroups = new Map<string, chrome.tabs.Tab[]>();
    
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
        tabGroup.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
        tabsToClose.push(...tabGroup.slice(0, -1).map(tab => tab.id!));
      }
    });
    
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
      await loadTabs();
    }
  } catch (error) {
    console.error('Error closing duplicate tabs:', error);
  }
}

function filterTabs() {
  const searchBox = document.getElementById('search-box') as HTMLInputElement;
  const query = searchBox.value.toLowerCase();
  
  const tabItems = document.querySelectorAll('.tab-item');
  
  tabItems.forEach(item => {
    const title = item.querySelector('.tab-title')?.textContent?.toLowerCase() || '';
    const url = item.querySelector('.tab-url')?.textContent?.toLowerCase() || '';
    
    const matches = title.includes(query) || url.includes(query);
    (item as HTMLElement).style.display = matches ? '' : 'none';
  });
}