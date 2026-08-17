/**
 * AI 服务调用封装
 * 通过 HTTP 调用独立的 Python AI 服务(FastAPI,默认 8000 端口)
 * 所有方法在 AI 服务不可用时静默降级,不阻断主业务流程
 */
const config = require('../config');

// AI 审核结果常量(与 Product.ai_review_result 对齐)
const AI_REVIEW_RESULT = {
  PASS: 0, // 通过
  SUSPICIOUS: 1, // 可疑
  REJECT: 2 // 违规
};

// AI 服务默认超时(ms)
const AI_TIMEOUT = 5000;

/**
 * 调用 AI 服务的内容审核接口
 * @param {string} title 商品标题
 * @param {string} description 商品描述
 * @param {number} price 售价
 * @returns {Promise<{result: 'pass'|'suspicious'|'reject', reason: string}>}
 */
async function reviewProduct(title, description, price = null) {
  const url = `${config.ai.url}/api/review`;
  const body = JSON.stringify({ title, description, price });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!resp.ok) {
      throw new Error(`AI 服务 HTTP ${resp.status}`);
    }
    const json = await resp.json();
    if (json.code !== 200 || !json.data) {
      throw new Error(json.message || 'AI 服务返回异常');
    }
    return {
      result: json.data.result, // 'pass' | 'suspicious' | 'reject'
      reason: json.data.reason || ''
    };
  } catch (err) {
    clearTimeout(timer);
    // 降级:AI 服务不可用时返回 pass,不阻断发布流程
    console.warn('[AIService] 审核接口调用失败,降级为 pass:', err.message);
    return { result: 'pass', reason: 'AI 审核服务暂不可用,已自动放行(待人工复核)' };
  }
}

/**
 * 把 AI 审核结果映射为商品状态与字段
 * @param {string} aiResult 'pass'|'suspicious'|'reject'
 * @returns {{aiReviewResult: number, newStatus: number}}
 */
function mapAiResultToStatus(aiResult) {
  switch (aiResult) {
    case 'pass':
      return { aiReviewResult: AI_REVIEW_RESULT.PASS, newStatus: 1 }; // 直接上架
    case 'suspicious':
      return { aiReviewResult: AI_REVIEW_RESULT.SUSPICIOUS, newStatus: 0 }; // 待人工复审
    case 'reject':
      return { aiReviewResult: AI_REVIEW_RESULT.REJECT, newStatus: 5 }; // 拒绝
    default:
      return { aiReviewResult: AI_REVIEW_RESULT.PASS, newStatus: 1 };
  }
}

module.exports = {
  AI_REVIEW_RESULT,
  reviewProduct,
  mapAiResultToStatus
};
