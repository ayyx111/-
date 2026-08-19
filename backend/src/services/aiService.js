/**
 * AI 服务(内容审核)
 * 直接在 Node 后端内完成双层审核,不再 HTTP 调用独立 Python 服务
 * 第一层:规则词表快速检测违禁/敏感词(秒级,零成本)
 * 第二层:规则无命中时调用 GLM-4-Flash 进行语义级审核
 * LLM 不可用时降级为纯规则审核,不阻断业务
 */
const { llmClient, LLMError } = require('./llmClient');

// AI 审核结果常量(与 Product.ai_review_result 对齐)
const AI_REVIEW_RESULT = {
  PASS: 0, // 通过
  SUSPICIOUS: 1, // 可疑
  REJECT: 2 // 违规
};

// 违禁词列表(直接拒绝):违法、危险、平台禁止交易品类
const BANNED_WORDS = [
  // 假冒伪劣
  '假冒', '假货', '高仿', '精仿', 'A货', 'a货', '1:1', '1比1', '山寨', '造假',
  // 危险物品
  '枪支', '气枪', '枪械', '刀具', '管制刀具', '匕首', '弩', '弓箭', '弹弓',
  '爆炸物', '炸药', '雷管', '烟花', '爆竹', '弹药', '子弹',
  // 毒品药品
  '毒品', '大麻', '冰毒', '摇头丸', '药品', '处方药', '麻醉药', '兴奋剂',
  // 违法违规
  '赃物', '偷来', '盗窃', '走私', '假钞', '假币', '伪造', '刻章', '办证',
  // 信息/隐私
  '身份证', '银行卡', '信用卡', '手机号', '个人信息', '学生信息', '学信网',
  // 学术不端
  '代写', '代考', '替考', '作弊', '作弊器', '考试答案', '论文代写', '枪手',
  // 不良信息
  '色情', '裸聊', '性服务', '赌博', '博彩', '彩票', '刷单', '刷信誉',
  // 保护动植物
  '象牙', '犀牛角', '保护动物', '野生动物',
  // 其他
  '烟草', '香烟', '电子烟', '酒', '白酒', '管制器具'
];

// 敏感词列表(标记可疑,提示修改):引导脱离平台交易等风险行为
const SENSITIVE_WORDS = [
  '私下交易', '线下转账', '微信转账', '支付宝转账', '绕过平台', '脱离平台',
  '加微信', '加QQ', '加qq', '加v', '加V', '扫码付款', '二维码付款',
  '定金', '预付款', '先付款', '包邮出'
];

// 价格异常阈值
const PRICE_TOO_LOW = 0;
const PRICE_TOO_HIGH = 100000;

// LLM 审核系统提示词
const LLM_REVIEW_SYSTEM_PROMPT = `你是「校园版咸鱼」二手交易平台的内容审核员。
你的任务是判断一个商品发布内容是否合规。

【平台规则】
禁止发布:假冒伪劣、危险物品(刀具/枪支/爆炸物)、毒品药品、赃物/走私、
        个人隐私信息、代写代考等学术不端、色情赌博、保护动植物、烟酒等。
限制发布:引导脱离平台交易(加微信/线下转账/扫码付款)、过高定价、虚假宣传等。

【输出格式】
必须严格输出 JSON,不要包含任何额外文字或代码块标记:
{"result": "pass" | "suspicious" | "reject", "reason": "简要说明原因(15字内)"}

判定标准:
- pass: 正常的二手商品,无明显违规
- suspicious: 有潜在风险或打擦边球,建议人工复审
- reject: 明确违规,应直接拒绝`;

/**
 * 解析 LLM 返回的 JSON,容错处理
 * @param {string} reply
 * @returns {{result:string, reason:string}|null}
 */
