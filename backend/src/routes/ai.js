/**
 * AI 服务路由(内联实现)
 * 不再转发到独立 Python AI 服务,改为直接在 Node 后端内完成:
 *  - /ai/chatbot  智能客服(GLM-4-Flash + FAQ 知识库,LLM 不可用降级规则匹配)
 *  - /ai/search   智能搜索(Sequelize LIKE 查询 + LLM 同义词扩展)
 *  - /ai/recommend 智能推荐(Sequelize:热门/个性化/相似商品,无需 LLM)
 *  - /ai/review   内容审核(规则词表 + LLM 语义审核)
 * 让前端只对接后端,无需关心 AI 服务地址,统一鉴权
 */
const express = require('express');
const { Op, literal } = require('sequelize');
const router = express.Router();
const ResponseUtil = require('../utils/response');
const { optionalAuth } = require('../middleware/auth');
const { llmClient, LLMError } = require('../services/llmClient');
const { Product, ProductImage, UserBrowseHistory, Favorite } = require('../models');

// 商品状态:1=在售
const ON_SALE = 1;

// ============ 智能客服 ============

// FAQ 知识库:作为 LLM 的系统提示词背景知识 + 规则匹配降级用
const FAQ_KNOWLEDGE_BASE = [
  {
    keywords: ['注册', '注册账号', '怎么注册', '如何注册', '账号注册'],
    question: '如何注册账号',
    answer:
      '注册账号步骤如下:\n' +
      '1. 打开校园版咸鱼 APP 或网页端;\n' +
      '2. 点击「注册」按钮;\n' +
      '3. 填写用户名(3-20位)、密码(8-20位,含字母和数字);\n' +
      '4. 绑定邮箱或手机号,获取并输入验证码;\n' +
      '5. 阅读并同意用户协议,完成注册即可登录。'
  },
  {
    keywords: ['发布商品', '怎么发布', '如何发布', '上架', '卖东西', '挂商品'],
    question: '如何发布商品',
    answer:
      '发布商品步骤如下:\n' +
      '1. 登录账号并完成校园认证;\n' +
      '2. 点击首页「发布」按钮;\n' +
      '3. 填写商品标题、描述、价格、分类、新旧程度、交易方式;\n' +
      '4. 上传 1-9 张商品图片;\n' +
      '5. 提交后等待系统审核,审核通过即可上架出售。'
  },
  {
    keywords: ['购买', '怎么买', '如何购买', '下单', '买东西', '怎么下单', '交易流程', '流程是什么', '买东西流程'],
    question: '如何购买商品',
    aliases: ['交易流程是什么', '怎么购买商品', '购买流程是什么'],
    answer:
      '购买/交易流程如下:\n' +
      '1. 浏览或搜索心仪商品,进入商品详情页;\n' +
      '2. 点击「立即购买」创建订单(需完成校园认证);\n' +
      '3. 等待卖家确认订单;\n' +
      '4. 卖家确认后按约定交易方式(面交/邮寄)完成交易;\n' +
      '5. 双方确认交易完成后,可对彼此进行评价。'
  },
  {
    keywords: ['校园认证', '学生认证', '身份认证', '实名认证', '怎么认证', '如何认证', '学号', '怎样完成', '怎么完成认证'],
    question: '如何进行校园认证',
    aliases: ['怎样完成校园认证', '怎么认证学生身份', '学生认证怎么办'],
    answer:
      '校园认证步骤如下:\n' +
      '1. 登录账号,进入「我的」-「校园认证」;\n' +
      '2. 填写学校、学院、入学年份;\n' +
      '3. 提交后立即认证成功,无需管理员审核,可直接发布商品和购买;\n' +
      '4. 若后续更换学校,需在「设置」中提交学校修改申请,等待管理员审核。\n' +
      '提示:校园认证是保障交易安全的重要环节,请如实填写。'
  },
  {
    keywords: ['交易安全', '安全', '防骗', '被骗', '诈骗', '风险'],
    question: '交易安全须知',
    answer:
      '交易安全须知:\n' +
      '1. 请在平台内完成交易,不要私下转账或加微信交易;\n' +
      '2. 面交时选择人多的公共场所,确认商品无误后再付款;\n' +
      '3. 邮寄交易请保留聊天记录和物流单号;\n' +
      '4. 警惕远低于市场价、要求提前付款等可疑情况;\n' +
      '5. 遇到可疑行为请及时举报,平台会保护您的权益。'
  },
  {
    keywords: ['退款', '退货', '退钱', '怎么退', '如何退款'],
    question: '如何退款',
    answer:
      '退款说明:\n' +
      '1. 校园二手交易以面交为主,付款前请仔细确认商品;\n' +
      '2. 若订单尚未确认交易完成,可申请取消订单;\n' +
      '3. 如遇商品与描述严重不符,可在订单完成后通过「举报」反馈;\n' +
      '4. 重大纠纷可联系人工客服介入处理,平台将根据记录判定退款。'
  },
  {
    keywords: ['举报', '投诉', '怎么举报', '如何举报', '违规'],
    question: '如何举报',
    answer:
      '举报步骤:\n' +
      '1. 进入要举报的商品详情页或用户主页;\n' +
      '2. 点击「举报」按钮;\n' +
      '3. 选择举报原因(如:虚假信息、违禁品、骚扰等);\n' +
      '4. 填写详细描述(可选),提交举报;\n' +
      '5. 平台会在 1-3 个工作日内核实处理,处理结果会通过通知告知您。'
  },
  {
    keywords: ['审核', '审核多久', '多长时间', '多久通过', '什么时候上架'],
    question: '商品审核多久',
    answer:
      '商品审核说明:\n' +
      '1. 商品发布后会先经过 AI 自动审核(几秒内完成);\n' +
      '2. AI 审核无异常的商品立即上架;\n' +
      '3. AI 标记为可疑的商品会进入人工复审,一般 1-2 小时内完成;\n' +
      '4. 审核结果(通过/拒绝)会通过系统通知告知您;\n' +
      '5. 若被拒绝,可根据原因修改后重新发布。'
  },
  {
    keywords: ['密码', '忘记密码', '找回密码', '重置密码', '改密码'],
    question: '忘记密码怎么办',
    answer:
      '找回密码步骤:\n' +
      '1. 在登录页点击「忘记密码」;\n' +
      '2. 输入注册时的邮箱或手机号;\n' +
      '3. 获取验证码并输入;\n' +
      '4. 设置新密码(8-20位,含字母和数字);\n' +
      '5. 重置成功后即可用新密码登录。'
  },
  {
    keywords: ['收藏', '怎么收藏', '收藏夹'],
    question: '如何收藏商品',
    aliases: ['怎么收藏商品', '怎么收藏'],
    answer:
      '收藏商品:\n' +
      '1. 在商品详情页点击爱心「收藏」按钮即可收藏;\n' +
      '2. 进入「我的」-「收藏夹」可查看所有收藏商品;\n' +
      '3. 再次点击爱心可取消收藏。'
  },
  {
    keywords: ['联系卖家', '怎么联系卖家', '怎么联系', '联系商家', '和卖家沟通', '和卖家聊天', '私信卖家'],
    question: '如何联系卖家',
    aliases: ['如何联系卖家?', '怎么联系卖家', '能联系卖家吗', '跟卖家沟通'],
    answer:
      '联系卖家方式:\n' +
      '1. 进入商品详情页,点击「联系卖家」按钮,会自动进入与卖家的即时聊天窗口;\n' +
      '2. 也可以在商品详情页点击卖家头像,进入卖家主页后点击「发消息」;\n' +
      '3. 聊天支持发送文字、图片和商品卡片,方便沟通商品细节和交易安排;\n' +
      '4. 重要提示:请通过平台内置聊天沟通,不要私下加微信或转账,避免被骗。'
  }
];

