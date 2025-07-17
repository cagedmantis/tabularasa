/**
 * Tabularasa - Background Script
 * Handles extension lifecycle, window management, and session management
 */

let managerWindowId: number | null = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Tabularasa extension installed');
  
  // Initialize storage structure
  chrome.storage.local.get(['sessions'], (result) => {
    if (!result.sessions) {
      chrome.storage.local.set({ sessions: [] });
    }
  });
});

// Handle extension action click - open manager window
chrome.action.onClicked.addListener(async () => {
  if (managerWindowId) {
    try {
      await chrome.windows.update(managerWindowId, { focused: true });
      return;
    } catch (error) {
      managerWindowId = null;
    }
  }
  
  const window = await chrome.windows.create({
    url: 'manager.html',
    type: 'popup',
    width: 1000,
    height: 700,
    focused: true
  });
  
  managerWindowId = window.id!;
});

// Handle window removal
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === managerWindowId) {
    managerWindowId = null;
  }
  
  // Send update to manager window if it's open
  if (managerWindowId) {
    chrome.runtime.sendMessage({
      type: 'WINDOW_REMOVED',
      windowId: windowId
    }).catch(() => {
      // Manager window not open, ignore
    });
  }
});

// Handle tab updates for real-time UI updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Send update to manager window if it's open
  if (managerWindowId) {
    chrome.runtime.sendMessage({
      type: 'TAB_UPDATED',
      tabId: tabId,
      changeInfo: changeInfo,
      tab: tab
    }).catch(() => {
      // Manager window not open, ignore
    });
  }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Send update to manager window if it's open
  if (managerWindowId) {
    chrome.runtime.sendMessage({
      type: 'TAB_REMOVED',
      tabId: tabId,
      removeInfo: removeInfo
    }).catch(() => {
      // Manager window not open, ignore
    });
  }
});

// Handle tab creation
chrome.tabs.onCreated.addListener((tab) => {
  // Send update to manager window if it's open
  if (managerWindowId) {
    chrome.runtime.sendMessage({
      type: 'TAB_CREATED',
      tab: tab
    }).catch(() => {
      // Manager window not open, ignore
    });
  }
});

// Handle tab group creation
chrome.tabGroups.onCreated.addListener((group) => {
  // Send update to manager window if it's open
  if (managerWindowId) {
    chrome.runtime.sendMessage({
      type: 'GROUP_CREATED',
      group: group
    }).catch(() => {
      // Manager window not open, ignore
    });
  }
});

// Handle tab group updates
chrome.tabGroups.onUpdated.addListener((group) => {
  // Send update to manager window if it's open
  if (managerWindowId) {
    chrome.runtime.sendMessage({
      type: 'GROUP_UPDATED',
      group: group
    }).catch(() => {
      // Manager window not open, ignore
    });
  }
});

// Handle tab group removal
chrome.tabGroups.onRemoved.addListener((group) => {
  // Send update to manager window if it's open
  if (managerWindowId) {
    chrome.runtime.sendMessage({
      type: 'GROUP_REMOVED',
      group: group
    }).catch(() => {
      // Manager window not open, ignore
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
      const filteredSessions = sessions.filter((s: any) => s.id !== request.sessionId);
      chrome.storage.local.set({ sessions: filteredSessions }, () => {
        sendResponse({ success: true });
      });
    });
    return true; // Async response
  }
});