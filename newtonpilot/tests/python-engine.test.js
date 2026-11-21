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

  // Test 5: Outer & Inner loop iteration query (Question 2 from user screenshot)
  {
    const q5 = `Pattern printing using loops - Revision
QUESTION 2/5
What is the last number printed in the 4th outer loop and 3rd inner loop?

c = 1
for i in range(1, 5):
    for j in range(1, i + 2):
        if (i * j) % 2 == 1:
            c += (i * j)
        print(i + j + c, end=" ")`;

    const res = engine.solve(q5);
    assert.strictEqual(res.solved, true, 'Should solve outer and inner loop question');
    assert.strictEqual(res.answer, '21', 'At outer=4, inner=3: 4 + 3 + 14 = 21');
    assert.strictEqual(res.type, 'loop_outer_inner_print');
    assert.ok(res.trace.includes('outer loop: 4 | inner loop: 3'), 'Trace should include loop iteration');
    console.log('✓ Test 5: Outer & Inner loop query (4th outer, 3rd inner -> 21) passed');
  }

  // Test 6: Resilient to visually truncated prompt from webpage (... and 3r)
  {
    const q6 = `What is the last number printed in the 4th outer loop and 3r

c = 1
for i in range(1, 5):
    for j in range(1, i + 2):
        if (i * j) % 2 == 1:
            c += (i * j)
        print(i + j + c, end=" ")`;

    const res = engine.solve(q6);
    assert.strictEqual(res.solved, true, 'Should solve truncated question');
    assert.strictEqual(res.answer, '21');
    console.log('✓ Test 6: Visually truncated prompt resilience passed');
  }

  // Test 7: Outer loop only query
  {
    const q7 = `What is the last number printed in the 4th outer loop?

c = 1
for i in range(1, 5):
    for j in range(1, i + 2):
        if (i * j) % 2 == 1:
            c += (i * j)
        print(i + j + c, end=" ")`;

    const res = engine.solve(q7);
    assert.strictEqual(res.solved, true);
    assert.strictEqual(res.answer, '23', 'Last number in 4th outer loop is 23');
    console.log('✓ Test 7: Outer loop only query (4th outer -> 23) passed');
  }

  // Test 8: Total print execution count
  {
    const q8 = `How many times will the inner loop execute?

c = 1
for i in range(1, 5):
    for j in range(1, i + 2):
        if (i * j) % 2 == 1:
            c += (i * j)
        print(i + j + c, end=" ")`;

    const res = engine.solve(q8);
    assert.strictEqual(res.solved, true);
    assert.strictEqual(res.answer, '14', 'Total executions = 2 + 3 + 4 + 5 = 14');
    console.log('✓ Test 8: Execution count query passed');
  }

  // Test 9: Python Builtins (len, sum, min, max, abs)
  {
    const q9 = `What will be the final value of ans?
lst = [10, 20, 30]
ans = len(lst) + sum(lst)`;

    const res = engine.solve(q9);
    assert.strictEqual(res.solved, true);
    assert.strictEqual(res.answer, '63', '3 + 60 = 63');
    console.log('✓ Test 9: Builtins len and sum passed');
  }

  // Test 10: Trailing non-code text below code does not corrupt parser
  {
    const q10 = `What is the last number printed in the 4th outer loop and 3rd inner loop?

c = 1
for i in range(1, 5):
    for j in range(1, i + 2):
        if (i * j) % 2 == 1:
            c += (i * j)
        print(i + j + c, end=" ")

Choose the correct option below:
12`;

    const res = engine.solve(q10);
    assert.strictEqual(res.solved, true, 'Should discard trailing non-code text');
    assert.strictEqual(res.answer, '21');
    console.log('✓ Test 10: Trailing non-code text resilience passed');
  }

  // Test 11: Question prompt positioned below code
  {
    const q11 = `c = 1
for i in range(1, 5):
    for j in range(1, i + 2):
        if (i * j) % 2 == 1:
            c += (i * j)
        print(i + j + c, end=" ")

What is the last number printed in the 4th outer loop and 3rd inner loop?`;

    const res = engine.solve(q11);
    assert.strictEqual(res.solved, true);
    assert.strictEqual(res.answer, '21');
    console.log('✓ Test 11: Question prompt below code passed');
  }

  console.log('\nAll NewtonPythonEngine tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