const DEFAULT_REPLY = '抱歉,这个问题我无法回答,建议联系人工客服。';
const HUMAN_KEYWORDS = ['转人工', '人工客服', '找人工', '真人', '人工'];

function buildChatbotSystemPrompt() {
  const faqText = FAQ_KNOWLEDGE_BASE.map((it) => `Q: ${it.question}\nA: ${it.answer}`).join('\n\n');
  return (
    '你是「校园版咸鱼」二手交易平台的智能客服助手。\n' +
    '你的职责是解答用户关于校园二手交易的任何问题,包括但不限于:买卖流程、交易安全、' +
    '商品挑选建议、平台规则、功能使用等。\n\n' +
    '【回答原则】\n' +
    '1. 用简洁友好的中文回答,语气像校园学长/学姐;\n' +
    '2. 知识库(下方)有对应内容时,优先按知识库回答;\n' +
    '3. 知识库没覆盖但属于校园二手交易范围的问题(如选购建议、注意事项、经验分享),必须回答,用你的常识给出实用建议;\n' +
    '4. 只有当用户明确说「转人工」「找真人」等关键词,或问题涉及法律/财务等专业领域时,才建议联系人工客服;\n' +
    '5. 不要编造与平台规则冲突的内容;\n' +
    '6. 回答时可以适当分点,让回答更清晰。\n\n' +
    `【平台规则知识库】\n${faqText}`
  );
}

