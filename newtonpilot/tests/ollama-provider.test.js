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
    assert.strictEqual(provider.temperature, 0.2);
    console.log('✓ Test 1: Default configuration passed');
  }

  // Test 2: buildPrompt produces structured output
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
    assert.ok(prompt.includes('suggested_answer'));
    assert.ok(prompt.includes('options_analysis'));
    console.log('✓ Test 2: Prompt structure generation passed');
  }

  // Test 3: cleanJsonResponse strips code fences
  {
    const provider = new OllamaProvider();
    const rawFenced = '```json\n{"suggested_answer":"Option D"}\n```';
    const cleaned = provider.cleanJsonResponse(rawFenced);
    assert.strictEqual(cleaned, '{"suggested_answer":"Option D"}');

    const bare = '{"suggested_answer":"Option D"}';
    assert.strictEqual(provider.cleanJsonResponse(bare), bare);
    console.log('✓ Test 3: Markdown JSON code-fence cleaning passed');
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

  console.log('\nAll OllamaProvider tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
