"""
智能客服服务
基于 GLM-4-Flash 大模型,把现有 FAQ 作为系统提示词,
让 LLM 用平台客服的口吻回答用户问题。
LLM 不可用时降级为原规则匹配。
"""
import logging
from app.services.llm_client import llm_client, LLMError

logger = logging.getLogger("ai-service.chatbot")

# FAQ 知识库:作为 LLM 的系统提示词背景知识 + 规则匹配降级用
FAQ_KNOWLEDGE_BASE = [
    {
        "keywords": ["注册", "注册账号", "怎么注册", "如何注册", "账号注册"],
        "question": "如何注册账号",
        "answer": (
            "注册账号步骤如下:\n"
            "1. 打开校园版咸鱼 APP 或网页端;\n"
            "2. 点击「注册」按钮;\n"
            "3. 填写用户名(3-20位)、密码(8-20位,含字母和数字);\n"
            "4. 绑定邮箱或手机号,获取并输入验证码;\n"
            "5. 阅读并同意用户协议,完成注册即可登录。"
        ),
    },
    {
        "keywords": ["发布商品", "怎么发布", "如何发布", "上架", "卖东西", "挂商品"],
        "question": "如何发布商品",
        "answer": (
            "发布商品步骤如下:\n"
            "1. 登录账号并完成校园认证;\n"
            "2. 点击首页「发布」按钮;\n"
            "3. 填写商品标题、描述、价格、分类、新旧程度、交易方式;\n"
            "4. 上传 1-9 张商品图片;\n"
            "5. 提交后等待系统审核,审核通过即可上架出售。"
        ),
    },
    {
        "keywords": ["购买", "怎么买", "如何购买", "下单", "买东西", "怎么下单"],
        "question": "如何购买商品",
        "answer": (
            "购买商品步骤如下:\n"
            "1. 浏览或搜索心仪商品,进入商品详情页;\n"
            "2. 点击「立即购买」创建订单(需完成校园认证);\n"
            "3. 等待卖家确认订单;\n"
            "4. 卖家确认后按约定交易方式(面交/邮寄)完成交易;\n"
            "5. 双方确认交易完成后,可对彼此进行评价。"
        ),
    },
    {
        "keywords": ["校园认证", "学生认证", "身份认证", "实名认证", "怎么认证", "如何认证", "学号"],
        "question": "如何进行校园认证",
        "answer": (
            "校园认证步骤如下:\n"
            "1. 登录账号,进入「我的」-「校园认证」;\n"
            "2. 填写学校、学院、入学年份;\n"
            "3. 上传清晰的学生证照片;\n"
            "4. 提交后等待管理员审核(一般 1-2 个工作日);\n"
            "5. 审核通过后即可发布商品和购买。\n"
            "提示:校园认证是保障交易安全的重要环节,请如实填写。"
        ),
    },
    {
        "keywords": ["交易安全", "安全", "防骗", "被骗", "诈骗", "风险"],
        "question": "交易安全须知",
        "answer": (
            "交易安全须知:\n"
            "1. 请在平台内完成交易,不要私下转账或加微信交易;\n"
            "2. 面交时选择人多的公共场所,确认商品无误后再付款;\n"
            "3. 邮寄交易请保留聊天记录和物流单号;\n"
            "4. 警惕远低于市场价、要求提前付款等可疑情况;\n"
            "5. 遇到可疑行为请及时举报,平台会保护您的权益。"
        ),
    },
    {
        "keywords": ["退款", "退货", "退钱", "怎么退", "如何退款"],
        "question": "如何退款",
        "answer": (
            "退款说明:\n"
            "1. 校园二手交易以面交为主,付款前请仔细确认商品;\n"
            "2. 若订单尚未确认交易完成,可申请取消订单;\n"
            "3. 如遇商品与描述严重不符,可在订单完成后通过「举报」反馈;\n"
            "4. 重大纠纷可联系人工客服介入处理,平台将根据记录判定退款。"
        ),
    },
    {
        "keywords": ["举报", "投诉", "怎么举报", "如何举报", "违规"],
        "question": "如何举报",
        "answer": (
            "举报步骤:\n"
            "1. 进入要举报的商品详情页或用户主页;\n"
            "2. 点击「举报」按钮;\n"
            "3. 选择举报原因(如:虚假信息、违禁品、骚扰等);\n"
            "4. 填写详细描述(可选),提交举报;\n"
            "5. 平台会在 1-3 个工作日内核实处理,处理结果会通过通知告知您。"
        ),
    },
    {
        "keywords": ["审核", "审核多久", "多长时间", "多久通过", "什么时候上架"],
        "question": "商品审核多久",
        "answer": (
            "商品审核说明:\n"
            "1. 商品发布后会先经过 AI 自动审核(几秒内完成);\n"
            "2. AI 审核无异常的商品立即上架;\n"
            "3. AI 标记为可疑的商品会进入人工复审,一般 1-2 小内完成;\n"
            "4. 审核结果(通过/拒绝)会通过系统通知告知您;\n"
            "5. 若被拒绝,可根据原因修改后重新发布。"
        ),
    },
    {
        "keywords": ["密码", "忘记密码", "找回密码", "重置密码", "改密码"],
        "question": "忘记密码怎么办",
        "answer": (
            "找回密码步骤:\n"
            "1. 在登录页点击「忘记密码」;\n"
            "2. 输入注册时的邮箱或手机号;\n"
            "3. 获取验证码并输入;\n"
            "4. 设置新密码(8-20位,含字母和数字);\n"
            "5. 重置成功后即可用新密码登录。"
        ),
    },
    {
        "keywords": ["收藏", "怎么收藏", "收藏夹"],
        "question": "如何收藏商品",
        "answer": (
            "收藏商品:\n"
            "1. 在商品详情页点击爱心「收藏」按钮即可收藏;\n"
            "2. 进入「我的」-「收藏夹」可查看所有收藏商品;\n"
            "3. 再次点击爱心可取消收藏。"
        ),
    },
]