function matchFaq(message) {
  let bestItem = null;
  let bestScore = 0;
  for (const item of FAQ_KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of item.keywords) {
      if (message.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }
  return bestScore > 0 ? bestItem : null;
}

/** 标准化输入:去空白、统一中文标点、去末尾问号/句号,用于严格等值匹配 */
function normalizeText(s) {
  return s
    .replace(/\s+/g, '')
    .replace(/[？?。.！!，,、；;：:]/g, '')
    .toLowerCase();
}

/** 判断 FAQ 条目是否与用户消息"严格命中"(question / aliases 标准化后相等或包含关系) */
function isExactFaqHit(normMsg, item) {
  const variants = [item.question, ...(item.aliases || [])];
  for (const v of variants) {
    const nv = normalizeText(v);
    if (nv === normMsg) return true;
    if (normMsg && (nv.includes(normMsg) || normMsg.includes(nv)) && nv.length >= 4) return true;
  }
  return false;
}

/**
 * 智能客服:POST /api/v1/ai/chatbot
 * body: { message, context }
 * 处理顺序(严格按"能省就省 LLM 调用"原则):
 *   1. 空消息 → 规则
 *   2. 关键词「转人工」 → 规则(不调 LLM)
 *   3. 用户消息严格命中 FAQ(question/aliases 标准化后相等) → 规则,**绝对不调 LLM**
 *      (这就是智能客服页面「快速提问」4 个按钮的场景)
 *   4. FAQ 规则打分高置信度(≥2 关键词命中、或短消息+FAQ 句式+命中关键词) → 规则
 *   5. 低置信度/无匹配 → 调 LLM 兜底(开放问题、选购建议、非 FAQ 场景)
 * 6. LLM 不可用:有低置信度 FAQ 就给 FAQ,否则转人工
 */
router.post('/chatbot', async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return ResponseUtil.success(res, {
      reply: '您好,请描述您的问题。',
      needHuman: false,
      source: 'rule'
    });
  }
  const msg = message.trim();
  const normMsg = normalizeText(msg);

  // 1) 转人工:命中关键词就直接转,不调 LLM
  if (HUMAN_KEYWORDS.some((kw) => msg.includes(kw))) {
    return ResponseUtil.success(res, {
      reply: '好的,正在为您转接人工客服,请稍候。您也可以拨打客服热线或发送邮件联系我们。',
      needHuman: true,
      source: 'rule'
    });
  }

  // 2) 严格命中 FAQ(快速提问按钮 / question / aliases) → 直接规则回,绝不调 LLM
  for (const item of FAQ_KNOWLEDGE_BASE) {
    if (isExactFaqHit(normMsg, item)) {
      return ResponseUtil.success(res, {
        reply: item.answer,
        needHuman: false,
        source: 'rule'
      });
    }
  }

  // 3) 关键词打分:命中 ≥1 个关键词就计算分数
  let bestItem = null;
  let bestScore = 0;
  for (const item of FAQ_KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of item.keywords) {
      if (msg.includes(kw)) score += 1;
    }
    if (msg.includes(item.question) || item.question.includes(msg)) {
      score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  // 高置信度 → 规则回(不调 LLM):
  //   A) score ≥ 2 (多关键词命中 或 question 文本互含)
  //   B) 命中 ≥1 关键词 + 消息短 (≤20 字)
  //   C) 命中 ≥1 关键词 + FAQ 句式(怎么/如何/怎么办/吗 等)
  const SHORT_MAX = 20;
  const FAQ_PATTERN = ['怎么', '如何', '啥', '吗', '呢', '步骤', '怎么办', '怎样', '为何', '为啥'];
  const isShort = msg.length <= SHORT_MAX;
  const hasFaqPattern = FAQ_PATTERN.some((p) => msg.includes(p));
  const highConf =
    bestScore >= 2 ||
    (bestScore >= 1 && (isShort || hasFaqPattern));

  if (highConf && bestItem) {
    return ResponseUtil.success(res, {
      reply: bestItem.answer,
      needHuman: false,
      source: 'rule'
    });
  }

  // 4) 以上都没命中 → 调 LLM 兜底(开放问题、选购建议、非 FAQ 场景)
  if (llmClient.available) {
    try {
      const reply = await llmClient.chat(buildChatbotSystemPrompt(), msg, 0.4);
      const needHuman = reply.includes('人工客服') && (reply.includes('联系') || reply.includes('转'));
      return ResponseUtil.success(res, { reply, needHuman, source: 'llm' });
    } catch (e) {
      console.warn(`[AI/chatbot] LLM 不可用,降级为规则匹配: ${e.message}`);
    }
  }

  // LLM 不可用:有低置信度 FAQ 就给 FAQ,否则转人工
  if (bestScore >= 1 && bestItem) {
    return ResponseUtil.success(res, { reply: bestItem.answer, needHuman: false, source: 'rule' });
  }
  return ResponseUtil.success(res, { reply: DEFAULT_REPLY, needHuman: true, source: 'rule' });
});

