/**
 * LLM 客户端封装
 * 直接通过 OpenAI 兼容协议调用智谱 GLM-4-Flash(无需独立 Python AI 服务)
 * 所有方法在 LLM 不可用时抛 LLMError,由调用方决定降级策略
 */
const config = require('../config');

class LLMError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LLMError';
  }
}

class LLMClient {
  constructor() {
    this.apiKey = config.llm.apiKey;
    this.baseUrl = config.llm.baseUrl.replace(/\/$/, '');
    this.model = config.llm.model;
    this.temperature = config.llm.temperature;
    this.timeout = config.llm.timeout;
  }

  /** LLM 是否可用(已配置 API Key) */
  get available() {
    return Boolean(this.apiKey);
  }

  /**
   * 调用 LLM 进行对话
   * @param {string} systemPrompt 系统提示词(角色/规则)
   * @param {string} userMessage 用户输入
   * @param {number} [temperature] 温度,不传则用默认值
   * @returns {Promise<string>} LLM 返回的文本
   * @throws {LLMError} 调用失败
   */
  async chat(systemPrompt, userMessage, temperature = null) {
    if (!this.available) {
      throw new LLMError('LLM 未配置 API Key');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: temperature !== null ? temperature : this.temperature
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new LLMError(`LLM HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }

      const json = await resp.json();
      const content = json?.choices?.[0]?.message?.content;
      if (!content) {
        throw new LLMError('LLM 返回内容为空');
      }
      return content.trim();
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof LLMError) throw err;
      const isTimeout = err.name === 'AbortError';
      console.error(`[LLM] 调用失败: ${err.name}: ${err.message}`);
      throw new LLMError(isTimeout ? 'LLM 调用超时' : `LLM 调用失败: ${err.message}`);
    }
  }
}

// 全局单例
const llmClient = new LLMClient();

module.exports = { llmClient, LLMError, LLMClient };
