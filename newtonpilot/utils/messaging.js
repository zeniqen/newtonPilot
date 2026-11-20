/**
 * NewtonPilot - Messaging Protocol & Utility Helpers
 * Provides standardized message schemas and error-safe message wrappers across
 * popup, content scripts, and service worker.
 */

const NewtonMessaging = (() => {
  const ACTIONS = Object.freeze({
    INSPECT_QUESTION: 'INSPECT_QUESTION',
    GET_CURRENT_STATE: 'GET_CURRENT_STATE',
    START_MONITORING: 'START_MONITORING',
    STOP_MONITORING: 'STOP_MONITORING',
    QUESTION_UPDATED: 'QUESTION_UPDATED',
    EXTRACTION_ERROR: 'EXTRACTION_ERROR',
    PING: 'PING',
    REQUEST_AI_EXPLANATION: 'REQUEST_AI_EXPLANATION',
    CHECK_AI_STATUS: 'CHECK_AI_STATUS',
    START_AUTONOMOUS_AGENT: 'START_AUTONOMOUS_AGENT',
    PAUSE_AUTONOMOUS_AGENT: 'PAUSE_AUTONOMOUS_AGENT',
    STOP_AUTONOMOUS_AGENT: 'STOP_AUTONOMOUS_AGENT',
    STEP_AUTONOMOUS_AGENT: 'STEP_AUTONOMOUS_AGENT',
    TOGGLE_AUTONOMOUS_AGENT: 'TOGGLE_AUTONOMOUS_AGENT',
    FILL_TEXT_ANSWER: 'FILL_TEXT_ANSWER',
    GET_AGENT_STATUS: 'GET_AGENT_STATUS',
    AGENT_STATE_UPDATED: 'AGENT_STATE_UPDATED'
  });

  /**
   * Safely send message to the active tab in current window.
   * Handles disconnected tab, missing content script, and restricted URLs.
   * @param {Object} message 
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async function sendToActiveTab(message) {
    try {
      if (!chrome?.tabs?.query) {
        return { success: false, error: 'Tabs API unavailable.' };
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        return { success: false, error: 'No active tab found.' };
      }

      const activeTab = tabs[0];
      const url = activeTab.url || '';

      // Verify portal domain
      if (!url.startsWith('https://my.newtonschool.co')) {
        return {
          success: false,
          error: 'Not on Newton School portal',
          unsupportedUrl: url
        };
      }

      const response = await chrome.tabs.sendMessage(activeTab.id, message);
      return { success: true, data: response };
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('Receiving end does not exist')) {
        return {
          success: false,
          error: 'Content script not loaded yet. Refresh the quiz page or ensure you are on a valid course page.',
          details: msg
        };
      }
      return { success: false, error: msg };
    }
  }

  /**
   * Send message to Chrome extension runtime (e.g. from content script to popup/background).
   * @param {Object} message 
   * @returns {Promise<any>}
   */
  async function sendToRuntime(message) {
    try {
      if (!chrome?.runtime?.sendMessage) return null;
      return await chrome.runtime.sendMessage(message);
    } catch (err) {
      // Ignored if popup is closed or no listener is active
      return null;
    }
  }

  return {
    ACTIONS,
    sendToActiveTab,
    sendToRuntime
  };
})();

// Support both ES module and global script inclusion
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NewtonMessaging;
}
if (typeof globalThis !== 'undefined') {
  globalThis.NewtonMessaging = NewtonMessaging;
}
