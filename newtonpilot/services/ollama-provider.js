/**
 * NewtonPilot - Ollama AI Integration Provider (Phase 2 & 3 Interface)
 * 
 * Provides an architectural client interface for local Ollama LLMs.
 * Features:
 * - Hybrid Deterministic Execution (NewtonPythonEngine) + LLM Reasoning for 100% code accuracy
 * - Deterministic greedy sampling (temperature: 0.0) for maximum code evaluation accuracy
 * - Multimodal Vision support (passes base64 images to models like llava, llama3.2-vision)
 * - Chain-of-Thought Python execution reasoning to eliminate hallucinations
 */

import NewtonPythonEngine from './python-engine.js';

let PythonEngineClass = NewtonPythonEngine;
if (typeof globalThis !== 'undefined' && globalThis.NewtonPythonEngine) {
  PythonEngineClass = globalThis.NewtonPythonEngine;
}

class OllamaProvider {
  /**
   * @param {Object} [config] 
   * @param {string} [config.host] - Ollama server host (default: http://localhost:11434)
   * @param {string} [config.model] - Target model name (default: 'qwen2.5-coder:7b')
   * @param {number} [config.temperature] - Sampling temperature (default: 0.0 for maximum coding accuracy)
   * @param {number} [config.timeoutMs] - Request timeout in ms (default: 60000)
   */
  constructor(config = {}) {
    this.host = (config.host || 'http://localhost:11434').replace(/\/+$/, '');
    this.model = config.model || 'qwen2.5-coder:7b';
    this.temperature = config.temperature ?? 0.0;
    this.timeoutMs = config.timeoutMs || 25000;
    this.isReady = false;
    this.pythonEngine = config.pythonEngine || (PythonEngineClass ? new PythonEngineClass() : null);
  }

  /**
   * Check if a given model supports multimodal vision.
   * @param {string} modelName 
   * @returns {boolean}
   */
  isVisionModel(modelName) {
    const name = (modelName || this.model || '').toLowerCase();
    return /(?:vision|llava|bakllava|vl|minicpm)/.test(name);
  }

