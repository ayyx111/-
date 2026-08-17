"""
LLM 客户端封装
基于 OpenAI SDK(兼容协议)调用智谱 GLM-4-Flash
所有方法在 LLM 不可用时抛 LLMError,由调用方决定降级策略
"""
import logging
from openai import OpenAI
from app.config import settings

logger = logging.getLogger("ai-service.llm")


class LLMError(Exception):
    """LLM 调用异常"""
    pass


class LLMClient:
    """智谱 GLM-4-Flash 客户端(OpenAI 兼容协议)"""

    def __init__(self):
        if not settings.LLM_API_KEY:
            logger.warning("LLM_API_KEY 未配置,LLM 功能将不可用")
            self.client = None
            return
        self.client = OpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_BASE_URL,
            timeout=settings.LLM_TIMEOUT,
        )
        self.model = settings.LLM_MODEL
        self.temperature = settings.LLM_TEMPERATURE

    @property
    def available(self) -> bool:
        """LLM 是否可用(已配置 API Key)"""
        return self.client is not None

    def chat(self, system_prompt: str, user_message: str, temperature: float = None) -> str:
        """
        调用 LLM 进行对话
        :param system_prompt: 系统提示词(角色/规则)
        :param user_message: 用户输入
        :param temperature: 温度,不传则用默认值
        :return: LLM 返回的文本
        :raises LLMError: 调用失败
        """
        if not self.available:
            raise LLMError("LLM 未配置 API Key")

        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=temperature if temperature is not None else self.temperature,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"LLM 调用失败: {type(e).__name__}: {e}")
            raise LLMError(f"LLM 调用失败: {e}") from e


# 全局单例
llm_client = LLMClient()
