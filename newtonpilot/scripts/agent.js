/**
 * NewtonPilot - Autonomous Agent Controller
 * Implements the 9-step autonomous workflow:
 * 1. Activate -> 2. Detect -> 3. Extract -> 4. Reason -> 5. Decide -> 6. Interact -> 7. Navigate -> 8. Repeat -> 9. Terminate
 */

const NewtonAgent = (() => {
  'use strict';

  const AGENT_STATES = Object.freeze({
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
  });

  let state = AGENT_STATES.IDLE;
  let isRunning = false;
  let isStepping = false;
  let shouldPause = false;
  let shouldStop = false;
  let stepDelayMs = 1500;
  let selectedModel = 'qwen2.5-coder:7b';
  let logs = [];
  let currentStep = 0;
  let totalSteps = 0;
  let lastAction = 'Ready';

  function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = { timestamp, message, type };
    logs.push(entry);
    if (logs.length > 50) logs.shift();
    console.log(`[NewtonAgent] [${type.toUpperCase()}] ${message}`);
    broadcastState();
  }

  function broadcastState() {
    if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'AGENT_STATE_UPDATED',
        payload: getStatus()
      }).catch(() => {});
    }
  }

  function getStatus() {
    return {
      state,
      isRunning,
      currentStep,
      totalSteps,
      lastAction,
      selectedModel,
      stepDelayMs,
      recentLogs: logs.slice(-12)
    };
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute exactly ONE question cycle:
   * Detect -> Extract -> Reason -> Decide -> Interact (Click Option) -> Check Completion -> Optional Navigate
   * @param {boolean} shouldAutoNavigate - Whether to navigate to next question afterwards
   * @returns {Promise<{success: boolean, isFinal: boolean, questionNumber: number, answer: string, error?: string}>}
   */
  async function executeStep(shouldAutoNavigate = false) {
    lastAction = 'Detecting & Extracting Question';
    broadcastState();

    // 1. Detect & Extract
    const questionData = window.NewtonExtractor?.extractCurrentQuestion();
    if (!questionData || !questionData.success) {
      const err = questionData?.reason || 'Could not extract question from active page';
      log(`Extraction failed: ${err}`, 'error');
      return { success: false, error: err };
    }

    currentStep = questionData.questionNumber || currentStep + 1;
    totalSteps = questionData.totalQuestions || totalSteps;
    const shortStmt = (questionData.questionText || '').slice(0, 55).replace(/\n/g, ' ');
    log(`Q${currentStep}/${totalSteps || '?'}: "${shortStmt}..."`, 'info');

    // Diagram notice if model lacks vision support
    if (questionData.images && questionData.images.length > 0) {
      const isVision = /(?:vision|llava|bakllava|vl)/i.test(selectedModel);
      if (!isVision) {
        log(`Notice: Diagram detected in Q${currentStep}. Selected model "${selectedModel}" is text-only; vision model recommended.`, 'warning');
      }
    }

    // 2. Reason & Decide via Ollama
    lastAction = `Reasoning with ${selectedModel}...`;
    broadcastState();

    let explanation;
    try {
      const res = await new Promise((resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
          return reject(new Error('Extension runtime unavailable'));
        }
        chrome.runtime.sendMessage({
          action: 'REQUEST_AI_EXPLANATION',
          payload: {
            questionData,
            model: selectedModel,
            forceRefresh: false
          }
        }, (response) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!response || !response.success) return reject(new Error(response?.error || 'AI generation failed'));
          resolve(response.explanation);
        });
      });
      explanation = res;
    } catch (err) {
      log(`Reasoning failed: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }

    const suggested = explanation.suggested_answer || '';
    const confidence = Math.round((explanation.confidence || 0.95) * 100);
    const isShortAnswer = questionData.format === 'short_answer' ||
                          questionData.hasTextInput ||
                          (!questionData.options || questionData.options.length === 0);

    // 3A. Short Answer / Direct Text Input Question
    if (isShortAnswer) {
      // Clean short answer string (strip accidental "Option D: 101" or prefixes)
      let cleanAnswer = (suggested || '').trim();
      cleanAnswer = cleanAnswer.replace(/^Option\s+[A-D][:.\-\s]*/i, '');
      cleanAnswer = cleanAnswer.replace(/^Answer[:.\-\s]*/i, '');
      cleanAnswer = cleanAnswer.replace(/^["'`]|["'`]$/g, '').trim();

      log(`AI Decided (Short Answer): "${cleanAnswer}" (${confidence}% confidence)`, 'success');

      lastAction = `Filling Input: "${cleanAnswer}"...`;
      broadcastState();

      if (!window?.NewtonExecutor?.fillTextInput) {
        log('NewtonExecutor.fillTextInput method unavailable', 'error');
        return { success: false, error: 'fillTextInput unavailable' };
      }

      const fillRes = await window.NewtonExecutor.fillTextInput(cleanAnswer);
      if (!fillRes.success) {
        log(`Failed to fill answer: ${fillRes.error}`, 'error');
        return { success: false, error: fillRes.error };
      }

      log(`Successfully entered answer "${cleanAnswer}" into text field`, 'success');

      // 4. Terminate Check (Check if this was the final question)
      const completion = window.NewtonExecutor.checkCompletion({
        number: currentStep,
        total: totalSteps
      });

      if (completion.isComplete) {
        log(`Completion detected: ${completion.reason}`, 'success');
        lastAction = 'Assessment Complete (Safely Stopped)';
        state = AGENT_STATES.COMPLETED;
        isRunning = false;
        broadcastState();
        return { success: true, isFinal: true, questionNumber: currentStep, answer: cleanAnswer };
      }

      // 5. Navigate (Click Next button to move forward)
      if (shouldAutoNavigate) {
        lastAction = 'Navigating to next question...';
        broadcastState();
        await sleep(stepDelayMs);

        const navRes = await window.NewtonExecutor.clickNext();
        if (!navRes.success) {
          if (navRes.reachedEnd) {
            log('Final question reached (Next unavailable). Stopping.', 'success');
            state = AGENT_STATES.COMPLETED;
            isRunning = false;
            broadcastState();
            return { success: true, isFinal: true, questionNumber: currentStep, answer: cleanAnswer };
          } else {
            log(`Navigation failed: ${navRes.error}`, 'error');
            return { success: false, error: navRes.error };
          }
        }
      }

      return { success: true, isFinal: false, questionNumber: currentStep, answer: cleanAnswer };
    }

    // 3B. Standard MCQ Option Question
    const match = suggested.match(/\b([A-D])\b/i);
    const targetLetter = match ? match[1].toUpperCase() : null;

    log(`AI Decided: ${suggested} (${confidence}% confidence)`, 'success');

    if (!targetLetter) {
      log(`Could not identify option letter from: "${suggested}"`, 'error');
      return { success: false, error: 'Invalid answer letter from model' };
    }

    // 3. Interact (Locate and click option)
    lastAction = `Clicking Option ${targetLetter}...`;
    broadcastState();

    const targetOpt = (questionData.options || []).find(o => o.label === targetLetter);
    const optText = targetOpt ? targetOpt.text : '';

    const clickRes = await window.NewtonExecutor.clickOption(targetLetter, optText);
    if (!clickRes.success) {
      log(`Failed to click Option ${targetLetter}: ${clickRes.error}`, 'error');
      return { success: false, error: clickRes.error };
    }
    log(`Successfully selected Option ${targetLetter}`, 'success');

    // 4. Terminate Check (Check if this was the final question)
    const completion = window.NewtonExecutor.checkCompletion({
      number: currentStep,
      total: totalSteps
    });

    if (completion.isComplete) {
      log(`Completion detected: ${completion.reason}`, 'success');
      lastAction = 'Assessment Complete (Safely Stopped)';
      state = AGENT_STATES.COMPLETED;
      isRunning = false;
      broadcastState();
      return { success: true, isFinal: true, questionNumber: currentStep, answer: targetLetter };
    }

    // 5. Navigate (Click Next button to move forward)
    if (shouldAutoNavigate) {
      lastAction = 'Navigating to next question...';
      broadcastState();
      await sleep(stepDelayMs);

      const navRes = await window.NewtonExecutor.clickNext();
      if (!navRes.success) {
        if (navRes.reachedEnd) {
          log('Final question reached (Next unavailable). Stopping.', 'success');
          state = AGENT_STATES.COMPLETED;
          isRunning = false;
          broadcastState();
          return { success: true, isFinal: true, questionNumber: currentStep, answer: targetLetter };
        } else {
          log(`Navigation failed: ${navRes.error}`, 'error');
          return { success: false, error: navRes.error };
        }
      }

      // Wait for React DOM to render next question
      await sleep(stepDelayMs);
    }

    return { success: true, isFinal: false, questionNumber: currentStep, answer: targetLetter };
  }

  /**
   * Run continuous autonomous loop until completed, paused, or stopped.
   */
  async function runAutonomousLoop() {
    if (isRunning) return;
    isRunning = true;
    shouldPause = false;
    shouldStop = false;
    state = AGENT_STATES.RUNNING;
    log(`Autonomous Pilot Started [Model: ${selectedModel}, Delay: ${stepDelayMs}ms]`, 'info');

    while (isRunning && !shouldStop) {
      if (shouldPause) {
        state = AGENT_STATES.PAUSED;
        lastAction = 'Paused by user';
        log('Autonomous loop paused.', 'warning');
        isRunning = false;
        broadcastState();
        break;
      }

      const stepResult = await executeStep(true);

      if (!stepResult.success) {
        state = AGENT_STATES.ERROR;
        lastAction = `Error: ${stepResult.error}`;
        isRunning = false;
        broadcastState();
        break;
      }

      if (stepResult.isFinal) {
        state = AGENT_STATES.COMPLETED;
        lastAction = 'Assessment Completed Successfully!';
        log('🎉 Assessment Completed! All questions answered.', 'success');
        isRunning = false;
        broadcastState();
        break;
      }
    }
  }

  function start(config = {}) {
    if (config.model) selectedModel = config.model;
    if (config.stepDelayMs) stepDelayMs = config.stepDelayMs;
    runAutonomousLoop();
    return getStatus();
  }

  function pause() {
    shouldPause = true;
    lastAction = 'Pausing...';
    broadcastState();
    return getStatus();
  }

  function toggle(config = {}) {
    if (isRunning) {
      return pause();
    } else {
      return start(config);
    }
  }

  function stop() {
    shouldStop = true;
    isRunning = false;
    state = AGENT_STATES.IDLE;
    lastAction = 'Stopped by user';
    log('Autonomous Pilot stopped by user.', 'warning');
    broadcastState();
    return getStatus();
  }

  async function step(config = {}) {
    if (isStepping) {
      log('Step execution already in progress, skipping duplicate trigger.', 'warning');
      return getStatus();
    }
    isStepping = true;
    try {
      if (config.model) selectedModel = config.model;
      const res = await executeStep(config.autoNavigate ?? false);
      return { ...getStatus(), stepResult: res };
    } finally {
      isStepping = false;
    }
  }

  return {
    start,
    pause,
    stop,
    step,
    toggle,
    getStatus,
    executeStep,
    STATES: AGENT_STATES
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NewtonAgent;
}
if (typeof globalThis !== 'undefined') {
  globalThis.NewtonAgent = NewtonAgent;
}