// ============ 内容审核 ============

const { reviewProduct } = require('../services/aiService');

/**
 * 内容审核:POST /api/v1/ai/review
 * body: { title, description, price }
 */
router.post('/review', async (req, res) => {
  const { title, description, price } = req.body;
  try {
    const result = await reviewProduct(title, description, price !== undefined ? Number(price) : null);
    return ResponseUtil.success(res, result);
  } catch (err) {
    console.error('[AI/review] 审核异常:', err.message);
    return ResponseUtil.success(res, { result: 'pass', reason: 'AI 审核异常,已放行待人工复核', source: 'rule' });
  }
});

// ============ 智能搜索 ============

// 同义词词典(关键词 -> [扩展词])
const SYNONYM_DICT = {
  高数: ['高等数学', '高等数学教材', '微积分', '数学分析'],
  线代: ['线性代数', '线性代数教材'],
  概率论: ['概率统计', '数理统计'],
  耳机: ['耳麦', '头戴式耳机', '蓝牙耳机', '入耳式耳机'],
  耳麦: ['耳机', '头戴式耳机'],
  电脑: ['笔记本', '台式机', '笔记本电脑', 'laptop'],
  笔记本: ['电脑', '笔记本电脑'],
  手机: ['智能手机', '移动电话'],
  平板: ['平板电脑', 'ipad'],
  键盘: ['机械键盘', '薄膜键盘'],
  鼠标: ['电脑鼠标', '无线鼠标'],
  充电器: ['电源适配器', '快充'],
  教材: ['课本', '教科书'],
  课本: ['教材', '教科书'],
  自行车: ['单车', 'bike'],
  单车: ['自行车'],
  球鞋: ['运动鞋', '篮球鞋'],
  裙子: ['连衣裙', '半身裙'],
  外套: ['夹克', '上衣'],
  台灯: ['护眼灯', '学习灯'],
  计算器: ['科学计算器', '卡西欧'],
  考研: ['考研资料', '考研真题'],
  四六级: ['英语四级', '英语六级', 'CET4', 'CET6']
};

function tokenize(text) {
  if (!text) return [];
  const trimmed = text.trim();
  const parts = trimmed.split(/[\s,，。、;；:：!！?？/\\\-—()()【】\[\]]+/).filter(Boolean);
  if (parts.length) return parts;
  // 纯中文无分隔:整体作为一个词
  const cleaned = trimmed.replace(/[\s\W_]+/g, '');
  return cleaned ? [cleaned] : [...trimmed];
}

