document.addEventListener('DOMContentLoaded', async () => {
  const tabsList = document.getElementById('tabs-list');
  
  try {
    const tabs = await chrome.tabs.query({});
    
    tabs.forEach(tab => {
      const tabElement = document.createElement('div');
      tabElement.className = 'tab-item';
      tabElement.innerHTML = `
        <div class="tab-title">${tab.title}</div>
        <div class="tab-url">${tab.url}</div>
      `;
      
      tabElement.addEventListener('click', () => {
        chrome.tabs.update(tab.id!, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
      });
      
      tabsList?.appendChild(tabElement);
    });
  } catch (error) {
    console.error('Error fetching tabs:', error);
  }
});