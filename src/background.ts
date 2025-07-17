/**
 * Tabularasa - Background Script
 * Handles extension lifecycle, window management, and session management
 */

// Track manager tabs for real-time updates
const managerTabIds: Set<number> = new Set();

chrome.runtime.onInstalled.addListener(() => {
  console.warn('Tabularasa extension installed');
  
  // Pin extension icon to toolbar by default
  chrome.action.setPopup({ popup: '' }); // Ensure no popup is set
  
  // Initialize storage structure
  chrome.storage.local.get(['sessions'], (result) => {
    if (!result.sessions) {
      chrome.storage.local.set({ sessions: [] });
    }
  });
});

// Handle extension action click - open manager in new tab
chrome.action.onClicked.addListener(async () => {
  // Check if manager tab is already open
  const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('manager.html') });
  
  if (tabs.length > 0) {
    // Focus existing tab
    await chrome.tabs.update(tabs[0].id!, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // Create new tab
    const tab = await chrome.tabs.create({
      url: 'manager.html',
      active: true
    });
    managerTabIds.add(tab.id!);
  }
});

// Handle window removal
chrome.windows.onRemoved.addListener((windowId) => {
  // Send update to manager tabs if any are open
  if (managerTabIds.size > 0) {
    chrome.runtime.sendMessage({
      type: 'WINDOW_REMOVED',
      windowId: windowId
    }).catch(() => {
      // Manager tabs not open, ignore
    });
  }
});

// Handle tab updates for real-time UI updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Send update to manager tabs if any are open
  if (managerTabIds.size > 0) {
    chrome.runtime.sendMessage({
      type: 'TAB_UPDATED',
      tabId: tabId,
      changeInfo: changeInfo,
      tab: tab
    }).catch(() => {
      // Manager tabs not open, ignore
    });
  }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Remove from manager tabs if it was a manager tab
  managerTabIds.delete(tabId);
  
  // Send update to manager tabs if any are open
  if (managerTabIds.size > 0) {
    chrome.runtime.sendMessage({
      type: 'TAB_REMOVED',
      tabId: tabId,
      removeInfo: removeInfo
    }).catch(() => {
      // Manager tabs not open, ignore
    });
  }
});

// Handle tab creation
chrome.tabs.onCreated.addListener((tab) => {
  // Send update to manager tabs if any are open
  if (managerTabIds.size > 0) {
    chrome.runtime.sendMessage({
      type: 'TAB_CREATED',
      tab: tab
    }).catch(() => {
      // Manager tabs not open, ignore
    });
  }
});

// Handle tab group creation
chrome.tabGroups.onCreated.addListener((group) => {
  // Send update to manager tabs if any are open
  if (managerTabIds.size > 0) {
    chrome.runtime.sendMessage({
      type: 'GROUP_CREATED',
      group: group
    }).catch(() => {
      // Manager tabs not open, ignore
    });
  }
});

// Handle tab group updates
chrome.tabGroups.onUpdated.addListener((group) => {
  // Send update to manager tabs if any are open
  if (managerTabIds.size > 0) {
    chrome.runtime.sendMessage({
      type: 'GROUP_UPDATED',
      group: group
    }).catch(() => {
      // Manager tabs not open, ignore
    });
  }
});

// Handle tab group removal
chrome.tabGroups.onRemoved.addListener((group) => {
  // Send update to manager tabs if any are open
  if (managerTabIds.size > 0) {
    chrome.runtime.sendMessage({
      type: 'GROUP_REMOVED',
      group: group
    }).catch(() => {
      // Manager tabs not open, ignore
    });
  }
});

// Handle messages from manager window
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_SESSIONS') {
    chrome.storage.local.get(['sessions'], (result) => {
      sendResponse({ sessions: result.sessions || [] });
    });
    return true; // Async response
  }
  
  if (request.type === 'SAVE_SESSION') {
    chrome.storage.local.get(['sessions'], (result) => {
      const sessions = result.sessions || [];
      sessions.push(request.session);
      chrome.storage.local.set({ sessions }, () => {
        sendResponse({ success: true });
      });
    });
    return true; // Async response
  }
  
  if (request.type === 'DELETE_SESSION') {
    chrome.storage.local.get(['sessions'], (result) => {
      const sessions = result.sessions || [];
      const filteredSessions = sessions.filter((s: { id: string }) => s.id !== request.sessionId);
      chrome.storage.local.set({ sessions: filteredSessions }, () => {
        sendResponse({ success: true });
      });
    });
    return true; // Async response
  }
});