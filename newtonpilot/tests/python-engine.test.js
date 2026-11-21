/**
 * Unit tests for NewtonPythonEngine
 * Run with: node newtonpilot/tests/python-engine.test.js
 */

const assert = require('assert');
const PythonEngineModule = require('../services/python-engine.js');
const NewtonPythonEngine = PythonEngineModule.default || PythonEngineModule;

async function runTests() {
  console.log('Running NewtonPythonEngine tests...\n');
  const engine = new NewtonPythonEngine();

  // Test 1: Solves nested loop variable value when target is printed (User Screenshot)
  {
    const q1 = `Pattern printing using loops - Revision
QUESTION 1/5
What will be the value of v when the value 53 is printed?

v = 1
for i in range(1, 6):
    for j in range(1, i + 2):
        v += i
        print(i * j + v, end=" ")`;

    const res = engine.solve(q1);
    assert.strictEqual(res.solved, true, 'Should solve nested loop question');
    assert.strictEqual(res.answer, '37', 'v must be 37 when 53 is printed');
    assert.strictEqual(res.type, 'variable_at_print');
    console.log('✓ Test 1: Nested loop target value (v=37 at 53) passed');
  }

  // Test 2: Solves recursive function output (Recursion Question)
  {
    const q2 = `QUESTION 1/2
What will be the output of the following code?

def fun(n):
    if n == 0:
        return
    fun(n // 2)
    print(n % 2, end='')

fun(5)`;

    const res = engine.solve(q2);
    assert.strictEqual(res.solved, true, 'Should solve recursion question');
    assert.strictEqual(res.answer, '101', 'Output of fun(5) must be 101');
    assert.strictEqual(res.type, 'stdout');
    console.log('✓ Test 2: Recursion stdout output (101) passed');
  }

  // Test 3: Solves final variable value after loops
  {
    const q3 = `What will be the final value of s at the end of the code?
s = 0
for i in range(1, 5):
    s += i * i`;

    const res = engine.solve(q3);
    assert.strictEqual(res.solved, true, 'Should solve final variable question');
    assert.strictEqual(res.answer, '30', '1 + 4 + 9 + 16 = 30');
    assert.strictEqual(res.type, 'final_variable');
    console.log('✓ Test 3: Final variable state tracking passed');
  }

  // Test 4: Infinite loop guard protects against freeze
  {
    const infiniteCode = `x = 1
while x > 0:
    x += 1`;

    const res = engine.execute(infiniteCode);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('Maximum execution steps exceeded'), 'Should abort infinite loops safely');
    console.log('✓ Test 4: Infinite loop protection passed');
  }

  console.log('\nAll NewtonPythonEngine tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