function expandSynonymsStatic(tokens) {
  const expanded = [];
  const seen = new Set(tokens);
  for (const token of tokens) {
    for (const syn of SYNONYM_DICT[token] || []) {
      if (!seen.has(syn)) {
        expanded.push(syn);
        seen.add(syn);
      }
    }
  }
  return expanded;
}

async function expandSynonymsLlm(tokens) {
  if (!llmClient.available || !tokens.length) return [];
  try {
    const systemPrompt =
      '你是二手交易平台搜索助手。任务:为给定的搜索关键词生成同义词/近义词/常见全称,\n' +
      '用于扩展商品搜索召回。要求:\n' +
      '1. 每个词不超过 8 个汉字;\n' +
      '2. 只输出常见的、可能出现在商品标题中的词;\n' +
      '3. 不重复原词;\n' +
      '4. 严格输出 JSON 数组,不要包含任何额外文字。示例:["高等数学","微积分"]';
    const userMsg = `关键词:${tokens.join(',')}\n请输出同义词 JSON 数组。`;
    const reply = await llmClient.chat(systemPrompt, userMsg, 0.5);
    let cleaned = reply.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.includes('\n') ? cleaned.split('\n').slice(1).join('\n') : cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start >= 0 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
    }
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) return arr.map(String).filter(Boolean).slice(0, 8);
  } catch (e) {
    console.warn(`[AI/search] LLM 同义词扩展失败,降级为纯静态词典: ${e.message}`);
  }
  return [];
}

function formatProductForAi(row) {
  // row 为 Sequelize Product 实例(含 images 关联)
  const firstImg = row.images && row.images.length ? row.images[0] : null;
  const cover = firstImg ? (firstImg.image_url || firstImg) : null;
  return {
    id: row.id,
    title: row.title,
    price: parseFloat(row.price),
    coverImage: cover,
    images: row.images ? row.images.map((im) => ({ image_url: im.image_url, sort_order: im.sort_order })) : [],
    score: row.getDataValue('_score') || 0
  };
}

/**
 * 智能搜索:GET /api/v1/ai/search?keyword=&page=&pageSize=
 */
