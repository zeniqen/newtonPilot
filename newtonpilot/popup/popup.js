/**
 * NewtonPilot - Popup Controller
 * Manages UI rendering, user actions, and communication with the active quiz tab.
 */

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  // DOM Elements
  const connectionStatus = document.getElementById('connectionStatus');
  const statusLabel = connectionStatus.querySelector('.status-label');
  const autoMonitorToggle = document.getElementById('autoMonitorToggle');
  const inspectBtn = document.getElementById('inspectBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const portalNotice = document.getElementById('portalNotice');
  const portalNoticeText = document.getElementById('portalNoticeText');

  const sessionCard = document.getElementById('sessionCard');
  const questionNumBadge = document.getElementById('questionNumBadge');
  const formatBadge = document.getElementById('formatBadge');
  const optionsCountBadge = document.getElementById('optionsCountBadge');

  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const questionPreviewCard = document.getElementById('questionPreviewCard');
  const timestampBadge = document.getElementById('timestampBadge');
  const questionStatement = document.getElementById('questionStatement');
  const questionMedia = document.getElementById('questionMedia');
  const selectionSummary = document.getElementById('selectionSummary');
  const optionsList = document.getElementById('optionsList');

  const toggleDiagBtn = document.getElementById('toggleDiagBtn');
  const diagArrow = document.getElementById('diagArrow');
  const diagContent = document.getElementById('diagContent');
  const diagUrl = document.getElementById('diagUrl');
  const diagHash = document.getElementById('diagHash');
  const diagJson = document.getElementById('diagJson');
  const copyJsonBtn = document.getElementById('copyJsonBtn');

  let currentQuestionData = null;

  // --------------------------------------------------------------------------
  // Status & UI State Management
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
  });

  autoMonitorToggle.addEventListener('change', async (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.local.set({ autoMonitorEnabled: isEnabled });

    const action = isEnabled
      ? NewtonMessaging.ACTIONS.START_MONITORING
      : NewtonMessaging.ACTIONS.STOP_MONITORING;

    await NewtonMessaging.sendToActiveTab({ action });
  });

  toggleDiagBtn.addEventListener('click', () => {
    const isHidden = diagContent.classList.toggle('hidden');
    diagArrow.classList.toggle('open', !isHidden);
  });

  copyJsonBtn.addEventListener('click', async () => {
    if (!currentQuestionData) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentQuestionData, null, 2));
      const originalText = copyJsonBtn.textContent;
      copyJsonBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyJsonBtn.textContent = originalText;
      }, 1500);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  });

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
});
