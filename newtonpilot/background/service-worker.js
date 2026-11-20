/**
 * NewtonPilot - Background Service Worker
 * Manages extension state, storage, and cross-session event dispatching.
 */

// Service worker lifecycle installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[NewtonPilot] Extension installed:', details.reason);
  
  // Initialize default storage settings
  chrome.storage.local.set({
    autoMonitorEnabled: true,
    lastExtractedQuestion: null,
    installedAt: Date.now()
  });
});

// Cache last extracted question in storage whenever content script broadcasts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'QUESTION_UPDATED' && message?.payload) {
    chrome.storage.local.set({
      lastExtractedQuestion: message.payload,
      lastUpdatedAt: Date.now()
    });
  }
  return false;
});

// Watch for SPA tab transitions on Newton School portal
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    tab.url.startsWith('https://my.newtonschool.co')
  ) {
    // Notify tab if needed
    console.log('[NewtonPilot] Newton portal tab loaded:', tab.url);
  }
});