function parseLlmReviewReply(reply) {
  try {
    let cleaned = reply.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.includes('\n') ? cleaned.split('\n').slice(1).join('\n') : cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
    }
    const data = JSON.parse(cleaned);
    let result = data.result;
    const reason = data.reason || '';
    if (!['pass', 'suspicious', 'reject'].includes(result)) {
      result = 'pass';
    }
    return { result, reason };
  } catch (e) {
    console.warn(`[AIService] 解析 LLM 审核回复失败: ${e.message}, 原始: ${reply.slice(0, 200)}`);
    return null;
  }
}

/**
 * 调用 LLM 进行语义级审核,失败返回 null
 */
async function llmReview(title, description, price) {
  if (!llmClient.available) return null;
  try {
    const userMsg =
      `标题:${title}\n` +
      `描述:${description}\n` +
      `价格:${price !== null && price !== undefined ? price : '未填'} 元\n` +
      `请审核上述商品内容,严格按 JSON 格式输出审核结果。`;
    const reply = await llmClient.chat(LLM_REVIEW_SYSTEM_PROMPT, userMsg, 0.1);
    return parseLlmReviewReply(reply);
  } catch (e) {
    if (e instanceof LLMError) {
      console.warn(`[AIService] LLM 审核调用失败: ${e.message}`);
    } else {
      console.warn(`[AIService] LLM 审核异常: ${e.message}`);
    }
    return null;
  }
}

/**
 * 内容审核主流程(双层)
 * 第一层:规则词表检测违禁词/敏感词/价格异常
 * 第二层:规则无命中时调用 LLM 进行语义级审核
 * LLM 不可用时降级为纯规则审核
 * @returns {Promise<{result:'pass'|'suspicious'|'reject', reason:string, source:'rule'|'llm'}>}
 */
async function reviewProduct(title, description = '', price = null) {
  const text = `${title || ''} ${description || ''}`;

  // ===== 第一层:规则词表快速检测 =====

  // 1. 违禁词检测(直接拒绝)
  for (const word of BANNED_WORDS) {
    if (text.includes(word)) {
      return {
        result: 'reject',
        reason: `内容包含违禁词「${word}」,违反平台规定,禁止发布`,
        source: 'rule'
      };
    }
  }

  // 2. 敏感词检测(标记可疑)
  for (const word of SENSITIVE_WORDS) {
    if (text.includes(word)) {
      return {
        result: 'suspicious',
        reason: `内容包含敏感词「${word}」,存在交易风险,建议修改后再发布`,
        source: 'rule'
      };
    }
  }

  // 3. 价格异常检测
  if (price !== null && price !== undefined) {
    if (price <= PRICE_TOO_LOW) {
      return {
        result: 'reject',
        reason: '价格异常:售价必须大于 0 元',
        source: 'rule'
      };
    }
    if (price > PRICE_TOO_HIGH) {
      return {
        result: 'suspicious',
        reason: `价格异常:售价 ${price} 元过高,请确认价格是否填写正确`,
        source: 'rule'
      };
    }
  }

  // 4. 内容过短检测(可疑)
  if (!title || title.trim().length < 2) {
    return {
      result: 'suspicious',
      reason: '商品标题过短,建议填写更完整的标题便于买家搜索',
      source: 'rule'
    };
  }

  // ===== 第二层:LLM 语义级审核 =====
  const llmResult = await llmReview(title, description, price);
  if (llmResult) {
    if (llmResult.result !== 'pass') {
      return {
        result: llmResult.result,
        reason: `[AI 语义审核]${llmResult.reason}`,
        source: 'llm'
      };
    }
    return {
      result: 'pass',
      reason: `[AI 语义审核]内容合规,${llmResult.reason}`,
      source: 'llm'
    };
  }

  // LLM 不可用,纯规则审核通过
  return { result: 'pass', reason: '内容审核通过', source: 'rule' };
}

/**
 * 把 AI 审核结果映射为商品状态与字段
 * @param {string} aiResult 'pass'|'suspicious'|'reject'
 * @returns {{aiReviewResult:number, newStatus:number}}
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
