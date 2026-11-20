/**
 * NewtonPilot - Ollama AI Integration Provider (Phase 2 Interface)
 * 
 * Provides an architectural blueprint and client interface for local Ollama LLMs.
 * Designed for learning explanations and concept review in Phase 2.
 * 
 * NOTE: Unattended answering and automatic assessment progression are strictly prohibited.
 */

class OllamaProvider {
  /**
   * @param {Object} config 
   * @param {string} [config.host] - Ollama server host (default: http://localhost:11434)
   * @param {string} [config.model] - Target model name (e.g. 'llama3', 'mistral', 'deepseek-r1')
   * @param {number} [config.temperature] - Sampling temperature
   */
  constructor(config = {}) {
    this.host = config.host || 'http://localhost:11434';
    this.model = config.model || 'llama3';
    this.temperature = config.temperature ?? 0.2;
    this.isReady = false;
  }

  /**
   * Test local Ollama connection and list available models.
   * @returns {Promise<{available: boolean, models: string[], error?: string}>}
   */
  async checkConnection() {
    try {
      const response = await fetch(`${this.host}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        return { available: false, models: [], error: `HTTP ${response.status}` };
      }
      const data = await response.json();
      const models = (data.models || []).map(m => m.name);
      this.isReady = true;
      return { available: true, models };
    } catch (err) {
      return { available: false, models: [], error: err.message || 'Cannot connect to Ollama' };
    }
  }

  /**
   * Build structured pedagogical prompt from extracted question data.
   * @param {Object} questionData 
   * @returns {string} Formatted prompt
   */
  buildPrompt(questionData) {
    const { questionText, options = [], format } = questionData;
    
    let optionsText = options
      .map(o => `[${o.label}] ${o.text}`)
      .join('\n');

    return `
You are an expert computer science tutor assisting a student with understanding a practice quiz question.
Provide a clear pedagogical breakdown explaining the concept, why the correct answer is correct, and why other options are incorrect.

Question:
${questionText}

Format: ${format}

Options:
${optionsText}

Return your response in strictly valid JSON matching this schema:
{
  "question": "${questionText.replace(/"/g, '\\"')}",
  "suggested_answer": "Option letter (e.g. Option A)",
  "reasoning": "Step-by-step conceptual explanation helping the student learn.",
  "confidence": 0.95
}
`.trim();
  }

  /**
   * Query Ollama for concept explanation (Prepared for Phase 2).
   * @param {Object} questionData 
   * @returns {Promise<{question: string, suggested_answer: string, reasoning: string, confidence: number}>}
   */
  async requestExplanation(questionData) {
    if (!this.isReady) {
      const status = await this.checkConnection();
      if (!status.available) {
        throw new Error(`Ollama service unavailable at ${this.host}: ${status.error}`);
      }
    }

    const prompt = this.buildPrompt(questionData);

    const response = await fetch(`${this.host}/api/generate`, {
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
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama generation failed with status ${response.status}`);
    }

    const result = await response.json();
    try {
      return JSON.parse(result.response);
    } catch (e) {
      // Fallback schema if model returned unformatted text
      return {
        question: questionData.questionText,
        suggested_answer: 'Parse Error',
        reasoning: result.response,
        confidence: 0.5
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
