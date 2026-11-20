/**
 * NewtonPilot - Ollama AI Integration Provider (Phase 2 Interface)
 * 
 * Provides an architectural client interface for local Ollama LLMs.
 * Designed for learning explanations and concept review in Phase 2.
 * 
 * NOTE: Unattended answering and automatic assessment submission are strictly prohibited.
 */

class OllamaProvider {
  /**
   * @param {Object} [config] 
   * @param {string} [config.host] - Ollama server host (default: http://localhost:11434)
   * @param {string} [config.model] - Target model name (e.g. 'qwen2.5-coder:7b', 'llama3.2:1b')
   * @param {number} [config.temperature] - Sampling temperature (default: 0.2)
   * @param {number} [config.timeoutMs] - Request timeout in ms (default: 60000)
   */
  constructor(config = {}) {
    this.host = (config.host || 'http://localhost:11434').replace(/\/+$/, '');
    this.model = config.model || 'qwen2.5-coder:7b';
    this.temperature = config.temperature ?? 0.2;
    this.timeoutMs = config.timeoutMs || 60000;
    this.isReady = false;
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
   * Build structured pedagogical prompt from extracted question data.
   * @param {Object} questionData 
   * @returns {string} Formatted prompt
   */
  buildPrompt(questionData) {
    const { questionText = '', options = [], format = 'single_choice' } = questionData || {};

    const optionsText = options
      .map(o => `Option ${o.label}: ${o.text}`)
      .join('\n');

    return `
You are an expert computer science and programming tutor helping a student understand a practice quiz question.
Analyze the question thoroughly. Identify the correct answer, explain the core programming concept clearly, and explain why each incorrect option is wrong.

Question:
${questionText}

Format: ${format}

Options:
${optionsText}

Return your response in STRICT valid JSON matching this schema:
{
  "suggested_answer": "Option letter and text (e.g. Option D: append())",
  "concept_summary": "1-2 sentence core concept explanation",
  "reasoning": "Step-by-step conceptual walkthrough of why the correct option is right.",
  "options_analysis": [
    { "label": "A", "status": "Incorrect", "explanation": "Why this option is wrong or what it actually does" },
    { "label": "B", "status": "Incorrect", "explanation": "Why this option is wrong or what it actually does" },
    { "label": "C", "status": "Incorrect", "explanation": "Why this option is wrong or what it actually does" },
    { "label": "D", "status": "Correct", "explanation": "Why this option is the exact right answer" }
  ],
  "confidence": 0.98
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
   * Query Ollama for concept explanation.
   * @param {Object} questionData 
   * @returns {Promise<{suggested_answer: string, concept_summary: string, reasoning: string, options_analysis: Array, confidence: number}>}
   */
  async requestExplanation(questionData) {
    const prompt = this.buildPrompt(questionData);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response;
    try {
      response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          format: 'json',
          stream: false,
          options: {
            temperature: this.temperature
          }
        }),
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
      return {
        suggested_answer: parsed.suggested_answer || 'Analysis Complete',
        concept_summary: parsed.concept_summary || '',
        reasoning: parsed.reasoning || rawResponse,
        options_analysis: Array.isArray(parsed.options_analysis) ? parsed.options_analysis : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95
      };
    } catch (parseErr) {
      // Fallback schema if model returned unformatted text
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
