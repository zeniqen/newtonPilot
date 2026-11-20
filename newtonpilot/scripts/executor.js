/**
 * NewtonPilot - Action Executor & Navigation Engine
 * Handles precise DOM interaction, option selection, Next navigation,
 * and assessment completion detection.
 */

const NewtonExecutor = (() => {
  'use strict';

  function isVisible(el) {
    if (!el) return false;
    if (typeof window === 'undefined' || !window.getComputedStyle) return true;
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      el.offsetWidth > 0 &&
      el.offsetHeight > 0
    );
  }

  function simulateClick(element) {
    if (!element) return false;
    try {
      if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const mouseEvents = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const ev of mouseEvents) {
        element.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true, view: window }));
      }
      if (typeof element.click === 'function') {
        element.click();
      }
      return true;
    } catch (e) {
      if (typeof element.click === 'function') {
        element.click();
        return true;
      }
      return false;
    }
  }

  /**
   * Find option element corresponding to option label (e.g. 'A', 'B', 'C', 'D') or text.
   * @param {string} label - e.g. "D" or "Option D"
   * @param {string} [optionText] - Optional fallback text e.g. "append()"
   * @returns {Element|null}
   */
  function findOptionElement(label, optionText = '') {
    if (typeof document === 'undefined') return null;
    const cleanLabel = (label || '').match(/([A-D0-9])/i)?.[1]?.toUpperCase() || label;

    // 1. Check data-newton-option attribute (tagged during extraction)
    if (cleanLabel) {
      const tagged = document.querySelector(`[data-newton-option="${cleanLabel}"]`);
      if (tagged && isVisible(tagged)) return tagged;
    }

    // 2. Search options inside container
    const container = window?.NewtonExtractor?.findQuestionContainer?.() || document.body;
    if (!container) return null;
    
    // Look for radio/checkbox inputs
    const inputs = Array.from(container.querySelectorAll('input[type="radio"], input[type="checkbox"]')).filter(isVisible);
    if (cleanLabel && inputs.length > 0) {
      const idx = cleanLabel.charCodeAt(0) - 65; // A -> 0, B -> 1, C -> 2, D -> 3
      if (idx >= 0 && idx < inputs.length) {
        const input = inputs[idx];
        const labelEl = input.closest('label') || (input.id ? document.querySelector(`label[for="${input.id}"]`) : null);
        return labelEl || input;
      }
    }

    // Look for elements with option role or class
    const options = Array.from(container.querySelectorAll('[role="radio"], [role="checkbox"], [class*="option" i], [class*="choice" i]')).filter(isVisible);
    if (cleanLabel && options.length > 0) {
      // Find one whose text starts with the label (e.g. "D\nappend()" or "D. append()")
      const match = options.find(el => {
        const txt = el.innerText.trim();
        return new RegExp(`^${cleanLabel}[\\.\\)\\:\\s]`, 'i').test(txt) || txt.startsWith(cleanLabel);
      });
      if (match) return match;

      const idx = cleanLabel.charCodeAt(0) - 65;
      if (idx >= 0 && idx < options.length) {
        return options[idx];
      }
    }

    // 3. Fallback: match by option text
    if (optionText && optionText.trim().length > 2) {
      const cleanSnippet = optionText.trim().toLowerCase();
      const allDivs = Array.from(container.querySelectorAll('div, li, button, span')).filter(isVisible);
      const textMatch = allDivs.find(el => el.innerText && el.innerText.toLowerCase().includes(cleanSnippet));
      if (textMatch) {
        return textMatch.closest('[role="radio"], [role="checkbox"], [class*="option" i]') || textMatch;
      }
    }

    return null;
  }

  /**
   * Action Executor: Clicks the selected option.
   * @param {string} label - e.g. "D"
   * @param {string} [text] - optional option text
   * @returns {Promise<{success: boolean, clickedLabel: string, error?: string}>}
   */
  async function clickOption(label, text = '') {
    const cleanLabel = (label || '').match(/([A-D0-9])/i)?.[1]?.toUpperCase() || label;
    const el = findOptionElement(cleanLabel, text);
    if (!el) {
      return { success: false, clickedLabel: cleanLabel, error: `Could not locate DOM element for option ${cleanLabel}` };
    }

    const clicked = simulateClick(el);
    if (!clicked) {
      return { success: false, clickedLabel: cleanLabel, error: `Click dispatch failed on option ${cleanLabel}` };
    }

    // Allow React state update
    await new Promise(r => setTimeout(r, 150));

    return { success: true, clickedLabel: cleanLabel };
  }

  /**
   * Navigation Engine: Locates and clicks the "Next >" button.
   * @returns {Promise<{success: boolean, reachedEnd: boolean, error?: string}>}
   */
  async function clickNext() {
    if (typeof document === 'undefined') {
      return { success: false, reachedEnd: true, error: 'Document unavailable' };
    }
    if (typeof document === 'undefined') {
      return { isComplete: false };
    }

    const buttons = Array.from(document.querySelectorAll('button')).filter(isVisible);
    const nextBtn = buttons.find(b => {
      const txt = (b.innerText || '').trim();
      return /^(?:Next|Next\s*[>›»]|Save\s*&\s*Next)$/i.test(txt) && !b.disabled;
    });

    if (!nextBtn) {
      return { success: false, reachedEnd: true, error: 'Next button not found or disabled.' };
    }

    const clicked = simulateClick(nextBtn);
    if (!clicked) {
      return { success: false, reachedEnd: false, error: 'Failed to click Next button.' };
    }

    return { success: true, reachedEnd: false };
  }

  /**
   * Completion Detector: Detects if assessment has reached the final question.
   * @param {Object} [questionMeta]
   * @returns {{isComplete: boolean, reason?: string, questionNumber?: number, totalQuestions?: number}}
   */
  function checkCompletion(questionMeta) {
    if (questionMeta && questionMeta.number && questionMeta.total) {
      if (questionMeta.number >= questionMeta.total) {
        return {
          isComplete: true,
          reason: `Reached final question (${questionMeta.number} of ${questionMeta.total})`,
          questionNumber: questionMeta.number,
          totalQuestions: questionMeta.total
        };
      }
    }

    if (typeof document === 'undefined') {
      return { isComplete: false };
    }

    const buttons = Array.from(document.querySelectorAll('button')).filter(isVisible);
    const nextBtn = buttons.find(b => /^(?:Next|Next\s*[>›»])$/i.test((b.innerText || '').trim()));

    if (!nextBtn || nextBtn.disabled) {
      const submitBtn = buttons.find(b => /submit/i.test((b.innerText || '').trim()));
      if (submitBtn) {
        return {
          isComplete: true,
          reason: 'Next button unavailable and Submit Quiz detected (Final question).'
        };
      }
    }

    return { isComplete: false };
  }

  return {
    findOptionElement,
    clickOption,
    clickNext,
    checkCompletion,
    simulateClick
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NewtonExecutor;
}
if (typeof globalThis !== 'undefined') {
  globalThis.NewtonExecutor = NewtonExecutor;
}
