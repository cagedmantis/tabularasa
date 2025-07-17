let managerWindowId: number | null = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Tabularasa extension installed');
});

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
    width: 900,
    height: 600,
    focused: true
  });
  
  managerWindowId = window.id!;
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === managerWindowId) {
    managerWindowId = null;
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  console.log('New tab created:', tab.id);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log('Tab removed:', tabId);
});