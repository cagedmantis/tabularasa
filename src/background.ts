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

// Tab, window and group events are deliberately not listened to here. The
// manager page subscribes to them itself; listeners in this file would wake
// the service worker for every tab event in the browser, even with no
// manager open.

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
