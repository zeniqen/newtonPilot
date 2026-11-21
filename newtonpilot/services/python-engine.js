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

    function isPythonLine(line) {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (trimmed.startsWith('#')) return true;
      if (/^[ ]{2,}|\t/.test(line)) return true;
      if (/^(?:def\s+\w+|for\s+\w+\s+in|while\s+|if\s+|elif\s+|else:|try:|except|finally:|class\s+\w+|return\b|print\s*\(|break\b|continue\b|pass\b)/.test(trimmed)) return true;
      if (/^[a-zA-Z_]\w*(?:\[.*?\])?\s*(?:[+\-*\/%]?=)/.test(trimmed)) return true;
      if (/^[a-zA-Z_]\w*\s*\(.*\)\s*$/.test(trimmed)) return true;
      return false;
    }

    // Look for lines of Python code
    const lines = text.split('\n');
    const codeLines = [];
    let inCode = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const isCodeStart = /^(?:def\s+\w+|for\s+\w+\s+in|while\s+|if\s+|v\s*=|x\s*=|n\s*=|a\s*=|ans\s*=|s\s*=|c\s*=|i\s*=|j\s*=|lst\s*=|arr\s*=|[a-zA-Z_]\w*\s*=\s*)/.test(trimmed);

      if (isCodeStart && !inCode) {
        inCode = true;
      }

      if (inCode) {
        if (!isPythonLine(line)) {
          break; // Stop at first non-code English sentence
        }
        // Stop if options block or portal action buttons are encountered
        if (/^[A-D][\.\)\:\-]\s+/.test(trimmed) || /^(?:Submit|Mark for review|Next|Previous|Choose|Select|Enter|Note)/i.test(trimmed)) {
          break;
        }
        codeLines.push(line);
      }
    }

    while (codeLines.length > 0 && !codeLines[codeLines.length - 1].trim()) {
      codeLines.pop();
    }

    return codeLines.join('\n').trim();
  }

  /**
   * Transpile Python code string into executable JavaScript.
   * @param {string} pyCode 
   * @returns {{jsCode: string, trackedList: string[], loopVars: string[]}}
   */
  transpile(pyCode) {
    const lines = pyCode.split('\n');
    const jsLines = [
      'let __loop_1_iter = 0;',
      'let __loop_2_iter = 0;',
      'let __loop_3_iter = 0;'
    ];
    const indentStack = [];
    const loopStack = [];
    const declaredVars = new Set();
    const allAssignedVars = new Set();
    const loopVars = [];

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
        const popped = indentStack.pop();
        if (loopStack.length > 0 && popped === loopStack[loopStack.length - 1].indent) {
          loopStack.pop();
        }
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

          return `__py_print([${cleanArgs.trim()}], ${JSON.stringify(sepArg)}, ${JSON.stringify(endArg)}, { ${snapshotProps} }, { outer: __loop_1_iter, inner: __loop_2_iter, depth1: __loop_1_iter, depth2: __loop_2_iter, depth3: __loop_3_iter })`;
        });
      }

      // Convert for var in range(...)
      if (/^for\s+([a-zA-Z_]\w*)\s+in\s+range\((.*)\)\s*:$/.test(line)) {
        line = line.replace(/^for\s+([a-zA-Z_]\w*)\s+in\s+range\((.*)\)\s*:$/, (m, v, args) => {
          declaredVars.add(v);
          loopVars.push(v);
          const depth = loopStack.length + 1;
          loopStack.push({ indent, depth, varName: v });
          if (depth === 1) {
            return `for (let ${v} of __py_range(${args})) { __checkOps(); __loop_1_iter++; __loop_2_iter = 0; __loop_3_iter = 0;`;
          } else if (depth === 2) {
            return `for (let ${v} of __py_range(${args})) { __checkOps(); __loop_2_iter++; __loop_3_iter = 0;`;
          } else {
            return `for (let ${v} of __py_range(${args})) { __checkOps(); __loop_3_iter++;`;
          }
        });
        opensBlock = true;
      }
      // Convert for var in collection
      else if (/^for\s+([a-zA-Z_]\w*)\s+in\s+(.*?)\s*:$/.test(line)) {
        line = line.replace(/^for\s+([a-zA-Z_]\w*)\s+in\s+(.*?)\s*:$/, (m, v, iter) => {
          declaredVars.add(v);
          loopVars.push(v);
          const depth = loopStack.length + 1;
          loopStack.push({ indent, depth, varName: v });
          if (depth === 1) {
            return `for (let ${v} of __py_iter(${iter})) { __checkOps(); __loop_1_iter++; __loop_2_iter = 0; __loop_3_iter = 0;`;
          } else if (depth === 2) {
            return `for (let ${v} of __py_iter(${iter})) { __checkOps(); __loop_2_iter++; __loop_3_iter = 0;`;
          } else {
            return `for (let ${v} of __py_iter(${iter})) { __checkOps(); __loop_3_iter++;`;
          }
        });
        opensBlock = true;
      }
      // Convert while
      else if (/^while\s+(.*?)\s*:$/.test(line)) {
        const depth = loopStack.length + 1;
        loopStack.push({ indent, depth });
        if (depth === 1) {
          line = line.replace(/^while\s+(.*?)\s*:$/, 'while ($1) { __checkOps(); __loop_1_iter++; __loop_2_iter = 0; __loop_3_iter = 0;');
        } else if (depth === 2) {
          line = line.replace(/^while\s+(.*?)\s*:$/, 'while ($1) { __checkOps(); __loop_2_iter++; __loop_3_iter = 0;');
        } else {
          line = line.replace(/^while\s+(.*?)\s*:$/, 'while ($1) { __checkOps(); __loop_3_iter++;');
        }
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

      // Python Builtin functions
      line = line.replace(/\blen\s*\(/g, '__py_len(')
                 .replace(/\babs\s*\(/g, '__py_abs(')
                 .replace(/\bmin\s*\(/g, '__py_min(')
                 .replace(/\bmax\s*\(/g, '__py_max(')
                 .replace(/\bsum\s*\(/g, '__py_sum(')
                 .replace(/\bint\s*\(/g, '__py_int(')
                 .replace(/\bstr\s*\(/g, '__py_str(');

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

    return { jsCode: jsLines.join('\n'), trackedList, loopVars };
  }

  /**
   * Execute Python code and return stdout, print events with variable snapshots, and final scope.
   * @param {string} pyCode 
   * @returns {{success: boolean, stdout: string, rawStdout: string, printEvents: Array, finalScope: Object, loopVars: Array, error?: string}}
   */
  execute(pyCode) {
    try {
      const { jsCode, trackedList, loopVars } = this.transpile(pyCode);
      let stdout = '';
      const printEvents = [];
      let ops = 0;
      const maxOps = this.maxOps;

      function __checkOps() {
        if (++ops > maxOps) throw new Error('Maximum execution steps exceeded (infinite loop protection)');
      }

      function __py_print(argsArray, sep = ' ', end = '\n', vars = {}, iters = {}) {
        const formatted = argsArray.map(a => String(a)).join(sep);
        stdout += formatted + end;
        printEvents.push({
          value: argsArray.length === 1 ? argsArray[0] : formatted,
          formatted,
          vars: { ...vars },
          iters: { ...iters }
        });
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

      function __py_len(x) {
        return x ? (typeof x.length !== 'undefined' ? x.length : Object.keys(x).length) : 0;
      }
      function __py_abs(x) { return Math.abs(x); }
      function __py_min(...args) { return Math.min(...(Array.isArray(args[0]) ? args[0] : args)); }
      function __py_max(...args) { return Math.max(...(Array.isArray(args[0]) ? args[0] : args)); }
      function __py_sum(arr) { return Array.isArray(arr) ? arr.reduce((a, b) => a + b, 0) : 0; }
      function __py_int(x) { return parseInt(x, 10); }
      function __py_str(x) { return String(x); }

      const returnCollector = trackedList
        .map(v => `${JSON.stringify(v)}: (typeof ${v} !== 'undefined' ? ${v} : undefined)`)
        .join(', ');

      const runner = new Function(
        '__py_print', '__py_range', '__py_iter', '__checkOps',
        '__py_len', '__py_abs', '__py_min', '__py_max', '__py_sum', '__py_int', '__py_str',
        `
        ${jsCode}
        return { ${returnCollector} };
      `);

      const finalScope = runner(
        __py_print, __py_range, __py_iter, __checkOps,
        __py_len, __py_abs, __py_min, __py_max, __py_sum, __py_int, __py_str
      );
      return {
        success: true,
        stdout: stdout.trim(),
        rawStdout: stdout,
        printEvents,
        finalScope,
        loopVars
      };
    } catch (err) {
      return {
        success: false,
        stdout: '',
        rawStdout: '',
        printEvents: [],
        finalScope: {},
        loopVars: [],
        error: err.message
      };
    }
  }

  /**
   * Generate human-readable execution trace from print events.
   * @param {Object} execResult 
   * @returns {string}
   */
  generateTrace(execResult) {
    if (!execResult || !execResult.printEvents || execResult.printEvents.length === 0) return '';
    return execResult.printEvents.slice(0, 30).map((ev, idx) => {
      const parts = [];
      if (ev.iters?.outer) parts.push(`outer loop: ${ev.iters.outer}`);
      if (ev.iters?.inner) parts.push(`inner loop: ${ev.iters.inner}`);
      const varEntries = Object.entries(ev.vars || {}).filter(([k]) => !k.startsWith('__'));
      if (varEntries.length > 0) parts.push(varEntries.map(([k, v]) => `${k}=${v}`).join(', '));
      return `Step ${idx + 1} (${parts.join(' | ')}): prints "${ev.formatted}"`;
    }).join('\n');
  }

  /**
   * Automatically detect intent and solve question deterministically.
   * @param {string} questionText 
   * @returns {{solved: boolean, answer?: string, stdout?: string, type?: string, explanation?: string, trace?: string, reason?: string, error?: string}}
   */
  solve(questionText) {
    try {
      const code = this.extractCodeBlock(questionText);
      if (!code) return { solved: false, reason: 'No code block found' };

      const execResult = this.execute(code);
      if (!execResult.success) return { solved: false, reason: `Execution failed: ${execResult.error}` };

      const outerVar = execResult.loopVars?.[0] || 'i';
      const innerVar = execResult.loopVars?.[1] || 'j';

      // Case 1A: "What is the (last/first) number printed in the Mth outer loop and Nth inner loop?"
      const loopOuterInnerMatch = questionText.match(/(?:(last|first)\s+)?(?:number\s+printed|what\s+is\s+(?:the\s+)?(?:last\s+)?number\s+printed|what\s+is\s+printed|what\s+will\s+be\s+printed)\s+in\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+outer\s+loop\s+and\s+(\d+)(?:st|nd|rd|th)?(?:\s*r)?(?:\s+inner)?/i) ||
                                  questionText.match(/(?:(last|first)\s+)?(?:number\s+printed|what\s+is\s+(?:the\s+)?(?:last\s+)?number\s+printed|what\s+is\s+printed|what\s+will\s+be\s+printed)\s+in\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+inner\s+loop\s+and\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+outer/i);
      if (loopOuterInnerMatch) {
        const isReversed = questionText.includes('inner loop and');
        const pos = (loopOuterInnerMatch[1] || 'last').toLowerCase();
        const targetOuter = Number(isReversed ? loopOuterInnerMatch[3] : loopOuterInnerMatch[2]);
        const targetInner = Number(isReversed ? loopOuterInnerMatch[2] : loopOuterInnerMatch[3]);

        const matchingEvents = execResult.printEvents.filter(ev => {
          const outerMatches = (ev.iters && ev.iters.outer === targetOuter) || (ev.vars && ev.vars[outerVar] == targetOuter);
          const innerMatches = (ev.iters && ev.iters.inner === targetInner) || (ev.vars && ev.vars[innerVar] == targetInner);
          return outerMatches && innerMatches;
        });

        if (matchingEvents.length > 0) {
          const selected = pos === 'first' ? matchingEvents[0] : matchingEvents[matchingEvents.length - 1];
          return {
            solved: true,
            answer: String(selected.value),
            type: 'loop_outer_inner_print',
            outerLoop: targetOuter,
            innerLoop: targetInner,
            position: pos,
            stdout: execResult.stdout,
            trace: this.generateTrace(execResult),
            explanation: `In the ${targetOuter}th outer loop and ${targetInner}rd inner loop (${outerVar}=${targetOuter}, ${innerVar}=${targetInner}), the ${pos} printed number is ${selected.value}.`
          };
        }
      }

      // Case 1B: "What is the (last/first) number printed in the Mth outer loop?"
      const outerOnlyMatch = questionText.match(/(?:(last|first)\s+)?number\s+printed\s+in\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+outer\s+loop(?!\s+and\s+\d)/i);
      if (outerOnlyMatch) {
        const pos = (outerOnlyMatch[1] || 'last').toLowerCase();
        const targetOuter = Number(outerOnlyMatch[2]);

        const matchingEvents = execResult.printEvents.filter(ev => {
          return (ev.iters && ev.iters.outer === targetOuter) || (ev.vars && ev.vars[outerVar] == targetOuter);
        });

        if (matchingEvents.length > 0) {
          const selected = pos === 'first' ? matchingEvents[0] : matchingEvents[matchingEvents.length - 1];
          return {
            solved: true,
            answer: String(selected.value),
            type: 'outer_loop_print',
            outerLoop: targetOuter,
            position: pos,
            stdout: execResult.stdout,
            trace: this.generateTrace(execResult),
            explanation: `In the ${targetOuter}th outer loop (${outerVar}=${targetOuter}), the ${pos} printed number is ${selected.value}.`
          };
        }
      }

      // Case 1C: "What is the (last/first) number printed in the Nth inner loop?"
      const innerOnlyMatch = questionText.match(/(?:(last|first)\s+)?number\s+printed\s+in\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+inner\s+loop(?!\s+and\s+\d)/i);
      if (innerOnlyMatch) {
        const pos = (innerOnlyMatch[1] || 'last').toLowerCase();
        const targetInner = Number(innerOnlyMatch[2]);

        const matchingEvents = execResult.printEvents.filter(ev => {
          return (ev.iters && ev.iters.inner === targetInner) || (ev.vars && ev.vars[innerVar] == targetInner);
        });

        if (matchingEvents.length > 0) {
          const selected = pos === 'first' ? matchingEvents[0] : matchingEvents[matchingEvents.length - 1];
          return {
            solved: true,
            answer: String(selected.value),
            type: 'inner_loop_print',
            innerLoop: targetInner,
            position: pos,
            stdout: execResult.stdout,
            trace: this.generateTrace(execResult),
            explanation: `In the ${targetInner}th inner loop (${innerVar}=${targetInner}), the ${pos} printed number is ${selected.value}.`
          };
        }
      }

      // Case 1D: "What will be the value of <var> when the value <val> is printed?"
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
            trace: this.generateTrace(execResult),
            explanation: `When ${targetVal} is printed, variable '${targetVar}' equals ${matchedEvent.vars[targetVar]}.`
          };
        }
      }

      // Case 1E: Total count of prints / executions
      if (/(?:how\s+many\s+times|number\s+of\s+times)\s+(?:will\s+the\s+(?:inner\s+)?loop\s+execute|is\s+printed|is\s+(?:the\s+)?print\s+statement\s+executed|will\s+it\s+print)/i.test(questionText) && execResult.printEvents.length > 0) {
        return {
          solved: true,
          answer: String(execResult.printEvents.length),
          type: 'execution_count',
          count: execResult.printEvents.length,
          stdout: execResult.stdout,
          trace: this.generateTrace(execResult),
          explanation: `The print statement executes ${execResult.printEvents.length} times.`
        };
      }

      // Case 1F: First or Last number printed overall
      const globalPosMatch = questionText.match(/(?:what\s+is\s+(?:the\s+)?)?(last|first)\s+number\s+printed(?:\s+in\s+the\s+output|\?)?/i);
      if (globalPosMatch && execResult.printEvents.length > 0 && !questionText.includes('outer') && !questionText.includes('inner')) {
        const pos = globalPosMatch[1].toLowerCase();
        const ev = pos === 'first' ? execResult.printEvents[0] : execResult.printEvents[execResult.printEvents.length - 1];
        return {
          solved: true,
          answer: String(ev.value),
          type: 'global_pos_print',
          position: pos,
          stdout: execResult.stdout,
          trace: this.generateTrace(execResult),
          explanation: `The ${pos} number printed is ${ev.value}.`
        };
      }

      // Case 2: Standard Output questions
      if (/(?:output|what\s+(?:will\s+be\s+the\s+output|does\s+the\s+following\s+code\s+print|is\s+the\s+output|is\s+printed)|predict\s+the\s+output)/i.test(questionText) && execResult.stdout) {
        return {
          solved: true,
          answer: execResult.stdout,
          type: 'stdout',
          stdout: execResult.stdout,
          trace: this.generateTrace(execResult),
          explanation: `The simulated code outputs: ${execResult.stdout}`
        };
      }

      // Case 3: Final variable value
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
            trace: this.generateTrace(execResult),
            explanation: `At the end of execution, variable '${targetVar}' equals ${execResult.finalScope[targetVar]}.`
          };
        }
      }

      return {
        solved: false,
        stdout: execResult.stdout,
        trace: this.generateTrace(execResult),
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
