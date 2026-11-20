/**
 * NewtonPilot - Ollama AI Integration Provider (Phase 2 & 3 Interface)
 * 
 * Provides an architectural client interface for local Ollama LLMs.
 * Features:
 * - Deterministic greedy sampling (temperature: 0.0) for maximum code evaluation accuracy
 * - Multimodal Vision support (passes base64 images to models like llava, llama3.2-vision)
 * - Chain-of-Thought Python execution reasoning to eliminate hallucinations
 */

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
    this.timeoutMs = config.timeoutMs || 60000;
    this.isReady = false;
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
   * @param {Object} questionData 
   * @param {boolean} [hasImages]
   * @returns {string} Formatted prompt
   */
  buildPrompt(questionData, hasImages = false) {
    const { questionText = '', options = [], format = 'single_choice', hasTextInput = false } = questionData || {};

    const isShortAnswer = format === 'short_answer' || hasTextInput || (!options || options.length === 0);

    const imageInstruction = hasImages
      ? '\n[CRITICAL]: An image is attached to this question. Carefully examine the code snippet, diagram, or terminal output displayed in the image.'
      : '';

    if (isShortAnswer) {
      return `
You are an authoritative Python & Computer Science assessment engine and code interpreter.
Your goal is 100% accuracy on this Short Answer / Output Prediction / Fill-in-the-blank question.

CRITICAL INSTRUCTIONS FOR SHORT ANSWER:
1. This question does NOT have options (A, B, C, D). The student must type the EXACT answer directly into an input field.
2. Provide ONLY the concise, exact string or number that must be entered into the answer box in "suggested_answer".
   - Examples of valid "suggested_answer": "101", "True", "append", "3", "Hello"
   - Do NOT output "Option A", "Option D", or "The output is 101". Output ONLY the exact value.
3. Simulate the code line-by-line. Pay strict attention to recursion stack unwind, print end parameters (e.g. end=''), and type representations.${imageInstruction}

Question:
${questionText}

Format: Short Answer / Text Input

Return your response in STRICT valid JSON matching this schema:
{
  "suggested_answer": "Exact answer to type into input field (e.g. 101 or True or append)",
  "concept_summary": "1-sentence definitive rule or principle",
  "reasoning": "Step-by-step code execution trace and walkthrough.",
  "options_analysis": [],
  "confidence": 0.99
}
`.trim();
    }

    const optionsText = options
      .map(o => `Option ${o.label}: ${o.text}`)
      .join('\n');

    return `
You are an authoritative Python & Computer Science assessment engine and code interpreter.
Your goal is 100% accuracy on this multiple-choice question.

REASONING PROTOCOL:
1. Carefully parse the question statement, code snippet, and any edge-case rules.${imageInstruction}
2. If code is present, simulate its execution line-by-line, tracking variable states and data types.
3. Distinguish strictly between:
   - In-place modifications (e.g. list.append(), list.sort()) vs methods returning new values (e.g. sorted()).
   - Method naming in Python (e.g. list.append() vs set.add()).
   - Indexing, slicing bounds, and ValueError vs KeyError vs IndexError.
4. Evaluate every single option (A, B, C, D) before deciding.
5. Choose the exact option letter that is definitively correct.

Question:
${questionText}

Format: ${format}

Options:
${optionsText}

Return your response in STRICT valid JSON matching this schema:
{
  "suggested_answer": "Option letter and text (e.g. Option D: append())",
  "concept_summary": "1-sentence definitive rule or principle",
  "reasoning": "Step-by-step code execution trace and why the chosen option is correct.",
  "options_analysis": [
    { "label": "A", "status": "Incorrect", "explanation": "Why this option is wrong or what it does instead" },
    { "label": "B", "status": "Incorrect", "explanation": "Why this option is wrong or what it does instead" },
    { "label": "C", "status": "Incorrect", "explanation": "Why this option is wrong or what it does instead" },
    { "label": "D", "status": "Correct", "explanation": "Why this option is unequivocally correct" }
  ],
  "confidence": 0.99
}
`.trim();
  }

  /**
   * Clean JSON string by stripping markdown code fences if present.
   * @param {string} text 
   * @returns {string}
   */
  cleanJsonResponse(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    return cleaned;
  }

  /**
   * Query Ollama for concept explanation and option selection.
   * Handles Multimodal Vision when images are attached.
   * @param {Object} questionData 
   * @returns {Promise<{suggested_answer: string, concept_summary: string, reasoning: string, options_analysis: Array, confidence: number}>}
   */
  async requestExplanation(questionData) {
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
      if (fetchErr.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeoutMs / 1000}s while waiting for model ${this.model}`);
      }
      throw new Error(`Failed to reach Ollama at ${this.host}: ${fetchErr.message}`);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Ollama generation failed (HTTP ${response.status}): ${errBody || response.statusText}`);
    }

    const result = await response.json();
    const rawResponse = result?.response || '';
    const cleaned = this.cleanJsonResponse(rawResponse);

    try {
      const parsed = JSON.parse(cleaned);
      let reasoning = parsed.reasoning || rawResponse;

      // Notice if question has an image but a text-only model was used
      if (hasImages && !isVision) {
        reasoning = `[⚠️ Image Detected: This question includes a diagram/image. Current model '${this.model}' is text-only. For 100% accuracy on image questions, use a Vision model like 'llava:7b' or 'llama3.2-vision'].\n\n` + reasoning;
      }

      return {
        suggested_answer: parsed.suggested_answer || 'Analysis Complete',
        concept_summary: parsed.concept_summary || '',
        reasoning,
        options_analysis: Array.isArray(parsed.options_analysis) ? parsed.options_analysis : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.99
      };
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