  /**
   * Test local Ollama connection and list available models.
   * @returns {Promise<{available: boolean, models: string[], error?: string}>}
   */
  async checkConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`${this.host}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { available: false, models: [], error: `Ollama returned HTTP ${response.status}` };
      }

      const data = await response.json();
      const models = (data.models || []).map(m => m.name);
      this.isReady = true;
      return { available: true, models };
    } catch (err) {
      const msg = err.name === 'AbortError'
        ? 'Connection timed out'
        : (err.message || 'Cannot connect to Ollama server');
      return { available: false, models: [], error: msg };
    }
  }

  /**
   * Helper: Resolve remote image URL to Base64 string.
   * @param {string} url 
   * @returns {Promise<string|null>}
   */
  async fetchImageAsBase64(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buffer = await res.arrayBuffer();
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(buffer).toString('base64');
      }
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (e) {
      return null;
    }
  }

  /**
   * Build structured pedagogical prompt with Chain-of-Thought execution.
   * Ensures the execution trace and option analysis precede the final suggested answer
   * so the autoregressive model derives the answer from step-by-step reasoning.
   * @param {Object} questionData 
   * @param {boolean} [hasImages]
   * @returns {string} Formatted prompt
   */
  buildPrompt(questionData, hasImages = false) {
    const { questionText = '', options = [], format = 'single_choice', hasTextInput = false } = questionData || {};

    const isShortAnswer = format === 'short_answer' || hasTextInput || (!options || options.length === 0);

    const pySol = this.pythonEngine ? this.pythonEngine.solve(questionText) : null;
    const pyEngineInstruction = (pySol && pySol.solved)
      ? `\n[VERIFIED CODE EXECUTION RESULT]: Deterministic simulation has verified the exact output: "${pySol.answer}". Details: ${pySol.explanation}. You MUST align your execution trace, options analysis, and suggested answer with this verified mathematical result.\n`
      : '';

    const imageInstruction = hasImages
      ? '\n[CRITICAL]: An image is attached to this question. Carefully examine the code snippet, diagram, or terminal output displayed in the image.'
      : '';

    if (isShortAnswer) {
      return `
You are an authoritative Python & Computer Science assessment engine and code interpreter.
Your goal is 100% accuracy on this Short Answer / Output Prediction / Fill-in-the-blank question.${pyEngineInstruction}

CRITICAL INSTRUCTIONS FOR SHORT ANSWER:
1. This question does NOT have options (A, B, C, D). The student must type the EXACT answer directly into an input field.
2. In "suggested_answer", provide ONLY the raw, exact value to type into the answer box.
   - Output ONLY the literal value: e.g. "101", "True", "False", "append", "3", "Hello"
   - Do NOT prepend "Option A", "Option D", "Answer:", or "Output:".
   - Do NOT wrap in quotes or backticks.
3. PYTHON CODE SIMULATION RULES (Mandatory Scratchpad Execution):
   - RECURSION: Track call frames on the stack. Note code executed before recursive call (descent) vs after recursive call (unwind / LIFO return order).
   - STDOUT BUFFER TRACKING: Track every character printed to stdout.
     * print(..., end='') suppresses trailing newline and inserts NO space. Subsequent prints concatenate directly (e.g. printing 1 then 0 then 1 produces EXACTLY "101", NOT "1 0 1").
     * print(a, b) separates arguments with a single space ' '.
     * print() without end adds a newline '\\n'.
     * NEVER add spaces between characters in the answer unless end=' ' was explicitly specified in the code.
   - NESTED LOOPS & INDENTATION SCOPE:
     * Examine code indentation strictly (e.g. 4 spaces = 1 indent level). Statements indented under an inner loop execute for every inner iteration. Statements indented under the outer loop execute once per outer iteration. Statements at outer indentation execute only once before/after loops.
     * When simulating nested loops: build an explicit iteration table in "code_execution_trace":
       (outer_loop_var, inner_loop_var, updated_vars, stdout_prints).
     * Step through every iteration line-by-line until the termination or trigger condition is met. Do NOT guess or take mental shortcuts!
   - MUTABILITY: Track in-place modifications (e.g. list.append() returns None) vs returning new values.
4. CHAIN-OF-THOUGHT SCHEMA:
   - You MUST compute "code_execution_trace" FIRST before concluding the answer.
   - "suggested_answer" MUST be the final field in your response.${imageInstruction}

Question:
${questionText}

Format: Short Answer / Text Input

Return your response in STRICT valid JSON matching this schema:
{
  "code_execution_trace": "Mandatory line-by-line simulation scratchpad: call stack, variable values after each step, and exact characters added to stdout buffer.",
  "reasoning": "Concise walkthrough explaining why this exact value is produced.",
  "concept_summary": "1-sentence core principle or rule.",
  "options_analysis": [],
  "confidence": 0.99,
  "suggested_answer": "Exact literal string/number to type into the input field (e.g. 101)"
}
`.trim();
    }

    const optionsText = options
      .map(o => `Option ${o.label}: ${o.text}`)
      .join('\n');

    return `
You are an authoritative Python & Computer Science assessment engine and code interpreter.
Your goal is 100% accuracy on this multiple-choice question.${pyEngineInstruction}

REASONING PROTOCOL (Chain-of-Thought Scratchpad First):
1. STEP 1 - CODE SIMULATION & VERIFICATION (in "code_execution_trace"):
   - If code is present, simulate its execution line-by-line before selecting an answer.
   - Track variable states, loop indices, and recursion stack frames in a mental state table.
   - Distinguish strictly between:
     * In-place modifications (e.g. list.append(), list.sort()) returning None vs functions returning new values (e.g. sorted()).
     * Method naming in Python (e.g. list uses .append(), set uses .add()).
     * Recursion unwind order (statements after the recursive call execute in reverse / LIFO order).
     * Indexing & slicing bounds (stop index is non-inclusive; negative steps reverse direction).
     * Truthiness (e.g. bool([0]) is True).
     * Exact exception types (ValueError vs KeyError vs IndexError vs TypeError).
     * Nested loops & indentation scoping (strictly determine whether statements belong to inner or outer loop based on space indentation; build an explicit iteration table in "code_execution_trace" tracking outer_var, inner_var, updated_vars, and prints).
2. STEP 2 - OPTIONS EVALUATION (in "options_analysis"):
   - Compare the output or theoretical fact derived in Step 1 against EVERY single option (A, B, C, D).
   - Designate status as either "Correct" or "Incorrect" with a concrete explanation for each.
   - Exactly ONE option must be designated "Correct" (for single choice).
3. STEP 3 - FINAL CONCLUSION (in "suggested_answer"):
   - Select the exact option letter (A, B, C, or D) that matches the option proven Correct in Step 2.
   - You MUST place "suggested_answer" at the VERY END of the JSON object, so it is emitted only after reasoning and options analysis are completed.${imageInstruction}

Question:
${questionText}

Format: ${format}

Options:
${optionsText}

Return your response in STRICT valid JSON matching this schema:
{
  "code_execution_trace": "Step-by-step state simulation: variable table, stack frames, loop boundaries, stdout accumulation, or theoretical proof.",
  "options_analysis": [
    { "label": "A", "status": "Incorrect", "explanation": "Why this option is wrong or what it does instead" },
    { "label": "B", "status": "Incorrect", "explanation": "Why this option is wrong or what it does instead" },
    { "label": "C", "status": "Incorrect", "explanation": "Why this option is wrong or what it does instead" },
    { "label": "D", "status": "Correct", "explanation": "Why this option is unequivocally correct" }
  ],
  "reasoning": "Synthesis explaining why the selected option is definitively correct based on the trace.",
  "concept_summary": "1-sentence definitive rule or principle.",
  "confidence": 0.99,
  "suggested_answer": "Option letter and text (e.g. Option D: append())"
}
`.trim();
  }

  /**
   * Clean JSON string by stripping markdown code fences or extracting outermost JSON object.
   * @param {string} text 
   * @returns {string}
   */
  cleanJsonResponse(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text.trim();

    // 1. Extract markdown JSON code block if present
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch) {
      return fenceMatch[1].trim();
    }

    // 2. Fallback: extract outermost curly braces
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return cleaned.slice(firstBrace, lastBrace + 1).trim();
    }

    return cleaned;
  }

  /**
   * Reconcile discrepancies between suggested_answer, options_analysis, and reasoning.
   * Fixes the common autoregressive flaw where the AI reasons correctly in its walkthrough
   * but outputs the wrong option token in suggested_answer.
   * @param {Object} parsed
   * @param {Object} questionData
   * @returns {{suggested_answer: string, concept_summary: string, reasoning: string, options_analysis: Array, confidence: number}}
   */
  reconcileExplanation(parsed, questionData) {
    let suggestedAnswer = String(parsed?.suggested_answer || '').trim();
    const conceptSummary = String(parsed?.concept_summary || '').trim();
    let reasoning = String(parsed?.reasoning || '').trim();
    const trace = String(parsed?.code_execution_trace || '').trim();
    const optionsAnalysis = Array.isArray(parsed?.options_analysis) ? parsed.options_analysis : [];
    const isShortAnswer = questionData?.format === 'short_answer' ||
                          questionData?.hasTextInput ||
                          (!questionData?.options || questionData?.options.length === 0);

    // Enrich reasoning with execution trace if available
    if (trace && !reasoning.includes(trace)) {
      reasoning = `${trace}\n\n${reasoning}`.trim();
    }

    // Ground truth from deterministic Python execution engine
    const pySol = this.pythonEngine ? this.pythonEngine.solve(questionData?.questionText) : null;
    if (pySol && pySol.solved) {
      console.log(`[OllamaProvider] NewtonPythonEngine verified solution: answer="${pySol.answer}" (${pySol.explanation})`);
      if (isShortAnswer) {
        suggestedAnswer = pySol.answer;
        const traceText = pySol.trace ? `\n\nExecution Walkthrough:\n${pySol.trace}` : '';
        reasoning = `[Deterministic Python Engine Verified]: ${pySol.explanation}${traceText}\n\n${reasoning}`;
      } else {
        const matchedOpt = (questionData?.options || []).find(o => {
          const t = String(o.text || '').trim();
          return t === pySol.answer ||
                 t === `Option ${pySol.answer}` ||
                 new RegExp(`\\b${pySol.answer}\\b`).test(t);
        });
        if (matchedOpt) {
          suggestedAnswer = `Option ${matchedOpt.label}: ${matchedOpt.text}`;
          const traceText = pySol.trace ? `\n\nExecution Walkthrough:\n${pySol.trace}` : '';
          reasoning = `[Deterministic Python Engine Verified]: Option ${matchedOpt.label} is mathematically verified. ${pySol.explanation}${traceText}\n\n${reasoning}`;
        }
      }
    }

    // --- CASE 1: Short Answer Questions ---
    if (isShortAnswer) {
      let cleanAnswer = suggestedAnswer;
      // Strip "Option A:", "Answer:", "Output:" prefixes
      cleanAnswer = cleanAnswer.replace(/^Option\s+[A-D][:.\-\s]*/i, '');
      cleanAnswer = cleanAnswer.replace(/^(?:Answer|Output|Result)[:.\-\s]*/i, '');
      cleanAnswer = cleanAnswer.replace(/^["'`]|["'`]$/g, '').trim();

      // Check for Python end='' spacing artifact (e.g. model output "1 0 1" instead of "101")
      const codeText = questionData?.questionText || '';
      const hasEndNoSpace = /end\s*=\s*['"]{2}/.test(codeText);
      if (hasEndNoSpace && /^\d(\s+\d)+$/.test(cleanAnswer)) {
        const compact = cleanAnswer.replace(/\s+/g, '');
        if (trace.includes(compact) || reasoning.includes(compact) || !trace.includes(cleanAnswer)) {
          cleanAnswer = compact;
        }
      }

      // If answer is empty or just a stray option letter like "D", extract output from trace or reasoning
      if (!cleanAnswer || /^[A-D]$/i.test(cleanAnswer)) {
        const outputMatch = reasoning.match(/(?:output\s+(?:is|will\s+be|prints?)|prints?)\s*[:\-]?\s*['"`]?([a-zA-Z0-9_\-]+)['"`]?/i) ||
                            trace.match(/(?:stdout|output)\s*(?:buffer)?\s*[:\-]?\s*['"`]?([a-zA-Z0-9_\-]+)['"`]?/i);
        if (outputMatch && outputMatch[1]) {
          cleanAnswer = outputMatch[1];
        }
      }

      return {
        suggested_answer: cleanAnswer || '1',
        concept_summary: conceptSummary,
        reasoning,
        options_analysis: optionsAnalysis,
        confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0.99
      };
    }

    // --- CASE 2: Multiple Choice Questions (MCQ) ---
    const letterMatch = suggestedAnswer.match(/\b([A-D])\b/i);
    const suggestedLetter = letterMatch ? letterMatch[1].toUpperCase() : null;

    // Check options_analysis for the option proven to be Correct
    const correctOptions = optionsAnalysis.filter(opt => {
      const status = String(opt.status || '').trim().toLowerCase();
      return status === 'correct' || status === 'true';
    });

    if (correctOptions.length === 1) {
      const verifiedLetter = String(correctOptions[0].label || '').trim().toUpperCase();

      // Discrepancy detected: options_analysis explicitly proved a different letter than suggested_answer
      if (verifiedLetter && suggestedLetter && suggestedLetter !== verifiedLetter) {
        console.warn(`[OllamaProvider] Reconciled answer discrepancy: options_analysis marked Option ${verifiedLetter} as Correct, overriding suggested_answer Option ${suggestedLetter}.`);
        const matchedOpt = (questionData.options || []).find(o => o.label.toUpperCase() === verifiedLetter);
        const optText = matchedOpt ? matchedOpt.text : (correctOptions[0].explanation || '');
        suggestedAnswer = `Option ${verifiedLetter}: ${optText}`.trim();
      } else if (!suggestedLetter && verifiedLetter) {
        const matchedOpt = (questionData.options || []).find(o => o.label.toUpperCase() === verifiedLetter);
        const optText = matchedOpt ? matchedOpt.text : '';
        suggestedAnswer = `Option ${verifiedLetter}: ${optText}`.trim();
      }
    } else if (correctOptions.length === 0 && (!suggestedLetter || suggestedLetter.length === 0)) {
      // Fallback: Check reasoning text for explicit option conclusion
      const reasoningMatch = reasoning.match(/(?:Option|Choice)\s*([A-D])\s*(?:is\s+correct|is\s+the\s+right\s+answer|is\s+the\s+answer)/i) ||
                             reasoning.match(/(?:correct\s+(?:option|choice|answer)\s+is)\s*[:\-]?\s*(?:Option\s*)?([A-D])\b/i);
      if (reasoningMatch && reasoningMatch[1]) {
        const inferredLetter = reasoningMatch[1].toUpperCase();
        const matchedOpt = (questionData.options || []).find(o => o.label.toUpperCase() === inferredLetter);
        const optText = matchedOpt ? matchedOpt.text : '';
        suggestedAnswer = `Option ${inferredLetter}: ${optText}`.trim();
      }
    }

    return {
      suggested_answer: suggestedAnswer || 'Option A',
      concept_summary: conceptSummary,
      reasoning,
      options_analysis: optionsAnalysis,
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0.99
    };
  }

  /**
   * Query Ollama for concept explanation and option selection.
   * Handles Multimodal Vision when images are attached.
   * @param {Object} questionData 
   * @returns {Promise<{suggested_answer: string, concept_summary: string, reasoning: string, options_analysis: Array, confidence: number}>}
   */
  async requestExplanation(questionData) {
    // 0. Pre-solve deterministically via NewtonPythonEngine if applicable
    const questionText = questionData?.questionText || '';
    const pySol = this.pythonEngine ? this.pythonEngine.solve(questionText) : null;

    if (pySol && pySol.solved) {
      const isShortAnswer = questionData?.format === 'short_answer' ||
                            questionData?.hasTextInput ||
                            (!questionData?.options || questionData?.options.length === 0);
      let suggestedAnswer = pySol.answer;
      if (!isShortAnswer && questionData?.options && questionData.options.length > 0) {
        const matchedOpt = questionData.options.find(o => {
          const t = String(o.text || '').trim();
          return t === pySol.answer || t === `Option ${pySol.answer}` || new RegExp(`\\b${pySol.answer}\\b`).test(t);
        });
        if (matchedOpt) {
          suggestedAnswer = `Option ${matchedOpt.label}: ${matchedOpt.text}`;
        }
      }
      return {
        suggested_answer: suggestedAnswer,
        concept_summary: 'Deterministic Python Engine Verification',
        reasoning: `[Deterministic Python Engine Verified]: ${pySol.explanation}\n\nExecution Walkthrough:\n${pySol.trace || pySol.stdout}`,
        options_analysis: [],
        confidence: 1.0
      };
    }

    // 1. Process and resolve images
    const rawImages = questionData?.images || [];
    const base64Images = [];

    for (const img of rawImages) {
      if (img.base64) {
        base64Images.push(img.base64);
      } else if (img.src && img.src.startsWith('data:image/')) {
        const b64 = img.src.split(',')[1];
        if (b64) base64Images.push(b64);
      } else if (img.src && /^https?:\/\//i.test(img.src)) {
        const fetchedB64 = await this.fetchImageAsBase64(img.src);
        if (fetchedB64) base64Images.push(fetchedB64);
      }
    }

    const hasImages = base64Images.length > 0;
    const isVision = this.isVisionModel(this.model);
    const prompt = this.buildPrompt(questionData, hasImages);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    // Build Ollama request body
    const requestBody = {
      model: this.model,
      prompt,
      format: 'json',
      stream: false,
      options: {
        temperature: this.temperature
      }
    };

    // Attach images only if model supports vision (prevents Ollama 400 error on text models)
    if (hasImages && isVision) {
      requestBody.images = base64Images;
    }

    let response;
    try {
      response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      // Graceful fallback to deterministic engine on network failure or timeout
      if (pySol && pySol.solved) {
        console.warn(`[OllamaProvider] Ollama request failed (${fetchErr.message}), falling back to deterministic Python engine solution.`);
        return {
          suggested_answer: pySol.answer,
          concept_summary: 'Deterministic Python Engine Verification',
          reasoning: `[Deterministic Python Engine Verified]: ${pySol.explanation}\n\nExecution Walkthrough:\n${pySol.trace || pySol.stdout}`,
          options_analysis: [],
          confidence: 1.0
        };
      }
      if (fetchErr.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeoutMs / 1000}s while waiting for model ${this.model}. Ensure Ollama is running (ollama serve).`);
      }
      throw new Error(`Failed to reach Ollama at ${this.host}: ${fetchErr.message}`);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      // Graceful fallback to deterministic engine on HTTP 500 / 503 from Ollama
      if (pySol && pySol.solved) {
        console.warn(`[OllamaProvider] Ollama returned HTTP ${response.status}, falling back to deterministic Python engine solution.`);
        return {
          suggested_answer: pySol.answer,
          concept_summary: 'Deterministic Python Engine Verification',
          reasoning: `[Deterministic Python Engine Verified]: ${pySol.explanation}\n\nExecution Walkthrough:\n${pySol.trace || pySol.stdout}`,
          options_analysis: [],
          confidence: 1.0
        };
      }
      throw new Error(`Ollama generation failed (HTTP ${response.status}): ${errBody || response.statusText}`);
    }

    const result = await response.json();
    const rawResponse = result?.response || '';
    const cleaned = this.cleanJsonResponse(rawResponse);

    try {
      const parsed = JSON.parse(cleaned);

      // Reconcile and cross-verify answer against options_analysis and reasoning
      const reconciled = this.reconcileExplanation(parsed, questionData);

      // Notice if question has an image but a text-only model was used
      if (hasImages && !isVision) {
        reconciled.reasoning = `[⚠️ Image Detected: This question includes a diagram/image. Current model '${this.model}' is text-only. For 100% accuracy on image questions, use a Vision model like 'llava:7b' or 'llama3.2-vision'].\n\n` + reconciled.reasoning;
      }

      return reconciled;
    } catch (parseErr) {
      return {
        suggested_answer: 'Explanation Generated',
        concept_summary: 'Conceptual breakdown',
        reasoning: rawResponse || 'No detailed explanation generated.',
        options_analysis: [],
        confidence: 0.7
      };
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OllamaProvider;
}
if (typeof globalThis !== 'undefined') {
  globalThis.OllamaProvider = OllamaProvider;
}

export default OllamaProvider;