router.get('/search', async (req, res) => {
  const keyword = (req.query.keyword || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(40, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

  if (!keyword) {
    return ResponseUtil.success(res, {
      list: [],
      expandedKeywords: [],
      suggestion: '',
      pagination: { page, pageSize, total: 0, totalPages: 0 }
    });
  }

  // 1. 分词 2. 同义词扩展
  const tokens = tokenize(keyword);
  const staticExpanded = expandSynonymsStatic(tokens);

  // 静态词典已经覆盖所有分词 → 不再调 LLM(省 token、延迟更低)
  // 典型:搜「高数」→ 静态扩展出「高等数学/微积分/数学分析」,足够覆盖商品标题常见写法
  const allCovered = tokens.length > 0 && tokens.every((t) =>
    SYNONYM_DICT[t] && SYNONYM_DICT[t].length > 0
  );
  const llmExpanded = (allCovered || !llmClient.available)
    ? []
    : await expandSynonymsLlm(tokens);

  const expanded = [...new Set([...staticExpanded, ...llmExpanded])];
  const allTerms = [...new Set([...tokens, ...expanded])];

  // 3. 构建 LIKE 查询(标题或描述包含任一检索词)
  const orClauses = allTerms.map((term) => ({
    [Op.or]: [{ title: { [Op.like]: `%${term}%` } }, { description: { [Op.like]: `%${term}%` } }]
  }));

  const where = { status: ON_SALE, [Op.or]: orClauses };

  // 统计总数
  const total = await Product.count({ where });

  // 分页查询(含封面图)
  const offset = (page - 1) * pageSize;
  const rows = await Product.findAll({
    where,
    attributes: ['id', 'title', 'price', 'description', 'view_count', 'favorite_count', 'category_id'],
    include: [{ model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'sort_order'], separate: true, order: [['sort_order', 'ASC']] }],
    order: [['created_at', 'DESC']],
    limit: pageSize,
    offset
  });

  // 4. 相关度排序(标题完全匹配 > 标题包含 > 描述包含),再按热度
  const scored = rows.map((r) => {
    const title = r.title || '';
    const desc = r.description || '';
    let score = 0;
    for (const term of allTerms) {
      if (title === term) score += 3;
      else if (title.includes(term)) score += 2;
      else if (desc.includes(term)) score += 1;
    }
    r.setDataValue('_score', score);
    return r;
  });
  scored.sort((a, b) => {
    const sa = a.getDataValue('_score') || 0;
    const sb = b.getDataValue('_score') || 0;
    if (sb !== sa) return sb - sa;
    const ha = (a.view_count || 0) + (a.favorite_count || 0) * 3;
    const hb = (b.view_count || 0) + (b.favorite_count || 0) * 3;
    return hb - ha;
  });

  let list = scored.map(formatProductForAi);
  let suggestion = '';

  // 5. 无结果时推荐相似商品
  if (total === 0) {
    const fallbackTerm = tokens[0] || keyword;
    const fbRows = await Product.findAll({
      where: { status: ON_SALE, title: { [Op.like]: `%${fallbackTerm}%` } },
      attributes: ['id', 'title', 'price', 'view_count', 'favorite_count'],
      include: [{ model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'sort_order'], separate: true, order: [['sort_order', 'ASC']] }],
      order: [['created_at', 'DESC']],
      limit: pageSize
    });
    list = fbRows.map((r) => {
      r.setDataValue('_score', 0);
      return formatProductForAi(r);
    });
    suggestion = expanded.length
      ? `未找到「${keyword}」相关商品,已为您推荐相近商品;您还可以试试:${expanded.slice(0, 3).join('、')}`
      : `未找到「${keyword}」相关商品,已为您推荐相近商品`;
  }

  return ResponseUtil.success(res, {
    list,
    expandedKeywords: expanded,
    suggestion,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0
    }
  });
});

// ============ 智能推荐 ============

/**
 * 热门推荐:按热度评分排序(热度 = 浏览量 + 收藏量 * 3)
 */
async function hotRecommend(limit) {
  const rows = await Product.findAll({
    where: { status: ON_SALE },
    attributes: ['id', 'title', 'price', 'view_count', 'favorite_count'],
    include: [{ model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'sort_order'], separate: true, order: [['sort_order', 'ASC']] }],
    order: [[literal('(view_count + favorite_count * 3)'), 'DESC'], ['created_at', 'DESC']],
    limit
  });
  const maxHot = rows.reduce((m, r) => Math.max(m, (r.view_count || 0) + (r.favorite_count || 0) * 3), 1) || 1;
  return rows.map((r) => {
    const hot = (r.view_count || 0) + (r.favorite_count || 0) * 3;
    const score = 0.5 + 0.5 * (hot / maxHot);
    r.setDataValue('_score', Math.min(score, 1));
    return formatProductForAi(r);
  });
}

/**
 * 个性化推荐:基于浏览历史 + 收藏的分类偏好
 */
