/**
 * NewtonPythonEngine - Lightweight Deterministic Python Interpreter for Assessment Snippets
 * Safely parses and executes standard Python constructs in JavaScript to eliminate LLM arithmetic hallucinations.
 * 
 * Supports:
 * - Nested loops (for i in range(...), while ...)
 * - Variable state tracking at print events
 * - Print stdout buffer tracking (end='', sep=' ')
 * - Floor division (//), exponent (**), modulo (%), and logical operators (and, or, not)
 * - Basic recursive functions and conditionals
 * - Infinite loop step protection
 */

class NewtonPythonEngine {
  constructor(options = {}) {
    this.maxOps = options.maxOps || 50000;
  }

  /**
   * Extract Python code snippet from question statement text.
   * @param {string} text 
   * @returns {string}
   */
  extractCodeBlock(text) {
    if (!text) return '';
    // Look for markdown code fences
    const fenceMatch = text.match(/```(?:python)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch) return fenceMatch[1].trim();

    // Look for lines of Python code
    const lines = text.split('\n');
    const codeLines = [];
    let inCode = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const isCodeStart = /^(?:def\s+\w+|for\s+\w+\s+in|while\s+|if\s+|v\s*=|x\s*=|n\s*=|a\s*=|ans\s*=|s\s*=|lst\s*=|arr\s*=|[a-zA-Z_]\w*\s*=\s*)/.test(trimmed);

      if (isCodeStart && !inCode) {
        inCode = true;
      }

      if (inCode) {
        // Stop if options block or portal action buttons are encountered
        if (/^[A-D][\.\)\:\-]\s+/.test(trimmed) || /^(?:Submit|Mark for review|Next|Previous)/i.test(trimmed)) {
          break;
        }
        codeLines.push(line);
      }
    }

    return codeLines.join('\n').trim();
  }

  /**
   * Transpile Python code string into executable JavaScript.
   * @param {string} pyCode 
   * @returns {{jsCode: string, trackedList: string[]}}
   */
  transpile(pyCode) {
    const lines = pyCode.split('\n');
    const jsLines = [];
    const indentStack = [];
    const declaredVars = new Set();
    const allAssignedVars = new Set();

    // Pre-pass: collect variable names to track in scope snapshots
    for (const rawLine of lines) {
      const assign = rawLine.trim().match(/^([a-zA-Z_]\w*)\s*(?:[+\-*\/%]?=)/);
      if (assign) allAssignedVars.add(assign[1]);
      const forMatch = rawLine.trim().match(/^for\s+([a-zA-Z_]\w*)\s+in/);
      if (forMatch) allAssignedVars.add(forMatch[1]);
      const defMatch = rawLine.trim().match(/^def\s+([a-zA-Z_]\w*)\s*\((.*?)\)/);
      if (defMatch) {
        allAssignedVars.add(defMatch[1]);
        defMatch[2].split(',').forEach(a => {
          const p = a.trim().split('=')[0].trim();
          if (p) allAssignedVars.add(p);
        });
      }
    }

    const trackedList = Array.from(allAssignedVars);

    for (let rawLine of lines) {
      if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;

      const indentMatch = rawLine.match(/^[ ]*/);
      const indent = indentMatch ? indentMatch[0].length : 0;
      let line = rawLine.trim();

      // Check dedent
      while (indentStack.length > 0 && indent <= indentStack[indentStack.length - 1]) {
        // Handle elif / else at same indent level as if
        if ((line.startsWith('elif ') || line.startsWith('else:')) && indent === indentStack[indentStack.length - 1]) {
          break;
        }
        indentStack.pop();
        jsLines.push('}');
      }

      let opensBlock = false;

      // Convert print(...) with variable snapshot capturing
      if (/\bprint\s*\(/.test(line)) {
        line = line.replace(/\bprint\s*\((.*)\)$/, (m, args) => {
          let endArg = '\\n';
          let sepArg = ' ';
          let cleanArgs = args
            .replace(/,\s*end\s*=\s*(["'])(.*?)\1/, (_, q, val) => { endArg = val; return ''; })
            .replace(/,\s*sep\s*=\s*(["'])(.*?)\1/, (_, q, val) => { sepArg = val; return ''; });

          const snapshotProps = trackedList
            .map(v => `${JSON.stringify(v)}: (typeof ${v} !== 'undefined' ? ${v} : undefined)`)
            .join(', ');

          return `__py_print([${cleanArgs.trim()}], ${JSON.stringify(sepArg)}, ${JSON.stringify(endArg)}, { ${snapshotProps} })`;
        });
      }

      // Convert for var in range(...)
      if (/^for\s+([a-zA-Z_]\w*)\s+in\s+range\((.*)\)\s*:$/.test(line)) {
        line = line.replace(/^for\s+([a-zA-Z_]\w*)\s+in\s+range\((.*)\)\s*:$/, (m, v, args) => {
          declaredVars.add(v);
          return `for (let ${v} of __py_range(${args})) { __checkOps();`;
        });
        opensBlock = true;
      }
      // Convert for var in collection
      else if (/^for\s+([a-zA-Z_]\w*)\s+in\s+(.*?)\s*:$/.test(line)) {
        line = line.replace(/^for\s+([a-zA-Z_]\w*)\s+in\s+(.*?)\s*:$/, (m, v, iter) => {
          declaredVars.add(v);
          return `for (let ${v} of __py_iter(${iter})) { __checkOps();`;
        });
        opensBlock = true;
      }
      // Convert while
      else if (/^while\s+(.*?)\s*:$/.test(line)) {
        line = line.replace(/^while\s+(.*?)\s*:$/, 'while ($1) { __checkOps();');
        opensBlock = true;
      }
      // Convert if / elif / else
      else if (/^if\s+(.*?)\s*:$/.test(line)) {
        line = line.replace(/^if\s+(.*?)\s*:$/, 'if ($1) {');
        opensBlock = true;
      } else if (/^elif\s+(.*?)\s*:$/.test(line)) {
        line = line.replace(/^elif\s+(.*?)\s*:$/, '} else if ($1) {');
        opensBlock = true;
      } else if (/^else\s*:$/.test(line)) {
        line = line.replace(/^else\s*:$/, '} else {');
        opensBlock = true;
      }
      // Convert def
      else if (/^def\s+([a-zA-Z_]\w*)\s*\((.*?)\)\s*:$/.test(line)) {
        line = line.replace(/^def\s+([a-zA-Z_]\w*)\s*\((.*?)\)\s*:$/, (m, fn, args) => {
          return `function ${fn}(${args}) { __checkOps();`;
        });
        opensBlock = true;
      }

      // Python Keywords & Operators
      line = line.replace(/\bTrue\b/g, 'true')
                 .replace(/\bFalse\b/g, 'false')
                 .replace(/\bNone\b/g, 'null')
                 .replace(/\band\b/g, '&&')
                 .replace(/\bor\b/g, '||')
                 .replace(/\bnot\b/g, '!');

      // Floor division //
      line = line.replace(/(\b\w+|\d+)\s*\/\/\s*(\b\w+|\d+)/g, 'Math.floor($1 / $2)');

      // Power **
      line = line.replace(/(\b\w+|\d+)\s*\*\*\s*(\b\w+|\d+)/g, 'Math.pow($1, $2)');

      // Variable assignment: let varName = ...
      const assignMatch = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.*)/);
      if (assignMatch && !opensBlock) {
        const varName = assignMatch[1];
        if (!declaredVars.has(varName)) {
          declaredVars.add(varName);
          line = 'let ' + line;
        }
      }

      if (!opensBlock && !line.endsWith(';') && !line.endsWith('}')) {
        line += ';';
      }

      if (opensBlock) {
        indentStack.push(indent);
      }

      jsLines.push(' '.repeat(indent) + line);
    }

    while (indentStack.length > 0) {
      indentStack.pop();
      jsLines.push('}');
    }

    return { jsCode: jsLines.join('\n'), trackedList };
  }

  /**
   * Execute Python code and return stdout, print events with variable snapshots, and final scope.
   * @param {string} pyCode 
   * @returns {{success: boolean, stdout: string, rawStdout: string, printEvents: Array, finalScope: Object, error?: string}}
   */
  execute(pyCode) {
    try {
      const { jsCode, trackedList } = this.transpile(pyCode);
      let stdout = '';
      const printEvents = [];
      let ops = 0;
      const maxOps = this.maxOps;

      function __checkOps() {
        if (++ops > maxOps) throw new Error('Maximum execution steps exceeded (infinite loop protection)');
      }

      function __py_print(argsArray, sep = ' ', end = '\n', vars = {}) {
        const formatted = argsArray.map(a => String(a)).join(sep);
        stdout += formatted + end;
        printEvents.push({ value: argsArray.length === 1 ? argsArray[0] : formatted, formatted, vars: { ...vars } });
      }

      function __py_range(start, stop, step = 1) {
        if (stop === undefined) { stop = start; start = 0; }
        const res = [];
        for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
          __checkOps();
          res.push(i);
        }
        return res;
      }

      function __py_iter(obj) {
        return Array.isArray(obj) ? obj : (typeof obj === 'string' ? obj.split('') : Object.keys(obj));
      }

      const returnCollector = trackedList
        .map(v => `${JSON.stringify(v)}: (typeof ${v} !== 'undefined' ? ${v} : undefined)`)
        .join(', ');

      const runner = new Function('__py_print', '__py_range', '__py_iter', '__checkOps', `
        ${jsCode}
        return { ${returnCollector} };
      `);

      const finalScope = runner(__py_print, __py_range, __py_iter, __checkOps);
      return {
        success: true,
        stdout: stdout.trim(),
        rawStdout: stdout,
        printEvents,
        finalScope
      };
    } catch (err) {
      return {
        success: false,
        stdout: '',
        rawStdout: '',
        printEvents: [],
        finalScope: {},
        error: err.message
      };
    }
  }

  /**
   * Automatically detect intent and solve question deterministically.
   * @param {string} questionText 
   * @returns {{solved: boolean, answer?: string, stdout?: string, type?: string, explanation?: string, reason?: string, error?: string}}
   */
  solve(questionText) {
    try {
      const code = this.extractCodeBlock(questionText);
      if (!code) return { solved: false, reason: 'No code block found' };

      const execResult = this.execute(code);
      if (!execResult.success) return { solved: false, reason: `Execution failed: ${execResult.error}` };

      // Case 1: "What will be the value of <var> when the value <val> is printed?"
      const printWhenMatch = questionText.match(/value\s+of\s+([a-zA-Z_]\w*)\s+when\s+(?:the\s+value\s+)?([0-9a-zA-Z_\-]+)\s+is\s+printed/i);
      if (printWhenMatch) {
        const targetVar = printWhenMatch[1];
        const targetVal = isNaN(Number(printWhenMatch[2])) ? printWhenMatch[2] : Number(printWhenMatch[2]);
        const matchedEvent = execResult.printEvents.find(ev => ev.value == targetVal || String(ev.value).trim() === String(targetVal));
        if (matchedEvent && matchedEvent.vars && matchedEvent.vars[targetVar] !== undefined) {
          return {
            solved: true,
            answer: String(matchedEvent.vars[targetVar]),
            type: 'variable_at_print',
            variable: targetVar,
            triggerValue: targetVal,
            stdout: execResult.stdout,
            explanation: `When ${targetVal} is printed, variable '${targetVar}' equals ${matchedEvent.vars[targetVar]}.`
          };
        }
      }

      // Case 2: Output questions
      if (/(?:output|what\s+(?:will\s+be\s+the\s+output|does\s+the\s+following\s+code\s+print|is\s+the\s+output|is\s+printed)|predict\s+the\s+output)/i.test(questionText) && execResult.stdout) {
        return {
          solved: true,
          answer: execResult.stdout,
          type: 'stdout',
          stdout: execResult.stdout,
          explanation: `The simulated code outputs: ${execResult.stdout}`
        };
      }

      // Case 3: "What will be the final value of <var>?" / "What is the value of <var> after...?" / "Find value of <var>"
      const finalVarMatch = questionText.match(/(?:final\s+value\s+of|value\s+of|find\s+(?:the\s+)?value\s+of)\s+([a-zA-Z_]\w*)/i);
      if (finalVarMatch) {
        const targetVar = finalVarMatch[1];
        if (execResult.finalScope && execResult.finalScope[targetVar] !== undefined) {
          return {
            solved: true,
            answer: String(execResult.finalScope[targetVar]),
            type: 'final_variable',
            variable: targetVar,
            stdout: execResult.stdout,
            explanation: `At the end of execution, variable '${targetVar}' equals ${execResult.finalScope[targetVar]}.`
          };
        }
      }

      return {
        solved: false,
        stdout: execResult.stdout,
        finalScope: execResult.finalScope,
        reason: 'Question intent pattern did not match'
      };
    } catch (err) {
      return { solved: false, error: err.message };
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NewtonPythonEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.NewtonPythonEngine = NewtonPythonEngine;
}

export default NewtonPythonEngine;
