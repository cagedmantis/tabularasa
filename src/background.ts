chrome.runtime.onInstalled.addListener(() => {
  console.log('Tabularasa extension installed');
});

chrome.tabs.onCreated.addListener((tab) => {
  console.log('New tab created:', tab.id);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log('Tab removed:', tabId);
});