<script setup>
// 智能客服页:AI 问答
import { ref, nextTick, onMounted } from 'vue'
import aiApi from '@/api/ai'
import { formatTime } from '@/utils/format'

const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const bodyRef = ref()

const quickQuestions = [
  '如何发布商品?',
  '怎样完成校园认证?',
  '交易流程是什么?',
  '如何联系卖家?'
]

async function sendQuestion(text, _isRetry = false) {
  const content = (text ?? inputText.value).trim()
  if (!content || loading.value) return
  if (!_isRetry) {
    messages.value.push({
      id: Date.now(),
      role: 'user',
      content,
      time: new Date().toISOString()
    })
    inputText.value = ''
  }
  loading.value = true
  scrollToBottom()
  try {
    const res = await aiApi.chatbot({
      message: content,
      context: messages.value
        .filter((m) => m.role !== 'system')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }))
    })
    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: res.reply || '抱歉,我暂时无法回答这个问题。',
      time: new Date().toISOString()
    })
  } catch (e) {
    const msg = (e?.message || '').toLowerCase()
    const isTimeout =
      e?.code === 'ECONNABORTED' ||
      msg.includes('timeout') ||
      msg.includes('超时') ||
      msg.includes('abort')
    const isNetwork = msg.includes('network') || msg.includes('网络')
    let tip = '服务开小差了,请稍后重试'
    if (isTimeout) tip = 'AI 思考时间较长,请点击「重试」继续'
    else if (isNetwork) tip = '网络连接异常,请检查后重试'
    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: tip,
      time: new Date().toISOString(),
      isError: true,
      retryText: content
    })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

function retryMessage(msg) {
  messages.value = messages.value.filter((m) => m.id !== msg.id)
  sendQuestion(msg.retryText, true)
}

function scrollToBottom() {
  nextTick(() => {
    if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  })
}

onMounted(() => {
  messages.value.push({
    id: 0,
    role: 'assistant',
    content: '您好!我是校园咸鱼智能客服,有什么可以帮您的吗?',
    time: new Date().toISOString()
  })
})
</script>

<template>
  <div class="page-wrapper">
    <div class="container">
      <div class="service-card">
        <div class="service-header">
          <el-icon class="header-icon"><Service /></el-icon>
          <div>
            <h3>智能客服</h3>
            <span class="status">AI 在线</span>
          </div>
        </div>

        <div ref="bodyRef" class="service-body">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="msg-row"
            :class="{ self: msg.role === 'user' }"
          >
            <el-avatar :size="32" :class="{ ai: msg.role === 'assistant' }">
              <el-icon v-if="msg.role === 'assistant'"><ChatLineRound /></el-icon>
              <el-icon v-else><User /></el-icon>
            </el-avatar>
            <div class="msg-content">
              <div class="msg-bubble" :class="{ error: msg.isError }">
                {{ msg.content }}
                <div v-if="msg.isError" class="retry-wrap">
                  <el-button size="small" type="primary" link @click="retryMessage(msg)">
                    <el-icon><Refresh /></el-icon> 重试
                  </el-button>
                </div>
              </div>
              <div class="msg-time">{{ formatTime(msg.time, 'HH:mm') }}</div>
            </div>
          </div>
          <div v-if="loading" class="msg-row">
            <el-avatar :size="32" class="ai"><el-icon><ChatLineRound /></el-icon></el-avatar>
            <div class="msg-content">
              <div class="msg-bubble typing">正在思考...</div>
            </div>
          </div>
        </div>

        <div class="quick-questions">
          <el-button
            v-for="q in quickQuestions"
            :key="q"
            size="small"
            round
            @click="sendQuestion(q)"
          >
            {{ q }}
          </el-button>
        </div>

        <div class="service-input">
          <el-input
            v-model="inputText"
            placeholder="描述您的问题..."
            @keyup.enter="sendQuestion()"
          />
          <el-button type="primary" :loading="loading" @click="sendQuestion()">发送</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.service-card {
  max-width: 800px;
  margin: 0 auto;
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: var(--card-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 160px);
}
.service-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--primary-color);
  color: #fff;
  .header-icon {
    font-size: 28px;
  }
  h3 {
    font-size: 17px;
  }
  .status {
    font-size: 12px;
    opacity: 0.9;
  }
}
.service-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: var(--bg-color);
}
.msg-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  max-width: 75%;
  .ai {
    background: var(--primary-color);
    color: #fff;
  }
  .msg-content {
    display: flex;
    flex-direction: column;
  }
  .msg-bubble {
    background: #fff;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-word;
    &.error {
      background: #fef0f0;
      border: 1px solid #fde2e2;
      color: #c45656;
    }
    .retry-wrap {
      margin-top: 8px;
      display: flex;
      justify-content: flex-end;
    }
  }
  .msg-time {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 4px;
  }
  &.self {
    flex-direction: row-reverse;
    margin-left: auto;
    .msg-bubble {
      background: var(--primary-color);
      color: #fff;
    }
    .msg-content {
      align-items: flex-end;
    }
  }
}
.quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
}
.service-input {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
}
</style>
