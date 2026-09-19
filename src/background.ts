/**
 * Tabularasa - Background Script
 * Handles installation and the toolbar button. Everything else lives in the
 * manager page.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.warn('Tabularasa extension installed');

  // Initialize storage structure
  chrome.storage.local.get(['sessions'], (result) => {
    if (!result.sessions) {
      chrome.storage.local.set({ sessions: [] });
    }
  });
});

// Focuses the manager tab if one is open. Resolves to false when there is
// none, or when it closed between being found and being focused.
async function focusExistingManager(): Promise<boolean> {
  try {
    // Pattern, not exact URL, so a manager opened with a #hash or ?query
    // is still found.
    const [managerTab] = await chrome.tabs.query({ url: `${chrome.runtime.getURL('manager.html')}*` });
    if (!managerTab?.id) {
      return false;
    }
    await chrome.tabs.update(managerTab.id, { active: true });
    try {
      await chrome.windows.update(managerTab.windowId, { focused: true });
    } catch (error) {
      // The tab is active; failing to raise its window is no reason to
      // open a second manager.
      console.warn('Could not focus the manager window:', error);
    }
    return true;
  } catch (error) {
    console.warn('Could not focus the manager tab, opening a new one:', error);
    return false;
  }
}

// Handle extension action click - open manager in new tab
chrome.action.onClicked.addListener(async () => {
  if (await focusExistingManager()) {
    return;
  }
  try {
    await chrome.tabs.create({ url: 'manager.html', active: true });
  } catch (error) {
    console.error('Error opening the manager:', error);
  }
});

// Tab, window and group events are deliberately not listened to here. The
// manager page subscribes to them itself; listeners in this file would wake
// the service worker for every tab event in the browser, even with no
// manager open. The manager also reads and writes sessions directly, so
// there is no message API either.
