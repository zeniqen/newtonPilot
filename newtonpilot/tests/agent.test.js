/**
 * Unit tests for Autonomous Agent Engine & Action Executor (NewtonPilot Phase 3)
 */

const assert = require('assert');
const NewtonExecutor = require('../scripts/executor.js');
const NewtonAgent = require('../scripts/agent.js');

async function runTests() {
  console.log('Running Autonomous Agent & Executor tests...\n');

  // Test 1: Completion Detector logic
  {
    const comp1 = NewtonExecutor.checkCompletion({ number: 5, total: 5 });
    assert.strictEqual(comp1.isComplete, true);
    assert.ok(comp1.reason.includes('Reached final question'));

    const comp2 = NewtonExecutor.checkCompletion({ number: 2, total: 5 });
    assert.strictEqual(comp2.isComplete, false);
    console.log('✓ Test 1: Completion detector logic passed');
  }

  // Test 2: findOptionElement with mocked DOM
  {
    // Mock minimal DOM element
    const mockElement = {
      tagName: 'DIV',
      getAttribute: (attr) => attr === 'data-newton-option' ? 'D' : null,
      innerText: 'D. append()',
      offsetWidth: 100,
      offsetHeight: 40
    };

    global.document = {
      querySelector: (selector) => {
        if (selector.includes('data-newton-option="D"')) return mockElement;
        return null;
      },
      querySelectorAll: () => [mockElement],
      body: { querySelectorAll: () => [mockElement] }
    };
    global.window = {
      getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' })
    };

    const found = NewtonExecutor.findOptionElement('D');
    assert.ok(found);
    assert.strictEqual(found.innerText, 'D. append()');
    console.log('✓ Test 2: Option element resolution passed');
  }

  // Test 3: NewtonAgent initial state and controller methods
  {
    const status = NewtonAgent.getStatus();
    assert.strictEqual(status.state, 'IDLE');
    assert.strictEqual(status.isRunning, false);
    assert.ok(status.recentLogs);

    const paused = NewtonAgent.pause();
    assert.strictEqual(paused.lastAction, 'Pausing...');

    const stopped = NewtonAgent.stop();
    assert.strictEqual(stopped.state, 'IDLE');
    assert.strictEqual(stopped.isRunning, false);
    console.log('✓ Test 3: Agent state machine transitions passed');
  }

  console.log('\nAll Autonomous Agent tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
