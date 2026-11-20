/**
 * Unit tests for NewtonExtractor
 * Run with: node newtonpilot/tests/extractor.test.js
 */

const assert = require('assert');
const NewtonExtractor = require('../scripts/extractor.js');

function createMockElement(tag, attrs = {}, text = '', children = []) {
  return {
    tagName: tag.toUpperCase(),
    attributes: attrs,
    innerText: text,
    textContent: text,
    children: children,
    classList: {
      contains: (cls) => (attrs.class || '').split(' ').includes(cls)
    },
    getAttribute: (attr) => attrs[attr] || null,
    id: attrs.id || '',
    type: attrs.type || '',
    checked: Boolean(attrs.checked),
    offsetWidth: 200,
    offsetHeight: 50,
    parentElement: null,
    querySelector: function (sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll: function (sel) {
      const results = [];
      function walk(node) {
        if (!node || !node.children) return;
        for (const child of node.children) {
          let match = false;
          if (sel.includes('input[type="radio"]') && child.tagName === 'INPUT' && child.type === 'radio') match = true;
          if (sel.includes('input[type="checkbox"]') && child.tagName === 'INPUT' && child.type === 'checkbox') match = true;
          if (sel.includes('input[placeholder*="answer"') && child.tagName === 'INPUT' && (child.attributes.placeholder || '').toLowerCase().includes('answer')) match = true;
          if (sel.includes('input') && child.tagName === 'INPUT') match = true;
          if (sel.includes('textarea') && child.tagName === 'TEXTAREA') match = true;
          if (sel.includes('img') && child.tagName === 'IMG') match = true;
          if (sel.includes('h1') && child.tagName === 'H1') match = true;
          if (sel.includes('h2') && child.tagName === 'H2') match = true;
          if (sel.includes('h3') && child.tagName === 'H3') match = true;
          if (sel.includes('[class*="question" i]') && (child.attributes.class || '').toLowerCase().includes('question')) match = true;
          if (sel.includes('[class*="option" i]') && (child.attributes.class || '').toLowerCase().includes('option')) match = true;
          if (sel.includes('[class*="progress" i]') && (child.attributes.class || '').toLowerCase().includes('progress')) match = true;
          if (sel.startsWith('label[for=') && child.tagName === 'LABEL' && child.attributes.for === sel.match(/for="([^"]+)"/)?.[1]) match = true;
          if (match) results.push(child);
          walk(child);
        }
      }
      walk(this);
      return results;
    },
    closest: function () {
      return this.parentElement;
    }
  };
}

// Test Case 1: Standard Single-Choice MCQ
{
  const qHeading = createMockElement('h2', { class: 'question-title' }, 'What is the time complexity of binary search?');
  const opt1Input = createMockElement('input', { type: 'radio', id: 'opt1', name: 'answer' });
  const opt1Label = createMockElement('label', { for: 'opt1' }, 'A. O(N)');
  const opt2Input = createMockElement('input', { type: 'radio', id: 'opt2', name: 'answer', checked: 'true' });
  const opt2Label = createMockElement('label', { for: 'opt2', class: 'selected' }, 'B. O(log N)');

  const progress = createMockElement('span', { class: 'quiz-progress' }, 'Question 2 of 10');
  const qContainer = createMockElement('div', { class: 'question-container' }, '', [
    qHeading, opt1Input, opt1Label, opt2Input, opt2Label
  ]);

  [opt1Input, opt1Label, opt2Input, opt2Label, qHeading].forEach(c => c.parentElement = qContainer);
  const mockDoc = createMockElement('body', {}, '', [progress, qContainer]);
  progress.parentElement = mockDoc;
  qContainer.parentElement = mockDoc;

  global.document = mockDoc;
  global.window = {
    location: { href: 'https://my.newtonschool.co/course/test/assessment/123' },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' })
  };

  const result = NewtonExtractor.extractCurrentQuestion();
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.questionNumber, 2);
  assert.strictEqual(result.totalQuestions, 10);
  assert.strictEqual(result.format, 'single_choice');
  assert.strictEqual(result.options.length, 2);
  assert.strictEqual(result.selectedOptions[0], 'B');
  console.log('✓ Test 1: Single choice MCQ extraction passed');
}

