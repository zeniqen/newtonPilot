/**
 * NewtonPilot - Background Service Worker
 * Manages extension state, storage, cross-session dispatching,
 * and background local Ollama AI requests (Phase 2).
 */

import NewtonPythonEngine from '../services/python-engine.js';
import OllamaProvider from '../services/ollama-provider.js';

if (typeof globalThis !== 'undefined') {
  globalThis.NewtonPythonEngine = NewtonPythonEngine;
}

// Configure DeclarativeNetRequest to ensure Ollama accepts requests from the extension
async function registerOriginRule() {
  if (!chrome.declarativeNetRequest) return;
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map(r => r.id);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: [
        {
          id: 1,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              {
                header: 'Origin',
                operation: 'set',
                value: 'http://localhost'
              }
            ]
          },
          condition: {
            urlFilter: ':11434',
            resourceTypes: ['xmlhttprequest']
          }
        }
      ]
    });
    console.log('[NewtonPilot] Ollama Origin header rewrite rule active.');
  } catch (err) {
    console.warn('[NewtonPilot] Error setting DNR Origin rule:', err);
  }
}

// Run immediately on service worker start
registerOriginRule();

// Service worker lifecycle installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[NewtonPilot] Extension installed:', details.reason);
  registerOriginRule();
  
  // Initialize default storage settings
  chrome.storage.local.set({
    autoMonitorEnabled: true,
    lastExtractedQuestion: null,
    installedAt: Date.now(),
    defaultAiModel: 'qwen2.5-coder:7b'
  });
});

// Centralized message routing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  // 1. Live Question Updates from Content Script
  if (message.action === 'QUESTION_UPDATED' && message.payload) {
    chrome.storage.local.set({
      lastExtractedQuestion: message.payload,
      lastUpdatedAt: Date.now()
    });
    return false;
  }

  // 2. Ollama Connection & Model Discovery
  if (message.action === 'CHECK_AI_STATUS') {
    const host = message.host || 'http://localhost:11434';
    const provider = new OllamaProvider({ host });

    provider.checkConnection()
      .then(result => {
        sendResponse({ success: true, ...result });
      })
      .catch(err => {
        sendResponse({ success: false, available: false, error: err.message, models: [] });
      });

    return true; // Keep message channel open for async response
  }

  // 3. AI Explanation Request (Phase 2 Pedagogical Review)
  if (message.action === 'REQUEST_AI_EXPLANATION') {
    const payload = message.payload || {};
    const { questionData, model = 'qwen2.5-coder:7b', host = 'http://localhost:11434', forceRefresh = false } = payload;

    if (!questionData || !questionData.questionText) {
      sendResponse({ success: false, error: 'No valid question data provided for explanation.' });
      return false;
    }

    const qId = questionData.questionId || 'current';
    const cacheKey = `ai_exp_${qId}_${model}`;

    (async () => {
      try {
        const provider = new OllamaProvider({ host, model });
        const pyEngine = provider.pythonEngine;
        const pySol = pyEngine ? pyEngine.solve(questionData.questionText) : null;

        // Check cache if not forcing refresh
        if (!forceRefresh) {
          const cached = await chrome.storage.local.get([cacheKey]);
          if (cached && cached[cacheKey]) {
            let explanation = cached[cacheKey];
            // Cross-verify cached explanation with deterministic engine
            if (pySol && pySol.solved && explanation.suggested_answer !== pySol.answer) {
              console.warn(`[NewtonPilot] Cache contained outdated answer '${explanation.suggested_answer}'. Overriding with deterministic answer '${pySol.answer}'.`);
              explanation = provider.reconcileExplanation(explanation, questionData);
              await chrome.storage.local.set({ [cacheKey]: explanation });
            }
            sendResponse({
              success: true,
              explanation,
              fromCache: true,
              model
            });
            return;
          }
        }

        // Query Ollama in background (bypasses CORS restrictions)
        const explanation = await provider.requestExplanation(questionData);

        // Cache explanation
        await chrome.storage.local.set({ [cacheKey]: explanation });

        sendResponse({
          success: true,
          explanation,
          fromCache: false,
          model
        });
      } catch (err) {
        console.error('[NewtonPilot] AI explanation generation failed:', err);
        sendResponse({
          success: false,
          error: err.message || 'Failed to generate explanation from local Ollama model.'
        });
      }
    })();

    return true; // Keep message channel open for async response
  }

  // Fast Deterministic Code Evaluation Check (0ms pre-fill)
  if (message.action === 'CHECK_DETERMINISTIC_SOLUTION') {
    try {
      const questionText = message.questionText || '';
      const pyEngine = new NewtonPythonEngine();
      const solution = pyEngine.solve(questionText);
      sendResponse({ success: true, solution });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return false;
  }

  // 4. Invalidate / Clear Explanation Cache
  if (message.action === 'CLEAR_AI_CACHE') {
    const qId = message.questionId;
    if (qId) {
      chrome.storage.local.get(null, (allData) => {
        const keysToRemove = Object.keys(allData).filter(k => k.startsWith(`ai_exp_${qId}`));
        if (keysToRemove.length > 0) {
          chrome.storage.local.remove(keysToRemove, () => {
            sendResponse({ success: true, removedKeys: keysToRemove });
          });
        } else {
          sendResponse({ success: true, removedKeys: [] });
        }
      });
      return true;
    }
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
    console.log('[NewtonPilot] Newton portal tab loaded:', tab.url);
  }
});

// Global Keyboard Shortcut Command Listener
if (chrome?.commands?.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0 || !tabs[0].id) return;
      const activeTab = tabs[0];
      if (!activeTab.url || !activeTab.url.startsWith('https://my.newtonschool.co')) return;

      if (command === 'step_question') {
        console.log('[NewtonPilot] Hotkey triggered: step_question');
        chrome.tabs.sendMessage(activeTab.id, {
          action: 'STEP_AUTONOMOUS_AGENT',
          payload: { autoNavigate: false }
        }).catch(err => console.warn('[NewtonPilot] Hotkey step failed:', err));
      } else if (command === 'toggle_pilot') {
        console.log('[NewtonPilot] Hotkey triggered: toggle_pilot');
        chrome.tabs.sendMessage(activeTab.id, {
          action: 'TOGGLE_AUTONOMOUS_AGENT'
        }).catch(err => console.warn('[NewtonPilot] Hotkey toggle failed:', err));
      }
    } catch (err) {
      console.warn('[NewtonPilot] Error handling hotkey command:', err);
    }
  });
}
