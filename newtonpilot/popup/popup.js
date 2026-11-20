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
  const optionsHeaderLabel = document.getElementById('optionsHeaderLabel');
  const selectionSummary = document.getElementById('selectionSummary');
  const optionsList = document.getElementById('optionsList');
  const shortAnswerCard = document.getElementById('shortAnswerCard');
  const shortAnswerPlaceholder = document.getElementById('shortAnswerPlaceholder');

  // Phase 2 AI Elements
  const aiConnectionStatus = document.getElementById('aiConnectionStatus');
  const aiStatusText = document.getElementById('aiStatusText');
  const aiModelSelect = document.getElementById('aiModelSelect');
  const explainBtn = document.getElementById('explainBtn');
  const reExplainBtn = document.getElementById('reExplainBtn');
  const aiNotice = document.getElementById('aiNotice');
  const aiNoticeText = document.getElementById('aiNoticeText');
  const aiVisionNotice = document.getElementById('aiVisionNotice');
  const aiVisionNoticeText = document.getElementById('aiVisionNoticeText');
  const aiLoading = document.getElementById('aiLoading');
  const aiLoadingLabel = document.getElementById('aiLoadingLabel');
  const aiResultCard = document.getElementById('aiResultCard');
  const suggestedBadgeLabel = document.getElementById('suggestedBadgeLabel');
  const aiSuggestedAnswer = document.getElementById('aiSuggestedAnswer');
  const fillInputBtn = document.getElementById('fillInputBtn');
  const aiConfidenceBadge = document.getElementById('aiConfidenceBadge');
  const aiConceptSummaryWrap = document.getElementById('aiConceptSummaryWrap');
  const aiConceptSummary = document.getElementById('aiConceptSummary');
  const aiReasoningText = document.getElementById('aiReasoningText');
  const aiBreakdownWrap = document.getElementById('aiBreakdownWrap');
  const aiBreakdownList = document.getElementById('aiBreakdownList');

  // Tab Navigation Elements
  const tabQuestionBtn = document.getElementById('tabQuestionBtn');
  const tabAgentBtn = document.getElementById('tabAgentBtn');
  const tabDiagBtn = document.getElementById('tabDiagBtn');
  const questionTabView = document.getElementById('questionTabView');
  const agentTabView = document.getElementById('agentTabView');
  const diagTabView = document.getElementById('diagTabView');

  // Diagnostics Tab Elements
  const diagUrl = document.getElementById('diagUrl');
  const diagHash = document.getElementById('diagHash');
  const diagJson = document.getElementById('diagJson');
  const copyJsonBtn = document.getElementById('copyJsonBtn');
  const copyJsonTopBtn = document.getElementById('copyJsonTopBtn');

  // Auto-Pilot Elements
  const agentStateBadge = document.getElementById('agentStateBadge');
  const agentProgressBadge = document.getElementById('agentProgressBadge');
  const agentProgressBar = document.getElementById('agentProgressBar');
  const agentActionBox = document.getElementById('agentActionBox');
  const actionExpandHint = document.querySelector('.action-expand-hint');
  const agentActionText = document.getElementById('agentActionText');
  const agentVisionBadge = document.getElementById('agentVisionBadge');
  const agentToggleBtn = document.getElementById('agentToggleBtn');
  const agentToggleText = document.getElementById('agentToggleText');
  const agentStepBtn = document.getElementById('agentStepBtn');
  const agentStopBtn = document.getElementById('agentStopBtn');
  const agentDelaySelect = document.getElementById('agentDelaySelect');
  const agentModelLabel = document.getElementById('agentModelLabel');
  const clearAgentLogsBtn = document.getElementById('clearAgentLogsBtn');
  const agentLogFeed = document.getElementById('agentLogFeed');

  let currentQuestionData = null;
  let isOllamaOnline = false;
  let currentAgentStatus = null;

  // --------------------------------------------------------------------------
  // Tab Navigation
  // --------------------------------------------------------------------------

  function switchTab(tabName) {
    [tabQuestionBtn, tabAgentBtn, tabDiagBtn].forEach(b => b.classList.remove('active'));
    [questionTabView, agentTabView, diagTabView].forEach(v => v.classList.add('hidden'));

    if (tabName === 'question') {
      tabQuestionBtn.classList.add('active');
      questionTabView.classList.remove('hidden');
    } else if (tabName === 'agent') {
      tabAgentBtn.classList.add('active');
      agentTabView.classList.remove('hidden');
      fetchAgentStatus();
    } else {
      tabDiagBtn.classList.add('active');
      diagTabView.classList.remove('hidden');
    }
  }

  tabQuestionBtn.addEventListener('click', () => switchTab('question'));
  tabAgentBtn.addEventListener('click', () => switchTab('agent'));
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
      case 'short_answer': return 'Short Answer';
      case 'single_choice': return 'Single Choice';
      case 'multi_choice': return 'Multi-Select';
      case 'true_false': return 'True / False';
      case 'unknown': return 'Direct Input';
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

            // Sort models so coder & vision models appear first
            const sortedModels = [...res.models].sort((a, b) => {
              const aIsCoder = a.includes('coder');
              const bIsCoder = b.includes('coder');
              if (aIsCoder && !bIsCoder) return -1;
              if (!aIsCoder && bIsCoder) return 1;
              return 0;
            });
            
            sortedModels.forEach(m => {
              const opt = document.createElement('option');
              opt.value = m;
              let label = m;
              if (m.includes('coder')) {
                label = `${m} (High Accuracy Code)`;
              } else if (/(?:vision|llava|bakllava|vl)/i.test(m)) {
                label = `${m} [Vision Enabled]`;
              } else if (m.includes(':1b')) {
                label = `${m} (Fast / Low Accuracy)`;
              }
              opt.textContent = label;

              if (savedModel ? m === savedModel : m.includes('qwen2.5-coder:7b') || m.includes('coder')) {
                opt.selected = true;
              }
              aiModelSelect.appendChild(opt);
            });

            // If nothing was selected, select first
            if (!aiModelSelect.value && sortedModels[0]) {
              aiModelSelect.value = sortedModels[0];
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

  let currentExplanationAnswer = '';

  function renderExplanation(data) {
    if (!data) return;

    aiLoading.classList.add('hidden');
    aiResultCard.classList.remove('hidden');
    reExplainBtn.classList.remove('hidden');

    const isShortAnswer = currentQuestionData?.format === 'short_answer' ||
                          currentQuestionData?.hasTextInput ||
                          (!currentQuestionData?.options || currentQuestionData.options.length === 0);

    let cleanAnswer = (data.suggested_answer || '').trim();
    if (isShortAnswer) {
      cleanAnswer = cleanAnswer.replace(/^Option\s+[A-D][:.\-\s]*/i, '');
      cleanAnswer = cleanAnswer.replace(/^Answer[:.\-\s]*/i, '');
      cleanAnswer = cleanAnswer.replace(/^["'`]|["'`]$/g, '').trim();
      suggestedBadgeLabel.textContent = 'PREDICTED OUTPUT';
      aiSuggestedAnswer.textContent = cleanAnswer || data.suggested_answer;
      if (fillInputBtn) fillInputBtn.classList.remove('hidden');
    } else {
      suggestedBadgeLabel.textContent = 'SUGGESTED ANSWER';
      aiSuggestedAnswer.textContent = data.suggested_answer || 'Analysis Complete';
      if (fillInputBtn) fillInputBtn.classList.add('hidden');
    }
    currentExplanationAnswer = cleanAnswer || data.suggested_answer;

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
    const isShortAnswer = data.format === 'short_answer' || data.hasTextInput || (!data.options || data.options.length === 0);
    formatBadge.textContent = isShortAnswer ? 'Short Answer' : formatTypeName(data.format);
    optionsCountBadge.textContent = isShortAnswer ? 'Text Input' : `${data.optionsCount || (data.options || []).length} Options`;

    // Statement & Timestamp
    questionStatement.textContent = data.questionText || '(No question text detected)';
    timestampBadge.textContent = formatTime(data.timestamp);

    // Media / Images & Vision Model Handling
    questionMedia.innerHTML = '';
    const hasImages = Array.isArray(data.images) && data.images.length > 0;
    if (hasImages) {
      questionMedia.classList.remove('hidden');
      data.images.forEach(imgData => {
        const img = document.createElement('img');
        img.src = imgData.src;
        img.alt = imgData.alt || 'Question diagram';
        questionMedia.appendChild(img);
      });

      // Show vision advisory banners
      if (aiVisionNotice) aiVisionNotice.classList.remove('hidden');
      if (agentVisionBadge) agentVisionBadge.classList.remove('hidden');

      const currentModel = aiModelSelect.value || '';
      const isCurrentVision = /(?:vision|llava|bakllava|vl)/i.test(currentModel);

      if (!isCurrentVision) {
        // Auto-detect if a vision model is available in the options
        const visionOption = Array.from(aiModelSelect.options).find(opt => /(?:vision|llava|bakllava|vl)/i.test(opt.value));
        if (visionOption) {
          aiModelSelect.value = visionOption.value;
          chrome.storage.local.set({ selectedAiModel: visionOption.value });
          if (agentModelLabel) agentModelLabel.textContent = visionOption.value;
          if (aiVisionNoticeText) {
            aiVisionNoticeText.textContent = `Diagram Detected · Auto-switched to ${visionOption.value}`;
          }
        } else {
          if (aiVisionNoticeText) {
            aiVisionNoticeText.textContent = 'Diagram Detected · No vision model found (run `ollama pull llava`)';
          }
        }
      } else {
        if (aiVisionNoticeText) {
          aiVisionNoticeText.textContent = `Diagram Detected · Vision Model Active (${currentModel})`;
        }
      }
    } else {
      questionMedia.classList.add('hidden');
      if (aiVisionNotice) aiVisionNotice.classList.add('hidden');
      if (agentVisionBadge) agentVisionBadge.classList.add('hidden');
    }

    // Selection / Input Summary & Option List Rendering
    if (isShortAnswer) {
      if (optionsHeaderLabel) optionsHeaderLabel.textContent = 'ANSWER INPUT';
      selectionSummary.textContent = data.inputValue ? `Entered: "${data.inputValue}"` : 'Awaiting input';
      selectionSummary.className = data.inputValue ? 'selection-summary has-selection' : 'selection-summary';

      optionsList.innerHTML = '';
      if (shortAnswerCard) {
        shortAnswerCard.classList.remove('hidden');
        if (shortAnswerPlaceholder) {
          shortAnswerPlaceholder.textContent = data.inputValue || data.inputPlaceholder || 'Enter your answer here';
          shortAnswerPlaceholder.className = data.inputValue ? 'value-text' : 'placeholder-text';
        }
      }
    } else {
      if (optionsHeaderLabel) optionsHeaderLabel.textContent = 'ANSWER OPTIONS';
      if (shortAnswerCard) shortAnswerCard.classList.add('hidden');

      const selected = (data.options || []).filter(o => o.isSelected);
      if (selected.length > 0) {
        selectionSummary.textContent = `Selected: ${selected.map(o => o.label).join(', ')}`;
        selectionSummary.className = 'selection-summary has-selection';
      } else {
        selectionSummary.textContent = 'No option selected';
        selectionSummary.className = 'selection-summary';
      }

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
    }

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

  if (fillInputBtn) {
    fillInputBtn.addEventListener('click', async () => {
      if (!currentExplanationAnswer) return;
      fillInputBtn.disabled = true;
      const prevText = fillInputBtn.textContent;
      fillInputBtn.textContent = 'Filling...';

      try {
        const res = await NewtonMessaging.sendToActiveTab({
          action: NewtonMessaging.ACTIONS.FILL_TEXT_ANSWER,
          payload: { answer: currentExplanationAnswer }
        });
        if (res?.data?.success || res?.success) {
          fillInputBtn.textContent = 'Filled!';
          setTimeout(() => {
            fillInputBtn.textContent = prevText;
            fillInputBtn.disabled = false;
          }, 1500);
        } else {
          fillInputBtn.textContent = 'Failed';
          setTimeout(() => {
            fillInputBtn.textContent = prevText;
            fillInputBtn.disabled = false;
          }, 1500);
        }
      } catch (err) {
        fillInputBtn.textContent = prevText;
        fillInputBtn.disabled = false;
      }
    });
  }

  // --------------------------------------------------------------------------
  // Auto-Pilot Controller
  // --------------------------------------------------------------------------

  function updateAgentUI(status) {
    if (!status) return;
    currentAgentStatus = status;

    const state = status.state || 'IDLE';
    agentStateBadge.textContent = state;
    agentStateBadge.className = `agent-state-badge ${state.toLowerCase()}`;

    // Progress
    const cur = status.currentStep || 0;
    const tot = status.totalSteps || 0;
    agentProgressBadge.textContent = tot > 0 ? `Question ${cur} of ${tot}` : `Question ${cur}`;
    const pct = tot > 0 ? Math.min(100, Math.round((cur / tot) * 100)) : 0;
    agentProgressBar.style.width = `${pct}%`;

    // Action text
    agentActionText.textContent = status.lastAction || 'Ready to run.';

    // Toggle button state
    if (status.isRunning) {
      agentToggleBtn.className = 'btn btn-pilot-start paused';
      agentToggleText.textContent = 'Pause Auto-Pilot';
      agentStopBtn.disabled = false;
      agentStepBtn.disabled = true;
    } else {
      agentToggleBtn.className = 'btn btn-pilot-start';
      agentToggleText.textContent = state === 'PAUSED' ? 'Resume Auto-Pilot' : 'Start Auto-Pilot';
      agentStopBtn.disabled = (state === 'IDLE' || state === 'COMPLETED');
      agentStepBtn.disabled = false;
    }

    // Model label
    if (status.selectedModel) {
      agentModelLabel.textContent = status.selectedModel;
    } else if (aiModelSelect?.value) {
      agentModelLabel.textContent = aiModelSelect.value;
    }

    // Render activity logs
    if (Array.isArray(status.recentLogs) && status.recentLogs.length > 0) {
      agentLogFeed.innerHTML = '';
      status.recentLogs.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'feed-item';

        const time = document.createElement('span');
        time.className = 'feed-time';
        time.textContent = entry.timestamp;

        const msg = document.createElement('span');
        msg.className = `feed-msg ${entry.type || 'info'}`;
        msg.textContent = entry.message;

        item.appendChild(time);
        item.appendChild(msg);
        agentLogFeed.appendChild(item);
      });
      agentLogFeed.scrollTop = agentLogFeed.scrollHeight;
    }
  }

  async function fetchAgentStatus() {
    const res = await NewtonMessaging.sendToActiveTab({
      action: NewtonMessaging.ACTIONS.GET_AGENT_STATUS
    });
    if (res && res.success && res.data && res.data.status) {
      updateAgentUI(res.data.status);
    }
  }

  agentToggleBtn.addEventListener('click', async () => {
    if (currentAgentStatus && currentAgentStatus.isRunning) {
      // Pause
      const res = await NewtonMessaging.sendToActiveTab({
        action: NewtonMessaging.ACTIONS.PAUSE_AUTONOMOUS_AGENT
      });
      if (res?.data?.status) updateAgentUI(res.data.status);
    } else {
      // Start or Resume
      const model = aiModelSelect.value || 'qwen2.5-coder:7b';
      const delay = parseInt(agentDelaySelect.value, 10) || 1500;
      const res = await NewtonMessaging.sendToActiveTab({
        action: NewtonMessaging.ACTIONS.START_AUTONOMOUS_AGENT,
        payload: { model, stepDelayMs: delay }
      });
      if (res?.data?.status) updateAgentUI(res.data.status);
    }
  });

  async function triggerAgentStep() {
    if (agentStepBtn.disabled) return;
    agentStepBtn.disabled = true;
    const prevContent = agentStepBtn.innerHTML;
    agentStepBtn.innerHTML = '<span class="spinner-sm"></span> Stepping...';
    agentActionText.textContent = 'Executing 1 Question Step...';

    try {
      const model = aiModelSelect.value || 'qwen2.5-coder:7b';
      const res = await NewtonMessaging.sendToActiveTab({
        action: NewtonMessaging.ACTIONS.STEP_AUTONOMOUS_AGENT,
        payload: { model, autoNavigate: false }
      });
      if (res?.data?.status) updateAgentUI(res.data.status);
    } catch (err) {
      console.warn('[NewtonPilot] Step error:', err);
    } finally {
      agentStepBtn.disabled = false;
      agentStepBtn.innerHTML = prevContent;
    }
  }

  agentStepBtn.addEventListener('click', triggerAgentStep);

  agentStopBtn.addEventListener('click', async () => {
    const res = await NewtonMessaging.sendToActiveTab({
      action: NewtonMessaging.ACTIONS.STOP_AUTONOMOUS_AGENT
    });
    if (res?.data?.status) updateAgentUI(res.data.status);
  });

  clearAgentLogsBtn.addEventListener('click', () => {
    agentLogFeed.innerHTML = '<div class="feed-empty-hint">Log feed cleared.</div>';
  });

  // Expandable action text card
  if (agentActionBox) {
    agentActionBox.addEventListener('click', () => {
      const isExpanded = agentActionBox.classList.toggle('expanded');
      if (actionExpandHint) {
        actionExpandHint.textContent = isExpanded ? 'Collapse ▴' : 'Expand ▾';
      }
    });
  }

  // Keyboard navigation shortcuts within popup
  document.addEventListener('keydown', (e) => {
    const activeTag = (document.activeElement?.tagName || '').toLowerCase();
    if (activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea') {
      return;
    }

    if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      triggerAgentStep();
    } else if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      agentToggleBtn.click();
    } else if ((e.key === 'i' || e.key === 'I') && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      inspectBtn.click();
    } else if (e.key === '1') {
      switchTab('question');
    } else if (e.key === '2') {
      switchTab('agent');
    } else if (e.key === '3') {
      switchTab('diag');
    }
  });

  // Listen for live background or content script broadcasts
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.action === NewtonMessaging.ACTIONS.QUESTION_UPDATED) {
        renderQuestion(message.payload);
      } else if (message?.action === NewtonMessaging.ACTIONS.AGENT_STATE_UPDATED) {
        updateAgentUI(message.payload);
      }
    });
  }

  // Initial Load
  checkTabAndInitialize();
  checkOllamaStatus();
  fetchAgentStatus();
});