async function personalRecommend(userId, limit) {
  // 1. 浏览历史(含分类)
  const browsed = await UserBrowseHistory.findAll({
    where: { user_id: userId },
    attributes: ['product_id', 'category_id']
  });
  // 2. 收藏记录的商品分类
  const favorites = await Favorite.findAll({
    where: { user_id: userId },
    include: [{ model: Product, as: 'product', attributes: ['category_id'] }]
  });

  // 统计分类偏好(收藏权重=2,浏览权重=1)
  const catCounter = new Map();
  for (const r of browsed) {
    if (r.category_id != null) catCounter.set(r.category_id, (catCounter.get(r.category_id) || 0) + 1);
  }
  for (const f of favorites) {
    const cat = f.product && f.product.category_id;
    if (cat != null) catCounter.set(cat, (catCounter.get(cat) || 0) + 2);
  }

  // 无历史记录则退化为热门推荐
  if (!catCounter.size) {
    return hotRecommend(limit);
  }

  // 取偏好最高的前 5 个分类
  const preferredCats = [...catCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]);
  const browsedIds = browsed.map((r) => r.product_id).filter(Boolean);

  // 3. 查询偏好分类下的在售商品
  const where = { status: ON_SALE, category_id: { [Op.in]: preferredCats } };
  if (browsedIds.length) {
    where.id = { [Op.notIn]: browsedIds };
  }
  const rows = await Product.findAll({
    where,
    attributes: ['id', 'title', 'price', 'category_id', 'view_count', 'favorite_count'],
    include: [{ model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'sort_order'], separate: true, order: [['sort_order', 'ASC']] }],
    limit: limit * 5
  });

  // 4. 相关度评分
  const maxHot = rows.reduce((m, r) => Math.max(m, (r.view_count || 0) + (r.favorite_count || 0) * 3), 1) || 1;
  const scored = rows.map((r) => {
    let score = 0;
    // 分类偏好权重 0.4
    score += Math.min((catCounter.get(r.category_id) || 0) / 10, 1) * 0.4;
    // 热度权重 0.4
    const hot = (r.view_count || 0) + (r.favorite_count || 0) * 3;
    score += (hot / maxHot) * 0.4;
    // 基础分 0.2
    score += 0.2;
    r.setDataValue('_score', Math.min(score, 1));
    return r;
  });
  scored.sort((a, b) => (b.getDataValue('_score') || 0) - (a.getDataValue('_score') || 0));
  return scored.slice(0, limit).map(formatProductForAi);
}

/**
 * 相似商品推荐:基于商品分类 + 标题关键词相似度(Jaccard)
 */
async function similarRecommend(productId, limit) {
  const target = await Product.findByPk(productId, { attributes: ['id', 'category_id', 'title'] });
  if (!target) return [];

  const targetKws = extractKeywords(target.title || '');
  const rows = await Product.findAll({
    where: { status: ON_SALE, category_id: target.category_id, id: { [Op.ne]: productId } },
    attributes: ['id', 'title', 'price', 'view_count', 'favorite_count'],
    include: [{ model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'sort_order'], separate: true, order: [['sort_order', 'ASC']] }],
    limit: limit * 5
  });

  const scored = rows.map((r) => {
    const kws = extractKeywords(r.title || '');
    let sim = 0;
    if (targetKws.size && kws.size) {
      let inter = 0;
      for (const k of targetKws) if (kws.has(k)) inter += 1;
      const union = targetKws.size + kws.size - inter;
      sim = union ? inter / union : 0;
    }
    const hot = (r.view_count || 0) + (r.favorite_count || 0) * 3;
    const score = sim * 0.8 + Math.min(hot / 100, 1) * 0.2;
    r.setDataValue('_score', score);
    return r;
  });
  scored.sort((a, b) => (b.getDataValue('_score') || 0) - (a.getDataValue('_score') || 0));
  return scored.slice(0, limit).map(formatProductForAi);
}

function extractKeywords(text) {
  if (!text) return new Set();
  const cleaned = text.replace(/[\s\W_]+/g, '');
  const tokens = new Set(cleaned);
  for (let i = 0; i < cleaned.length - 1; i++) {
    tokens.add(cleaned.slice(i, i + 2));
  }
  return tokens;
}

/**
 * 智能推荐:GET /api/v1/ai/recommend?type=home|similar&limit=&productId=
 * 登录用户走个性化推荐,未登录走热门推荐
 */
router.get('/recommend', optionalAuth, async (req, res) => {
  const type = req.query.type || 'home';
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
  try {
    let list = [];
    if (type === 'similar') {
      const productId = parseInt(req.query.productId, 10);
      if (!productId) {
        return ResponseUtil.success(res, []);
      }
      list = await similarRecommend(productId, limit);
    } else if (req.user) {
      // 登录用户:个性化推荐
      list = await personalRecommend(req.user.id, limit);
    } else {
      // 未登录:热门推荐
      list = await hotRecommend(limit);
    }
    return ResponseUtil.success(res, list);
  } catch (err) {
    console.error('[AI/recommend] 推荐异常:', err.message);
    return ResponseUtil.success(res, []);
  }
});

module.exports = router;
