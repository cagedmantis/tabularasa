/**
 * Tabularasa - Background Script
 * Handles extension lifecycle and session management
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('Tabularasa extension installed');
  
  // Initialize storage structure
  chrome.storage.local.get(['sessions'], (result) => {
    if (!result.sessions) {
      chrome.storage.local.set({ sessions: [] });
    }
  });
});

// Handle tab updates for real-time UI updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Send update to popup if it's open
  chrome.runtime.sendMessage({
    type: 'TAB_UPDATED',
    tabId: tabId,
    changeInfo: changeInfo,
    tab: tab
  }).catch(() => {
    // Popup not open, ignore
  });
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Send update to popup if it's open
  chrome.runtime.sendMessage({
    type: 'TAB_REMOVED',
    tabId: tabId,
    removeInfo: removeInfo
  }).catch(() => {
    // Popup not open, ignore
  });
});

// Handle tab creation
chrome.tabs.onCreated.addListener((tab) => {
  // Send update to popup if it's open
  chrome.runtime.sendMessage({
    type: 'TAB_CREATED',
    tab: tab
  }).catch(() => {
    // Popup not open, ignore
  });
});

// Handle window removal
chrome.windows.onRemoved.addListener((windowId) => {
  // Send update to popup if it's open
  chrome.runtime.sendMessage({
    type: 'WINDOW_REMOVED',
    windowId: windowId
  }).catch(() => {
    // Popup not open, ignore
  });
});

// Handle context menu (future enhancement)
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
      const filteredSessions = sessions.filter(s => s.id !== request.sessionId);
      chrome.storage.local.set({ sessions: filteredSessions }, () => {
        sendResponse({ success: true });
      });
    });
    return true; // Async response
  }
});