# 通用回复(匹配不到时)
DEFAULT_REPLY = "抱歉,这个问题我无法回答,建议联系人工客服。"

# 转人工关键词
HUMAN_KEYWORDS = ["转人工", "人工客服", "找人工", "真人", "人工"]


def _build_system_prompt() -> str:
    """根据 FAQ 知识库构建系统提示词"""
    faq_text = "\n\n".join(
        [f"Q: {item['question']}\nA: {item['answer']}" for item in FAQ_KNOWLEDGE_BASE]
    )
    return (
        "你是「校园版咸鱼」二手交易平台的智能客服助手。\n"
        "你的职责是解答用户关于校园二手交易的任何问题,包括但不限于:买卖流程、交易安全、"
        "商品挑选建议、平台规则、功能使用等。\n\n"
        "【回答原则】\n"
        "1. 用简洁友好的中文回答,语气像校园学长/学姐;\n"
        "2. 知识库(下方)有对应内容时,优先按知识库回答;\n"
        "3. 知识库没覆盖但属于校园二手交易范围的问题(如选购建议、注意事项、经验分享),**必须回答**,用你的常识给出实用建议;\n"
        "4. 只有当用户明确说「转人工」「找真人」等关键词,或问题涉及法律/财务等专业领域时,才建议联系人工客服;\n"
        "5. 不要编造与平台规则冲突的内容;\n"
        "6. 回答时可以适当分点,让回答更清晰。\n\n"
        f"【平台规则知识库】\n{faq_text}"
    )


def _match_faq(message: str) -> dict | None:
    """通过关键词匹配 FAQ,返回命中的最佳条目(命中词数最多者)"""
    best_item = None
    best_score = 0
    for item in FAQ_KNOWLEDGE_BASE:
        score = 0
        for kw in item["keywords"]:
            if kw in message:
                score += 1
        # 长关键词加权(更精准)
        if score > best_score:
            best_score = score
            best_item = item
    return best_item if best_score > 0 else None


async def chat(message: str, context: list | None = None) -> dict:
    """
    智能客服主流程
    优先调用 GLM-4-Flash,LLM 不可用时降级为规则匹配
    返回: { reply, needHuman, source: 'llm' | 'rule' }
    """
    if not message:
        return {"reply": "您好,请描述您的问题。", "needHuman": False, "source": "rule"}

    msg = message.strip()

    # 转人工(无论 LLM 是否可用,关键词命中即转人工)
    if any(kw in msg for kw in HUMAN_KEYWORDS):
        return {
            "reply": "好的,正在为您转接人工客服,请稍候。您也可以拨打客服热线或发送邮件联系我们。",
            "needHuman": True,
            "source": "rule",
        }

    # 优先尝试 LLM
    if llm_client.available:
        try:
            reply = llm_client.chat(
                system_prompt=_build_system_prompt(),
                user_message=msg,
                temperature=0.4,
            )
            need_human = "人工客服" in reply and ("联系" in reply or "转" in reply)
            return {"reply": reply, "needHuman": need_human, "source": "llm"}
        except LLMError as e:
            logger.warning(f"LLM 客服不可用,降级为规则匹配: {e}")

    # 降级:规则匹配
    matched = _match_faq(msg)
    if matched:
        return {"reply": matched["answer"], "needHuman": False, "source": "rule"}

    # 完全匹配不到
    return {"reply": DEFAULT_REPLY, "needHuman": True, "source": "rule"}
