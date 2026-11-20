/**
 * NewtonPilot - Question Extraction Engine
 * Modular, resilient extraction for React-based SPAs and assessment portals.
 * Uses tiered semantic fallbacks and avoids brittle classname dependencies.
 */

const NewtonExtractor = (() => {
  'use strict';

  /**
   * Helper: Check if an element is visible in the DOM.
   * @param {Element} el 
   * @returns {boolean}
   */
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      el.offsetWidth > 0 &&
      el.offsetHeight > 0
    );
  }

  /**
   * Helper: Clean text from excess whitespace while preserving linebreaks in code.
   * @param {string} str 
   * @returns {string}
   */
  function cleanText(str) {
    if (!str) return '';
    return str
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Helper: Clean portal boilerplate (breadcrumbs, action buttons, progress bars)
   * from the question statement.
   * @param {string} rawText 
   * @returns {string}
   */
  function cleanQuestionStatement(rawText) {
    if (!rawText) return '';
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const filtered = [];

    const ignorePatterns = [
      /^Submit Quiz$/i,
      /^QUESTION\s*\d+\s*\/\s*\d+$/i,
      /^Question\s*\d+\s*(?:of|\/)\s*(\d+)?$/i,
      /^Mark for review$/i,
      /^Clear Selection$/i,
      /^Next$/i,
      /^Previous$/i
    ];

    for (const line of lines) {
      // Stop taking question statement lines if options block is reached
      if (/^[A-D]$/i.test(line) || /^[A-D][\.\)\:\-]\s+/i.test(line)) {
        break;
      }
      if (ignorePatterns.some(pat => pat.test(line))) continue;
      filtered.push(line);
    }

    // Skip course topic/module breadcrumb if followed by actual question
    if (filtered.length > 1 && /(?:Revision|Assessment|Module|Lecture|Track)\s*$/i.test(filtered[0])) {
      filtered.shift();
    }

    return filtered.join('\n\n').trim();
  }

  /**
   * Helper: Calculate lightweight hash for question deduplication.
   * @param {string} text 
   * @returns {string}
   */
  function quickHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return 'q_' + Math.abs(hash).toString(36);
  }

  /**
   * Detect Question Progress / Question Number (e.g., "Question 3 of 15" or "Q4").
   * @param {Element} root
   * @returns {{number: number|null, total: number|null, rawText: string|null}}
   */
  function detectQuestionNumber(root = document) {
    const regexPatterns = [
      /\bQUESTION\s*#?\s*(\d+)\s*(?:of|\/)\s*(\d+)\b/i,
      /Question\s*#?\s*(\d+)\s*(?:of|\/)\s*(\d+)/i,
      /Q(?:uestion)?\.?\s*(\d+)\s*(?:of|\/)\s*(\d+)/i,
      /(\d+)\s*(?:of|\/)\s*(\d+)\s*(?:Questions?)?/i,
      /Question\s*#?\s*(\d+)/i,
      /Q\.?\s*(\d+)\b/i
    ];

    // Priority 1: Check full visible text of page for "QUESTION 1/5"
    const bodyText = (root && root.innerText) || (typeof document !== 'undefined' && document.body && document.body.innerText) || '';
    for (const pattern of regexPatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        return {
          number: parseInt(match[1], 10),
          total: match[2] ? parseInt(match[2], 10) : null,
          rawText: cleanText(match[0])
        };
      }
    }

    const candidates = [
      ...root.querySelectorAll(
        '[class*="header" i], [class*="progress" i], [class*="badge" i], [class*="count" i], [class*="title" i], [aria-label*="question" i]'
      ),
      ...document.querySelectorAll('header, nav, [role="navigation"], [class*="breadcrumb" i]')
    ];

    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const text = el.innerText || el.textContent || '';
      for (const pattern of regexPatterns) {
        const match = text.match(pattern);
        if (match) {
          return {
            number: parseInt(match[1], 10),
            total: match[2] ? parseInt(match[2], 10) : null,
            rawText: cleanText(match[0])
          };
        }
      }
    }

    return { number: null, total: null, rawText: null };
  }

  /**
   * Find the main question container element.
   * @returns {Element|null}
   */
  function findQuestionContainer() {
    // Priority Tier 1: Explicit assessment / question containers
    const primarySelectors = [
      '[data-testid*="question" i]',
      '[data-cy*="question" i]',
      '[class*="question-container" i]',
      '[class*="problem-container" i]',
      '[class*="assessment-question" i]',
      '[class*="mcq-question" i]',
      '[class*="quiz-card" i]',
      '[role="region"][aria-label*="question" i]',
      'main [class*="question" i]'
    ];

    for (const sel of primarySelectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return el;
    }

    // Priority Tier 2: Container of radio/checkbox options
    const inputGroup = document.querySelector(
      '[role="radiogroup"], [class*="options-container" i], [class*="choices" i], [class*="answers" i]'
    );
    if (inputGroup && isVisible(inputGroup)) {
      // Ascend to find the parent holding both question text and options
      let parent = inputGroup.parentElement;
      for (let i = 0; i < 4 && parent && parent !== document.body; i++) {
        if (parent.querySelector('h1, h2, h3, h4, [class*="question" i], p')) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return inputGroup.parentElement;
    }

    // Priority Tier 3: Search within <main>, <article>, or page body
    const mainEl = document.querySelector('main, article, [role="main"], #root, #__next');
    return mainEl || document.body;
  }

  /**
   * Extract question body text and inline media.
   * @param {Element} container 
   * @returns {{text: string, images: Array<{src: string, alt: string}>}}
   */
  function extractQuestionBody(container) {
    if (!container) return { text: '', images: [] };

    // Common question text selectors
    const textSelectors = [
      '[class*="question-title" i]',
      '[class*="question-text" i]',
      '[class*="problem-description" i]',
      '[class*="statement" i]',
      '[class*="mcq-question" i]',
      '[class*="markdown" i]',
      '.prose',
      'h1, h2, h3, h4',
      '[data-testid*="question-title" i]',
      '[class*="question" i]'
    ];

    let questionEl = null;
    for (const sel of textSelectors) {
      const candidates = container.querySelectorAll(sel);
      for (const el of candidates) {
        if (isVisible(el) && cleanText(el.innerText || el.textContent).length > 5) {
          questionEl = el;
          break;
        }
      }
      if (questionEl) break;
    }

    let text = '';
    const images = [];

    if (questionEl) {
      text = cleanText(questionEl.innerText || questionEl.textContent);
      // Collect images in question body
      questionEl.querySelectorAll('img').forEach(img => {
        if (img.src && isVisible(img)) {
          images.push({
            src: img.src,
            alt: img.alt || 'Question illustration'
          });
        }
      });
    } else {
      // Fallback: look for paragraphs before options container
      const paragraphs = Array.from(container.querySelectorAll('p, div'))
        .filter(el => isVisible(el) && cleanText(el.innerText).length > 10)
        .filter(el => !el.closest('[role="radiogroup"], [class*="option" i], [class*="choice" i]'));

      if (paragraphs.length > 0) {
        text = cleanText(paragraphs[0].innerText);
      }
    }

    text = cleanQuestionStatement(text);

    return { text, images };
  }

  /**
   * Extract answer options from the container.
   * Handles native radio/checkboxes, ARIA roles, and custom React div/button options.
   * @param {Element} container 
   * @returns {Array<Object>}
   */
  function extractOptions(container) {
    if (!container) return [];

    const optionCandidates = [];

    // Strategy A: Native radio or checkbox inputs
    const nativeInputs = Array.from(container.querySelectorAll('input[type="radio"], input[type="checkbox"]'))
      .filter(input => isVisible(input) || isVisible(input.parentElement));

    if (nativeInputs.length >= 2) {
      nativeInputs.forEach((input, index) => {
        let labelText = '';
        let isSelected = input.checked;

        // Try associated label
        let labelEl = null;
        if (input.id) {
          const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(input.id) : input.id.replace(/["\\]/g, '\\$&');
          labelEl = document.querySelector(`label[for="${safeId}"]`);
        }
        if (!labelEl) {
          labelEl = input.closest('label');
        }

        if (labelEl) {
          labelText = cleanText(labelEl.innerText || labelEl.textContent);
          // If label contains checked state
          if (labelEl.classList.contains('selected') || labelEl.getAttribute('aria-checked') === 'true') {
            isSelected = true;
          }
        } else {
          // Check sibling elements
          const sibling = input.nextElementSibling || input.parentElement;
          if (sibling) {
            labelText = cleanText(sibling.innerText || sibling.textContent);
          }
        }

        const defaultLetter = String.fromCharCode(65 + index); // A, B, C, D...
        const parsedLabel = parseOptionLabel(labelText, defaultLetter);

        optionCandidates.push({
          id: input.value || `${input.id || 'opt'}-${index}`,
          label: parsedLabel.label,
          text: parsedLabel.text,
          isSelected,
          type: input.type,
          role: input.type === 'checkbox' ? 'checkbox' : 'radio'
        });
      });

      if (optionCandidates.length >= 2) {
        return optionCandidates;
      }
    }

    // Strategy B: ARIA roles (role="radio", role="checkbox", role="option")
    const ariaElements = Array.from(container.querySelectorAll('[role="radio"], [role="checkbox"], [role="option"]'))
      .filter(isVisible);

    if (ariaElements.length >= 2) {
      ariaElements.forEach((el, index) => {
        const isSelected =
          el.getAttribute('aria-checked') === 'true' ||
          el.getAttribute('aria-selected') === 'true' ||
          el.classList.contains('active') ||
          el.classList.contains('selected');

        const rawText = cleanText(el.innerText || el.textContent);
        const defaultLetter = String.fromCharCode(65 + index);
        const parsedLabel = parseOptionLabel(rawText, defaultLetter);

        optionCandidates.push({
          id: el.id || `aria-opt-${index}`,
          label: parsedLabel.label,
          text: parsedLabel.text,
          isSelected,
          type: el.getAttribute('role') || 'radio',
          role: el.getAttribute('role') || 'radio'
        });
      });

      if (optionCandidates.length >= 2) {
        return optionCandidates;
      }
    }

    // Strategy C: Custom class-based React components
    const customSelectors = [
      '[class*="option-item" i]',
      '[class*="choice-item" i]',
      '[class*="answer-option" i]',
      '[class*="option-wrapper" i]',
      '[class*="mcq-option" i]',
      '[class*="quiz-option" i]',
      'li[class*="option" i]',
      'button[class*="option" i]'
    ];

    for (const sel of customSelectors) {
      const elements = Array.from(container.querySelectorAll(sel)).filter(isVisible);
      if (elements.length >= 2) {
        elements.forEach((el, index) => {
          const isSelected =
            el.classList.contains('selected') ||
            el.classList.contains('active') ||
            el.classList.contains('checked') ||
            el.getAttribute('data-selected') === 'true' ||
            Boolean(el.querySelector('input:checked, [aria-checked="true"]'));

          const rawText = cleanText(el.innerText || el.textContent);
          const defaultLetter = String.fromCharCode(65 + index);
          const parsedLabel = parseOptionLabel(rawText, defaultLetter);

          optionCandidates.push({
            id: el.id || `custom-opt-${index}`,
            label: parsedLabel.label,
            text: parsedLabel.text,
            isSelected,
            type: 'custom',
            role: 'radio'
          });
        });
        break;
      }
    }

    return optionCandidates;
  }

  /**
   * Helper: Parse option label prefix (e.g. "A. Option Text" -> label: "A", text: "Option Text")
   * @param {string} fullText 
   * @param {string} fallbackLetter 
   * @returns {{label: string, text: string}}
   */
  function parseOptionLabel(fullText, fallbackLetter) {
    if (!fullText) return { label: fallbackLetter, text: '' };

    // Matches "A. Option", "A) Option", "A\nOption", "A Option"
    const prefixMatch = fullText.match(/^([A-D0-9])(?:[\.\)\:\-]\s*|\s+)(.*)$/s);
    if (prefixMatch) {
      let body = cleanText(prefixMatch[2]);
      // Remove any duplicate letter prefix (e.g. "A extend()" -> "extend()")
      body = body.replace(/^[A-D0-9][\.\)\:\-]?\s+/, '');
      return {
        label: prefixMatch[1].toUpperCase(),
        text: body || cleanText(prefixMatch[2])
      };
    }

    return {
      label: fallbackLetter,
      text: fullText
    };
  }

  /**
   * Determine question format based on options.
   * @param {Array<Object>} options 
   * @returns {'single_choice'|'multi_choice'|'true_false'|'unknown'}
   */
  function determineFormat(options) {
    if (!options || options.length === 0) return 'unknown';

    const hasCheckbox = options.some(opt => opt.type === 'checkbox' || opt.role === 'checkbox');
    if (hasCheckbox) return 'multi_choice';

    if (options.length === 2) {
      const texts = options.map(o => o.text.toLowerCase());
      if (
        (texts.includes('true') && texts.includes('false')) ||
        (texts.includes('yes') && texts.includes('no'))
      ) {
        return 'true_false';
      }
    }

    return 'single_choice';
  }

  /**
   * Main Public Method: Extract current question state from DOM.
   * @returns {Object} Structured question payload
   */
  function extractCurrentQuestion() {
    try {
      const url = window.location.href;
      const questionMeta = detectQuestionNumber(document);
      const container = findQuestionContainer();

      if (!container) {
        return {
          success: false,
          reason: 'No quiz question container located on current page.',
          url,
          timestamp: Date.now()
        };
      }

      const { text: questionText, images } = extractQuestionBody(container);
      const options = extractOptions(container);

      // Validate minimal question signal
      if (!questionText && options.length === 0) {
        return {
          success: false,
          reason: 'Assessment page detected, but question content is empty or still loading.',
          url,
          timestamp: Date.now()
        };
      }

      const format = determineFormat(options);
      const contentSignature = `${questionMeta.number || ''}|${questionText}|${options.map(o => o.text).join(';;')}`;
      const questionId = quickHash(contentSignature);

      return {
        success: true,
        questionId,
        questionNumber: questionMeta.number,
        totalQuestions: questionMeta.total,
        questionProgressText: questionMeta.rawText,
        questionText: questionText || '(Visual/Media Question)',
        format,
        images,
        options,
        optionsCount: options.length,
        hasSelection: options.some(o => o.isSelected),
        selectedOptions: options.filter(o => o.isSelected).map(o => o.label),
        url,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[NewtonPilot] Extraction error:', error);
      return {
        success: false,
        error: error.message || 'Unknown extraction error',
        url: window.location.href,
        timestamp: Date.now()
      };
    }
  }

  return {
    extractCurrentQuestion,
    findQuestionContainer,
    detectQuestionNumber
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NewtonExtractor;
}
if (typeof globalThis !== 'undefined') {
  globalThis.NewtonExtractor = NewtonExtractor;
}
