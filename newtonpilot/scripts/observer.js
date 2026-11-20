/**
 * NewtonPilot - Dynamic Page Observer
 * Monitors React SPA updates and DOM mutations with debouncing and deduplication.
 */

const NewtonObserver = (() => {
  'use strict';

  let observerInstance = null;
  let debounceTimer = null;
  let lastReportedId = null;
  let isMonitoringActive = false;
  let onUpdateCallback = null;

  const DEBOUNCE_DELAY_MS = 350;

  /**
   * Safe execution of extractor and update propagation.
   */
  function handleDomMutation() {
    if (!isMonitoringActive || !NewtonExtractor) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      try {
        const result = NewtonExtractor.extractCurrentQuestion();
        if (!result || !result.success) return;

        // Deduplication: Only emit if question signature or selection changed
        const currentSignature = `${result.questionId}_${result.selectedOptions.join(',')}`;
        if (currentSignature !== lastReportedId) {
          lastReportedId = currentSignature;
          if (typeof onUpdateCallback === 'function') {
            onUpdateCallback(result);
          }
        }
      } catch (err) {
        console.warn('[NewtonPilot] Observer check failed:', err);
      }
    }, DEBOUNCE_DELAY_MS);
  }

  /**
   * Monitor SPA History / URL transitions.
   */
  function setupUrlMonitoring() {
    let lastUrl = window.location.href;

    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        lastReportedId = null; // Reset deduplication on route navigation
        handleDomMutation();
      }
    };

    window.addEventListener('popstate', checkUrlChange);

    // Monkey-patch pushState & replaceState for seamless SPA navigation capture
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      checkUrlChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      checkUrlChange();
    };
  }

  /**
   * Start observing DOM mutations.
   * @param {Function} callback Callback receiving updated question payload
   * @returns {boolean} Status
   */
  function start(callback) {
    if (isMonitoringActive) return true;

    if (callback) {
      onUpdateCallback = callback;
    }

    const targetNode = document.querySelector('main') || document.body;
    if (!targetNode) return false;

    try {
      observerInstance = new MutationObserver((mutations) => {
        // Filter out mutations made by browser extensions (e.g. style or internal attrs)
        let relevantChange = false;
        for (const m of mutations) {
          if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
            relevantChange = true;
            break;
          }
          if (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'aria-checked')) {
            relevantChange = true;
            break;
          }
        }
        if (relevantChange) {
          handleDomMutation();
        }
      });

      observerInstance.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-checked', 'aria-selected', 'checked', 'style']
      });

      isMonitoringActive = true;
      setupUrlMonitoring();

      // Trigger immediate initial evaluation
      handleDomMutation();
      return true;
    } catch (err) {
      console.error('[NewtonPilot] Failed to start MutationObserver:', err);
      isMonitoringActive = false;
      return false;
    }
  }

  /**
   * Stop observing DOM mutations.
   */
  function stop() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (observerInstance) {
      observerInstance.disconnect();
      observerInstance = null;
    }

    isMonitoringActive = false;
    return true;
  }

  /**
   * Check if observer is active.
   * @returns {boolean}
   */
  function isMonitoring() {
    return isMonitoringActive;
  }

  return {
    start,
    stop,
    isMonitoring,
    triggerManualCheck: handleDomMutation
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NewtonObserver;
}
if (typeof globalThis !== 'undefined') {
  globalThis.NewtonObserver = NewtonObserver;
}
