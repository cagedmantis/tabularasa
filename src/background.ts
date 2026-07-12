/**
 * Tabularasa - Background Script
 * Handles extension lifecycle, window management, and session management
 */

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
    await chrome.tabs.create({
      url: 'manager.html',
      active: true
    });
  }
});

/**
 * Notify open manager tabs of a browser event so they refresh.
 *
 * The message is sent unconditionally: the service worker is stopped and
 * restarted by Chrome at any time, so any in-memory record of open manager
 * tabs would be lost. When no manager is listening the send simply rejects,
 * which is ignored.
 */
function notifyManager(message: Record<string, unknown>): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // No manager tab open, ignore
  });
}

chrome.windows.onRemoved.addListener((windowId) => {
  notifyManager({ type: 'WINDOW_REMOVED', windowId });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  notifyManager({ type: 'TAB_UPDATED', tabId, changeInfo, tab });
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  notifyManager({ type: 'TAB_REMOVED', tabId, removeInfo });
});

chrome.tabs.onCreated.addListener((tab) => {
  notifyManager({ type: 'TAB_CREATED', tab });
});

// Switching tabs fires onActivated (not onUpdated), so it needs its own
// listener for the manager's active-tab highlight to stay current.
chrome.tabs.onActivated.addListener((activeInfo) => {
  notifyManager({ type: 'TAB_ACTIVATED', activeInfo });
});

// Moving a tab within or between windows fires onMoved/onAttached.
chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  notifyManager({ type: 'TAB_MOVED', tabId, moveInfo });
});

chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
  notifyManager({ type: 'TAB_MOVED', tabId, attachInfo });
});

chrome.tabGroups.onCreated.addListener((group) => {
  notifyManager({ type: 'GROUP_CREATED', group });
});

chrome.tabGroups.onUpdated.addListener((group) => {
  notifyManager({ type: 'GROUP_UPDATED', group });
});

chrome.tabGroups.onRemoved.addListener((group) => {
  notifyManager({ type: 'GROUP_REMOVED', group });
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