// Test Case 2: Multi-select Checkboxes
{
  const qHeading = createMockElement('h3', { class: 'statement' }, 'Select all prime numbers below:');
  const opt1Input = createMockElement('input', { type: 'checkbox', id: 'c1', checked: 'true' });
  const opt1Label = createMockElement('label', { for: 'c1' }, 'A. 2');
  const opt2Input = createMockElement('input', { type: 'checkbox', id: 'c2', checked: 'true' });
  const opt2Label = createMockElement('label', { for: 'c2' }, 'B. 3');
  const opt3Input = createMockElement('input', { type: 'checkbox', id: 'c3' });
  const opt3Label = createMockElement('label', { for: 'c3' }, 'C. 4');

  const qContainer = createMockElement('div', { class: 'mcq-question' }, '', [
    qHeading, opt1Input, opt1Label, opt2Input, opt2Label, opt3Input, opt3Label
  ]);
  [opt1Input, opt1Label, opt2Input, opt2Label, opt3Input, opt3Label, qHeading].forEach(c => c.parentElement = qContainer);
  const mockDoc = createMockElement('body', {}, '', [qContainer]);
  qContainer.parentElement = mockDoc;

  global.document = mockDoc;
  const result = NewtonExtractor.extractCurrentQuestion();
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.format, 'multi_choice');
  assert.strictEqual(result.options.length, 3);
  assert.deepStrictEqual(result.selectedOptions, ['A', 'B']);
  console.log('✓ Test 2: Multi-choice checkbox extraction passed');
}

// Test Case 3: Newton School Actual Assessment DOM Structure
{
  const rawPortalText = `Python List, Python List Definition, Python List Input, Python List Indexing, Py ... - Revision
Submit Quiz
QUESTION 1/5
Mark for review
Clear Selection
Which method adds an element only to the end of a list?
A
extend()
B
add()`;

  const qHeading = createMockElement('div', { class: 'mcq-question' }, rawPortalText);
  const opt1 = createMockElement('div', { class: 'quiz-option' }, 'A\nextend()');
  const opt2 = createMockElement('div', { class: 'quiz-option selected', 'aria-checked': 'true' }, 'B\nadd()');
  const opt3 = createMockElement('div', { class: 'quiz-option' }, 'C\ninsert()');
  const opt4 = createMockElement('div', { class: 'quiz-option' }, 'D\nappend()');

  const qContainer = createMockElement('div', { class: 'question-container' }, '', [
    qHeading, opt1, opt2, opt3, opt4
  ]);
  [opt1, opt2, opt3, opt4, qHeading].forEach(c => c.parentElement = qContainer);
  const mockDoc = createMockElement('body', {}, rawPortalText, [qContainer]);
  qContainer.parentElement = mockDoc;

  global.document = mockDoc;
  const result = NewtonExtractor.extractCurrentQuestion();

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.questionNumber, 1, 'Should extract question number 1');
  assert.strictEqual(result.totalQuestions, 5, 'Should extract total questions 5');
  assert.strictEqual(result.questionText, 'Which method adds an element only to the end of a list?', 'Should isolate exact question statement');
  assert.strictEqual(result.options.length, 4, 'Should extract 4 options');
  assert.strictEqual(result.options[0].label, 'A');
  assert.strictEqual(result.options[0].text, 'extend()', 'Option text should not repeat A');
  assert.strictEqual(result.options[1].label, 'B');
  assert.strictEqual(result.options[1].text, 'add()', 'Option text should not repeat B');
  assert.strictEqual(result.hasSelection, true);
  assert.deepStrictEqual(result.selectedOptions, ['B']);
  console.log('✓ Test 3: Newton School actual portal structure passed perfectly');
}

// Test Case 4: Short Answer / Text Input Question (from user screenshot)
{
  const rawPortalText = `Direct Recursion, Python Builtin Data Structures - Revision
QUESTION 1/2
What will be the output of the following code?

def fun(n):
    if n == 0:
        return
    fun(n // 2)
    print(n % 2, end='')

fun(5)`;

  const qHeading = createMockElement('div', { class: 'question-title' }, rawPortalText);
  const textInput = createMockElement('input', {
    type: 'text',
    placeholder: 'Enter your answer here',
    class: 'answer-input'
  });

  const qContainer = createMockElement('div', { class: 'question-container' }, '', [
    qHeading, textInput
  ]);
  [qHeading, textInput].forEach(c => c.parentElement = qContainer);
  const mockDoc = createMockElement('body', {}, rawPortalText, [qContainer]);
  qContainer.parentElement = mockDoc;

  global.document = mockDoc;
  const result = NewtonExtractor.extractCurrentQuestion();

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.questionNumber, 1, 'Should extract Q1');
  assert.strictEqual(result.totalQuestions, 2, 'Should extract total Q2');
  assert.strictEqual(result.format, 'short_answer', 'Should detect short_answer format');
  assert.strictEqual(result.hasTextInput, true, 'Should detect text input');
  assert.strictEqual(result.inputPlaceholder, 'Enter your answer here');
  assert.strictEqual(result.options.length, 0, 'Should have 0 options');
  console.log('✓ Test 4: Short answer / text input question extraction passed');
}

console.log('All extractor unit tests passed successfully!');
