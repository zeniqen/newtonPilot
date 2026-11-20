/**
 * NewtonPilot - Popup Controller
 * Manages UI rendering, user actions, live question tracking,
 * and local Ollama AI pedagogical concept review (Phase 2).
 */

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  // DOM Elements - Navigation & Core
  const connectionStatus = document.getElementById('connectionStatus');
  const statusLabel = connectionStatus.querySelector('.status-label');
  const autoMonitorToggle = document.getElementById('autoMonitorToggle');
  const inspectBtn = document.getElementById('inspectBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const portalNotice = document.getElementById('portalNotice');
  const portalNoticeText = document.getElementById('portalNoticeText');

  // Session Badges
  const sessionCard = document.getElementById('sessionCard');
  const questionNumBadge = document.getElementById('questionNumBadge');
  const formatBadge = document.getElementById('formatBadge');
  const optionsCountBadge = document.getElementById('optionsCountBadge');

  // Question Tab Elements
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const questionPreviewCard = document.getElementById('questionPreviewCard');
  const timestampBadge = document.getElementById('timestampBadge');
  const questionStatement = document.getElementById('questionStatement');
  const questionMedia = document.getElementById('questionMedia');
  const selectionSummary = document.getElementById('selectionSummary');
  const optionsList = document.getElementById('optionsList');

  // Phase 2 AI Elements
  const aiConnectionStatus = document.getElementById('aiConnectionStatus');
  const aiStatusText = document.getElementById('aiStatusText');
  const aiModelSelect = document.getElementById('aiModelSelect');
  const explainBtn = document.getElementById('explainBtn');
  const reExplainBtn = document.getElementById('reExplainBtn');
  const aiNotice = document.getElementById('aiNotice');
  const aiNoticeText = document.getElementById('aiNoticeText');
  const aiLoading = document.getElementById('aiLoading');
  const aiLoadingLabel = document.getElementById('aiLoadingLabel');
  const aiResultCard = document.getElementById('aiResultCard');
  const aiSuggestedAnswer = document.getElementById('aiSuggestedAnswer');
  const aiConfidenceBadge = document.getElementById('aiConfidenceBadge');
  const aiConceptSummaryWrap = document.getElementById('aiConceptSummaryWrap');
  const aiConceptSummary = document.getElementById('aiConceptSummary');
  const aiReasoningText = document.getElementById('aiReasoningText');
  const aiBreakdownWrap = document.getElementById('aiBreakdownWrap');
  const aiBreakdownList = document.getElementById('aiBreakdownList');

  // Diagnostics & JSON Tab Elements
  const tabQuestionBtn = document.getElementById('tabQuestionBtn');
  const tabDiagBtn = document.getElementById('tabDiagBtn');
  const questionTabView = document.getElementById('questionTabView');
  const diagTabView = document.getElementById('diagTabView');
  const diagUrl = document.getElementById('diagUrl');
  const diagHash = document.getElementById('diagHash');
  const diagJson = document.getElementById('diagJson');
  const copyJsonBtn = document.getElementById('copyJsonBtn');
  const copyJsonTopBtn = document.getElementById('copyJsonTopBtn');

  let currentQuestionData = null;
  let isOllamaOnline = false;

  // --------------------------------------------------------------------------
  // Tab Navigation
  // --------------------------------------------------------------------------

  function switchTab(tabName) {
    if (tabName === 'question') {
      tabQuestionBtn.classList.add('active');
      tabDiagBtn.classList.remove('active');
      questionTabView.classList.remove('hidden');
      diagTabView.classList.add('hidden');
    } else {
      tabDiagBtn.classList.add('active');
      tabQuestionBtn.classList.remove('active');
      diagTabView.classList.remove('hidden');
      questionTabView.classList.add('hidden');
    }
  }

  tabQuestionBtn.addEventListener('click', () => switchTab('question'));
  tabDiagBtn.addEventListener('click', () => switchTab('diag'));

  // --------------------------------------------------------------------------
  // Status & Utility Helpers
  // --------------------------------------------------------------------------

  function setStatus(type, text) {
    connectionStatus.className = `status-badge ${type}`;
    statusLabel.textContent = text;
  }

  function showLoading(show) {
    if (show) {
      loadingState.classList.remove('hidden');
      emptyState.classList.add('hidden');
      questionPreviewCard.classList.add('hidden');
    } else {
      loadingState.classList.add('hidden');
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatTypeName(format) {
    switch (format) {
      case 'single_choice': return 'Single Choice';
      case 'multi_choice': return 'Multi-Select';
      case 'true_false': return 'True / False';
      default: return 'Practice MCQ';
    }
  }

  // --------------------------------------------------------------------------
  // Phase 2: Ollama AI Tutor Controller
  // --------------------------------------------------------------------------

  async function checkOllamaStatus() {
    try {
      chrome.runtime.sendMessage({ action: 'CHECK_AI_STATUS' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.available) {
          isOllamaOnline = false;
          aiConnectionStatus.className = 'ai-status-pill offline';
          aiStatusText.textContent = 'Offline';
          aiNotice.classList.remove('hidden');
          aiNoticeText.innerHTML = 'Ollama server offline. Run <code>ollama serve</code> in terminal to enable AI explanations.';
          return;
        }

        isOllamaOnline = true;
        aiConnectionStatus.className = 'ai-status-pill online';
        aiStatusText.textContent = `Online (${res.models.length} models)`;
        aiNotice.classList.add('hidden');

        // Populate model dropdown
        if (res.models && res.models.length > 0) {
          chrome.storage.local.get(['selectedAiModel'], (items) => {
            const savedModel = items?.selectedAiModel;
            aiModelSelect.innerHTML = '';
            
            res.models.forEach(m => {
              const opt = document.createElement('option');
              opt.value = m;
              opt.textContent = m;
              if (savedModel ? m === savedModel : m.includes('qwen2.5-coder') || m.includes('coder')) {
                opt.selected = true;
              }
              aiModelSelect.appendChild(opt);
            });

            // If nothing was selected, select first
            if (!aiModelSelect.value && res.models[0]) {
              aiModelSelect.value = res.models[0];
            }

            // Check if current question already has a cached explanation for this model
            if (currentQuestionData) {
              checkCachedExplanation(currentQuestionData.questionId, aiModelSelect.value);
            }
          });
        }
      });
    } catch (err) {
      console.warn('[NewtonPilot] Error checking Ollama status:', err);
      aiConnectionStatus.className = 'ai-status-pill offline';
      aiStatusText.textContent = 'Offline';
    }
  }

  function renderExplanation(data) {
    if (!data) return;

    aiLoading.classList.add('hidden');
    aiResultCard.classList.remove('hidden');
    reExplainBtn.classList.remove('hidden');

    // Suggested Answer & Confidence
    aiSuggestedAnswer.textContent = data.suggested_answer || 'Analysis Complete';
    const confVal = typeof data.confidence === 'number' ? Math.round(data.confidence * 100) : 95;
    aiConfidenceBadge.textContent = `${confVal}% Confident`;

    // Concept Summary
    if (data.concept_summary && data.concept_summary.trim().length > 0) {
      aiConceptSummaryWrap.classList.remove('hidden');
      aiConceptSummary.textContent = data.concept_summary;
    } else {
      aiConceptSummaryWrap.classList.add('hidden');
    }

    // Reasoning
    aiReasoningText.textContent = data.reasoning || 'No detailed walkthrough provided.';

    // Options Breakdown
    if (Array.isArray(data.options_analysis) && data.options_analysis.length > 0) {
      aiBreakdownWrap.classList.remove('hidden');
      aiBreakdownList.innerHTML = '';

      data.options_analysis.forEach(item => {
        const row = document.createElement('div');
        const isCorrect = String(item.status || '').toLowerCase() === 'correct';
        row.className = `ai-breakdown-item ${isCorrect ? 'correct' : 'incorrect'}`;

        const badge = document.createElement('span');
        badge.className = 'breakdown-badge';
        badge.textContent = `[${item.label || '•'}]`;

        const status = document.createElement('span');
        status.className = 'breakdown-status';
        status.textContent = item.status ? `${item.status}:` : '';

        const expl = document.createElement('span');
        expl.className = 'breakdown-expl';
        expl.textContent = item.explanation || '';

        row.appendChild(badge);
        row.appendChild(status);
        row.appendChild(expl);
        aiBreakdownList.appendChild(row);
      });
    } else {
      aiBreakdownWrap.classList.add('hidden');
    }
  }

  function checkCachedExplanation(questionId, model) {
    if (!questionId) return;
    const cacheKey = `ai_exp_${questionId}_${model || aiModelSelect.value}`;

    chrome.storage.local.get([cacheKey], (items) => {
      if (items && items[cacheKey]) {
        renderExplanation(items[cacheKey]);
      } else {
        // No cached explanation for this model/question yet
        aiResultCard.classList.add('hidden');
        reExplainBtn.classList.add('hidden');
      }
    });
  }

  async function triggerExplanation(forceRefresh = false) {
    if (!currentQuestionData || !currentQuestionData.questionText) {
      aiNotice.classList.remove('hidden');
      aiNoticeText.textContent = 'Please extract a valid question statement first.';
      return;
    }

    const selectedModel = aiModelSelect.value || 'qwen2.5-coder:7b';
    chrome.storage.local.set({ selectedAiModel: selectedModel });

    // UI Loading state
    aiNotice.classList.add('hidden');
    aiResultCard.classList.add('hidden');
    aiLoading.classList.remove('hidden');
    aiLoadingLabel.textContent = `Analyzing question concept with ${selectedModel}...`;
    explainBtn.disabled = true;
    reExplainBtn.disabled = true;

    chrome.runtime.sendMessage({
      action: 'REQUEST_AI_EXPLANATION',
      payload: {
        questionData: currentQuestionData,
        model: selectedModel,
        forceRefresh
      }
    }, (res) => {
      explainBtn.disabled = false;
      reExplainBtn.disabled = false;
      aiLoading.classList.add('hidden');

      if (chrome.runtime.lastError || !res || !res.success) {
        aiNotice.classList.remove('hidden');
        const err = res?.error || chrome.runtime.lastError?.message || 'Failed to communicate with local Ollama service.';
        aiNoticeText.innerHTML = `AI Analysis failed: ${err}. Ensure Ollama is running (<code>ollama serve</code>).`;
        return;
      }

      renderExplanation(res.explanation);
    });
  }

  explainBtn.addEventListener('click', () => triggerExplanation(false));
  reExplainBtn.addEventListener('click', () => triggerExplanation(true));

  aiModelSelect.addEventListener('change', () => {
    chrome.storage.local.set({ selectedAiModel: aiModelSelect.value });
    if (currentQuestionData) {
      checkCachedExplanation(currentQuestionData.questionId, aiModelSelect.value);
    }
  });

  // --------------------------------------------------------------------------
  // Question Rendering
  // --------------------------------------------------------------------------

  function renderQuestion(data) {
    currentQuestionData = data;

    if (!data || !data.success) {
      questionPreviewCard.classList.add('hidden');
      sessionCard.classList.add('hidden');
      emptyState.classList.remove('hidden');

      if (data && data.reason) {
        portalNotice.classList.remove('hidden');
        portalNoticeText.textContent = data.reason;
        portalNotice.className = 'alert-banner';
      }

      diagJson.textContent = JSON.stringify(data || { error: 'No data' }, null, 2);
      diagUrl.textContent = data?.url || '-';
      diagHash.textContent = '-';
      return;
    }

    portalNotice.classList.add('hidden');
    emptyState.classList.add('hidden');
    questionPreviewCard.classList.remove('hidden');
    sessionCard.classList.remove('hidden');

    // Meta Badges
    const qNumText = data.questionNumber
      ? `Q${data.questionNumber}${data.totalQuestions ? ` of ${data.totalQuestions}` : ''}`
      : (data.questionProgressText || 'Active');
    questionNumBadge.textContent = qNumText;
    formatBadge.textContent = formatTypeName(data.format);
    optionsCountBadge.textContent = `${data.optionsCount || (data.options || []).length} Options`;

    // Statement & Timestamp
    questionStatement.textContent = data.questionText || '(No question text detected)';
    timestampBadge.textContent = formatTime(data.timestamp);

    // Media / Images
    questionMedia.innerHTML = '';
    if (data.images && data.images.length > 0) {
      questionMedia.classList.remove('hidden');
      data.images.forEach(imgData => {
        const img = document.createElement('img');
        img.src = imgData.src;
        img.alt = imgData.alt || 'Question diagram';
        questionMedia.appendChild(img);
      });
    } else {
      questionMedia.classList.add('hidden');
    }

    // Selection Summary
    const selected = (data.options || []).filter(o => o.isSelected);
    if (selected.length > 0) {
      selectionSummary.textContent = `Selected: ${selected.map(o => o.label).join(', ')}`;
      selectionSummary.className = 'selection-summary has-selection';
    } else {
      selectionSummary.textContent = 'No option selected';
      selectionSummary.className = 'selection-summary';
    }

    // Options Rendering
    optionsList.innerHTML = '';
    (data.options || []).forEach(opt => {
      const item = document.createElement('div');
      item.className = `option-item ${opt.isSelected ? 'selected' : ''}`;

      const badge = document.createElement('span');
      badge.className = 'option-badge';
      badge.textContent = opt.label || '•';

      const text = document.createElement('div');
      text.className = 'option-text';
      text.textContent = opt.text || '(Empty option)';

      item.appendChild(badge);
      item.appendChild(text);

      if (opt.isSelected) {
        const check = document.createElement('span');
        check.className = 'option-check';
        check.innerHTML = '&#10003;';
        item.appendChild(check);
      }

      optionsList.appendChild(item);
    });

    // Check for cached AI explanation on active question
    checkCachedExplanation(data.questionId, aiModelSelect.value);

    // Diagnostics
    diagUrl.textContent = data.url || '-';
    diagHash.textContent = data.questionId || '-';
    diagJson.textContent = JSON.stringify(data, null, 2);
  }

  // --------------------------------------------------------------------------
  // Communication with Content Script
  // --------------------------------------------------------------------------

  async function checkTabAndInitialize() {
    showLoading(true);

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0 || !tabs[0].url) {
        setStatus('standby', 'No Tab');
        showLoading(false);
        return;
      }

      const activeUrl = tabs[0].url;

      if (!activeUrl.startsWith('https://my.newtonschool.co')) {
        setStatus('warning', 'Unsupported Page');
        portalNotice.classList.remove('hidden');
        portalNotice.className = 'alert-banner warning';
        portalNoticeText.textContent = 'Please navigate to https://my.newtonschool.co/ to use NewtonPilot.';
        showLoading(false);
        return;
      }

      setStatus('connected', 'Portal Active');

      // Check current state from content script
      const res = await NewtonMessaging.sendToActiveTab({
        action: NewtonMessaging.ACTIONS.GET_CURRENT_STATE
      });

      showLoading(false);

      if (res.success && res.data) {
        renderQuestion(res.data.data || res.data);
        if (res.data.isMonitoring !== undefined) {
          autoMonitorToggle.checked = res.data.isMonitoring;
        }
      } else {
        // Fallback to cached local storage
        chrome.storage.local.get(['lastExtractedQuestion'], (items) => {
          if (items && items.lastExtractedQuestion) {
            renderQuestion(items.lastExtractedQuestion);
          } else {
            renderQuestion(null);
          }
        });
      }
    } catch (err) {
      console.error('[NewtonPilot] Tab init failed:', err);
      showLoading(false);
      setStatus('standby', 'Standby');
      renderQuestion(null);
    }
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  inspectBtn.addEventListener('click', async () => {
    showLoading(true);
    const res = await NewtonMessaging.sendToActiveTab({
      action: NewtonMessaging.ACTIONS.INSPECT_QUESTION
    });
    showLoading(false);

    if (res.success && res.data) {
      renderQuestion(res.data.data || res.data);
    } else {
      portalNotice.classList.remove('hidden');
      portalNoticeText.textContent = res.error || 'Inspection failed. Ensure you are on a quiz page.';
      portalNotice.className = 'alert-banner warning';
    }
  });

  refreshBtn.addEventListener('click', () => {
    checkTabAndInitialize();
    checkOllamaStatus();
  });

  autoMonitorToggle.addEventListener('change', async (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.local.set({ autoMonitorEnabled: isEnabled });

    const action = isEnabled
      ? NewtonMessaging.ACTIONS.START_MONITORING
      : NewtonMessaging.ACTIONS.STOP_MONITORING;

    await NewtonMessaging.sendToActiveTab({ action });
  });

  async function copyJsonToClipboard(btn) {
    if (!currentQuestionData) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentQuestionData, null, 2));
      const originalText = btn.innerHTML;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 1500);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  }

  copyJsonBtn.addEventListener('click', () => copyJsonToClipboard(copyJsonBtn));
  if (copyJsonTopBtn) {
    copyJsonTopBtn.addEventListener('click', () => copyJsonToClipboard(copyJsonTopBtn));
  }

  // Listen for live background or content script broadcasts
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.action === NewtonMessaging.ACTIONS.QUESTION_UPDATED) {
        renderQuestion(message.payload);
      }
    });
  }

  // Initial Load
  checkTabAndInitialize();
  checkOllamaStatus();
});
