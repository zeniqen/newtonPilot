/**
 * NewtonPilot - Content Script Coordinator
 * Bridges DOM extraction, page observation, and extension runtime messaging.
 */

(() => {
  'use strict';

  console.log('[NewtonPilot] Content script injected on Newton School portal.');

  let cachedQuestionState = null;

  /**
   * Broadcast an updated question event to popup/background.
   * @param {Object} data 
   */
  function broadcastUpdate(data) {
    cachedQuestionState = data;
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: NewtonMessaging.ACTIONS.QUESTION_UPDATED,
        payload: data
      }).catch(() => {
        // Popup may be closed, ignore
      });
    }
  }

  /**
   * Broadcast extraction error.
   * @param {string} message 
   */
  function broadcastError(message) {
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: NewtonMessaging.ACTIONS.EXTRACTION_ERROR,
        payload: { error: message, timestamp: Date.now() }
      }).catch(() => {});
    }
  }

  /**
   * Perform extraction and cache result.
   */
  function performExtraction() {
    if (!window.NewtonExtractor) {
      return { success: false, error: 'NewtonExtractor module not initialized' };
    }
    const result = window.NewtonExtractor.extractCurrentQuestion();
    if (result && result.success) {
      cachedQuestionState = result;
    }
    return result;
  }

  /**
   * Listen for incoming messages from popup or background.
   */
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const action = request?.action;

      switch (action) {
        case NewtonMessaging.ACTIONS.PING:
          sendResponse({
            success: true,
            status: 'ready',
            url: window.location.href,
            isMonitoring: window.NewtonObserver?.isMonitoring() || false
          });
          break;

        case NewtonMessaging.ACTIONS.INSPECT_QUESTION: {
          const extraction = performExtraction();
          sendResponse({
            success: true,
            data: extraction,
            isMonitoring: window.NewtonObserver?.isMonitoring() || false
          });
          break;
        }

        case NewtonMessaging.ACTIONS.GET_CURRENT_STATE: {
          const current = cachedQuestionState || performExtraction();
          sendResponse({
            success: true,
            data: current,
            isMonitoring: window.NewtonObserver?.isMonitoring() || false
          });
          break;
        }

        case NewtonMessaging.ACTIONS.START_MONITORING: {
          if (window.NewtonObserver) {
            const started = window.NewtonObserver.start((data) => {
              broadcastUpdate(data);
            });
            const current = performExtraction();
            sendResponse({ success: started, data: current, isMonitoring: true });
          } else {
            sendResponse({ success: false, error: 'Observer not available' });
          }
          break;
        }

        case NewtonMessaging.ACTIONS.STOP_MONITORING: {
          if (window.NewtonObserver) {
            window.NewtonObserver.stop();
            sendResponse({ success: true, isMonitoring: false });
          } else {
            sendResponse({ success: false, error: 'Observer not available' });
          }
          break;
        }

        default:
          sendResponse({ success: false, error: `Unhandled action: ${action}` });
          break;
      }

      // Return true to keep message channel open for async responses if needed
      return true;
    });
  }

  /**
   * Initial Setup: Check stored preferences
   */
  if (chrome?.storage?.local) {
    chrome.storage.local.get(['autoMonitorEnabled'], (items) => {
      // Default to auto-monitoring enabled for seamless review
      const shouldAutoMonitor = items?.autoMonitorEnabled !== false;
      if (shouldAutoMonitor && window.NewtonObserver) {
        window.NewtonObserver.start((data) => {
          broadcastUpdate(data);
        });
      }
    });
  }
})();
