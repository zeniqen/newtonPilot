/**
 * Unit tests for OllamaProvider (NewtonPilot Phase 2)
 */

const assert = require('assert');
const OllamaProviderModule = require('../services/ollama-provider.js');
const OllamaProvider = OllamaProviderModule.default || OllamaProviderModule;

async function runTests() {
  console.log('Running OllamaProvider tests...\n');

  // Test 1: Instantiation with defaults
  {
    const provider = new OllamaProvider();
    assert.strictEqual(provider.host, 'http://localhost:11434');
    assert.strictEqual(provider.model, 'qwen2.5-coder:7b');
    assert.strictEqual(provider.temperature, 0.0);
    console.log('✓ Test 1: Default configuration passed');
  }

  // Test 2: buildPrompt produces structured output with Chain-of-Thought scratchpad first
  {
    const provider = new OllamaProvider({ model: 'qwen2.5-coder:7b' });
    const mockQuestion = {
      questionText: 'Which method adds an element only to the end of a list?',
      format: 'single_choice',
      options: [
        { label: 'A', text: 'extend()' },
        { label: 'B', text: 'add()' },
        { label: 'C', text: 'insert()' },
        { label: 'D', text: 'append()' }
      ]
    };

    const prompt = provider.buildPrompt(mockQuestion);
    assert.ok(prompt.includes('Which method adds an element only to the end of a list?'));
    assert.ok(prompt.includes('Option A: extend()'));
    assert.ok(prompt.includes('Option D: append()'));
    assert.ok(prompt.includes('code_execution_trace'));
    assert.ok(prompt.includes('options_analysis'));
    assert.ok(prompt.includes('suggested_answer'));

    const traceIdx = prompt.lastIndexOf('code_execution_trace');
    const answerIdx = prompt.lastIndexOf('suggested_answer');
    assert.ok(traceIdx < answerIdx, 'code_execution_trace must precede suggested_answer in schema');
    console.log('✓ Test 2: Prompt structure generation with inverted CoT schema passed');
  }

  // Test 3: cleanJsonResponse strips code fences and extracts JSON
  {
    const provider = new OllamaProvider();
    const rawFenced = '```json\n{"suggested_answer":"Option D"}\n```';
    const cleaned = provider.cleanJsonResponse(rawFenced);
    assert.strictEqual(cleaned, '{"suggested_answer":"Option D"}');

    const bare = '{"suggested_answer":"Option D"}';
    assert.strictEqual(provider.cleanJsonResponse(bare), bare);

    const surrounded = 'Here is the answer:\n```json\n{"suggested_answer":"Option D"}\n```\nHope that helps!';
    assert.strictEqual(provider.cleanJsonResponse(surrounded), '{"suggested_answer":"Option D"}');
    console.log('✓ Test 3: Markdown JSON code-fence and surrounded text cleaning passed');
  }

  // Test 4: Mocked requestExplanation parses schema
  {
    const provider = new OllamaProvider();
    
    // Save original fetch
    const originalFetch = global.fetch;

    global.fetch = async (url, options) => {
      if (url.endsWith('/api/generate')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            response: JSON.stringify({
              suggested_answer: 'Option D: append()',
              concept_summary: 'append() adds an item to the end of a list in Python.',
              reasoning: 'In Python, list.append(x) places the object at the final index.',
              options_analysis: [
                { label: 'A', status: 'Incorrect', explanation: 'extend iterates over an iterable' },
                { label: 'D', status: 'Correct', explanation: 'append places an item at the end' }
              ],
              confidence: 0.99
            })
          })
        };
      }
      return { ok: false, status: 404 };
    };

    try {
      const result = await provider.requestExplanation({
        questionText: 'Which method adds an element only to the end of a list?',
        options: [{ label: 'A', text: 'extend()' }, { label: 'D', text: 'append()' }]
      });

      assert.strictEqual(result.suggested_answer, 'Option D: append()');
      assert.strictEqual(result.concept_summary, 'append() adds an item to the end of a list in Python.');
      assert.strictEqual(result.confidence, 0.99);
      assert.strictEqual(result.options_analysis.length, 2);
      assert.strictEqual(result.options_analysis[1].status, 'Correct');
      console.log('✓ Test 4: Explanation parsing and schema mapping passed');
    } finally {
      global.fetch = originalFetch;
    }
  }

  // Test 5: Vision model recognition and multimodal payload
  {
    const visionProvider = new OllamaProvider({ model: 'llava:7b' });
    assert.strictEqual(visionProvider.isVisionModel('llava:7b'), true);
    assert.strictEqual(visionProvider.isVisionModel('llama3.2-vision'), true);
    assert.strictEqual(visionProvider.isVisionModel('qwen2.5-coder:7b'), false);

    const originalFetch = global.fetch;
    let capturedBody = null;

    global.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          response: JSON.stringify({
            suggested_answer: 'Option A: 42',
            concept_summary: 'Image shows code output',
            reasoning: 'Diagram shows x = 42',
            options_analysis: [],
            confidence: 0.99
          })
        })
      };
    };

    try {
      await visionProvider.requestExplanation({
        questionText: 'What is the output of the diagram?',
        options: [{ label: 'A', text: '42' }],
        images: [{ src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }]
      });

      assert.ok(capturedBody.images);
      assert.strictEqual(capturedBody.images.length, 1);
      assert.ok(capturedBody.images[0].length > 10);
      console.log('✓ Test 5: Multimodal vision payload passed');
    } finally {
      global.fetch = originalFetch;
    }
  }

  // Test 6: buildPrompt produces Short Answer / Fill in the blank prompt
  {
    const provider = new OllamaProvider({ model: 'qwen2.5-coder:7b' });
    const shortAnswerQ = {
      questionText: 'What will be the output of fun(5)?',
      format: 'short_answer',
      options: [],
      hasTextInput: true
    };

    const prompt = provider.buildPrompt(shortAnswerQ);
    assert.ok(prompt.includes('Short Answer / Output Prediction / Fill-in-the-blank'));
    assert.ok(prompt.includes('What will be the output of fun(5)?'));
    assert.ok(prompt.includes('type the EXACT answer directly into an input field'));
    assert.ok(!prompt.includes('Option A:'));
    assert.ok(prompt.includes('code_execution_trace'));

    const traceIdx = prompt.lastIndexOf('code_execution_trace');
    const answerIdx = prompt.lastIndexOf('suggested_answer');
    assert.ok(traceIdx < answerIdx, 'code_execution_trace must precede suggested_answer in short answer prompt');
    console.log('✓ Test 6: Short answer prompt generation passed');
  }

  // Test 7: Reconciles MCQ mismatch between options_analysis and suggested_answer
  {
    const provider = new OllamaProvider();
    const mockQuestion = {
      questionText: 'Which method adds an element only to the end of a list?',
      options: [
        { label: 'A', text: 'extend()' },
        { label: 'B', text: 'add()' },
        { label: 'C', text: 'insert()' },
        { label: 'D', text: 'append()' }
      ]
    };

    // Simulate model hallucinating "Option A" in suggested_answer despite proving Option D in analysis
    const parsedWithHallucination = {
      suggested_answer: 'Option A: extend()',
      code_execution_trace: 'list.append(x) places x at index len(list). list.extend(iter) unpacks iterable.',
      reasoning: 'append() is specifically designed to add one element to the end.',
      options_analysis: [
        { label: 'A', status: 'Incorrect', explanation: 'extend unpacks an iterable' },
        { label: 'B', status: 'Incorrect', explanation: 'add is for sets' },
        { label: 'C', status: 'Incorrect', explanation: 'insert adds at arbitrary index' },
        { label: 'D', status: 'Correct', explanation: 'append places an item at the end' }
      ],
      confidence: 0.99
    };

    const reconciled = provider.reconcileExplanation(parsedWithHallucination, mockQuestion);
    assert.strictEqual(reconciled.suggested_answer, 'Option D: append()');
    console.log('✓ Test 7: MCQ discrepancy reconciliation passed (Option A overridden with Option D)');
  }

  // Test 8: Reconciles Short Answer space artifact and prefix
  {
    const provider = new OllamaProvider();
    const mockQuestion = {
      questionText: "def fun(n):\n    if n == 0: return\n    fun(n // 2)\n    print(n % 2, end='')\nfun(5)",
      format: 'short_answer',
      options: [],
      hasTextInput: true
    };

    // Simulate model outputting "Option D: 1 0 1" with spaces when end='' produced "101"
    const parsedWithSpaces = {
      suggested_answer: 'Option D: 1 0 1',
      code_execution_trace: "fun(5)->fun(2)->fun(1)->fun(0). Unwinding: fun(1) prints '1', fun(2) prints '0', fun(5) prints '1'. Stdout buffer: '101'.",
      reasoning: 'Unwinds printing 1, 0, 1 in order. Output is 101.',
      options_analysis: [],
      confidence: 0.99
    };

    const reconciled = provider.reconcileExplanation(parsedWithSpaces, mockQuestion);
    assert.strictEqual(reconciled.suggested_answer, '101', 'Should strip Option D prefix and space artifacts');
    console.log('✓ Test 8: Short answer space artifact and prefix reconciliation passed');
  }

  // Test 9: Nested loop iteration table & indentation guidance in prompt
  {
    const provider = new OllamaProvider();
    const loopQ = {
      questionText: "What will be the value of v when the value 53 is printed?\nv = 1\nfor i in range(1, 6):\n    for j in range(1, i + 2):\n        v += i\n        print(i * j + v, end=' ')",
      format: 'short_answer',
      options: [],
      hasTextInput: true
    };

    const prompt = provider.buildPrompt(loopQ);
    assert.ok(prompt.includes('NESTED LOOPS & INDENTATION SCOPE'), 'Prompt must instruct on nested loops & indentation scope');
    assert.ok(prompt.includes('build an explicit iteration table'), 'Prompt must mandate iteration table');

    // Simulate trace finding 37 when 53 is printed
    const parsed = {
      code_execution_trace: 'i=1: j=1 -> v=2, print 3. j=2 -> v=3, print 5.\ni=2: j=1 -> v=5, print 7. j=2 -> v=7, print 11. j=3 -> v=9, print 15.\ni=3: j=1 -> v=12, print 15. j=2 -> v=15, print 21. j=3 -> v=18, print 27. j=4 -> v=21, print 33.\ni=4: j=1 -> v=25, print 29. j=2 -> v=29, print 37. j=3 -> v=33, print 45. j=4 -> v=37, print 53!\nCondition met: 53 is printed when v is 37.',
      reasoning: 'At iteration i=4, j=4, v increases by 4 to 37. Then print(4*4 + 37) prints 53. The value of v is 37.',
      concept_summary: 'Loop iteration tracking',
      suggested_answer: '37',
      options_analysis: [],
      confidence: 0.99
    };

    const reconciled = provider.reconcileExplanation(parsed, loopQ);
    assert.strictEqual(reconciled.suggested_answer, '37');
    console.log('✓ Test 9: Nested loop iteration table & prompt verification passed');
  }

  // Test 10: Deterministic NewtonPythonEngine overrides LLM arithmetic hallucination (32 -> 37)
  {
    const provider = new OllamaProvider();
    const loopQ = {
      questionText: 'Pattern printing using loops - Revision\nQUESTION 1/5\nWhat will be the value of v when the value 53 is printed?\n\nv = 1\nfor i in range(1, 6):\n    for j in range(1, i + 2):\n        v += i\n        print(i * j + v, end=" ")',
      format: 'short_answer',
      options: [],
      hasTextInput: true
    };

    // Simulate LLM hallucinating 32 (as seen in user screenshot!)
    const hallucinatedParsed = {
      code_execution_trace: '(i=1, j=1, v=2, stdout_prints=2)...',
      reasoning: 'At i=4, j=3, v is 32',
      concept_summary: 'Loop iteration',
      suggested_answer: '32',
      options_analysis: [],
      confidence: 0.99
    };

    const reconciled = provider.reconcileExplanation(hallucinatedParsed, loopQ);
    assert.strictEqual(reconciled.suggested_answer, '37', 'Deterministic engine must override hallucinated 32 with 37');
    assert.ok(reconciled.reasoning.includes('Deterministic Python Engine Verified'), 'Reasoning must include engine verification');
    console.log('✓ Test 10: Deterministic NewtonPythonEngine overrides hallucinated 32 with 37');
  }

  console.log('\nAll OllamaProvider tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
