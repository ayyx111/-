<script setup>
// 消息页:会话列表 + 聊天窗口 + WebSocket 实时通信
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useMessageStore } from '@/stores/message'
import { useUserStore } from '@/stores/user'
import { resolveImageUrl, formatRelativeTime, formatTime } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()
const userStore = useUserStore()

const { conversations, currentUserId, messages, onlineUsers } = storeToRefs(messageStore)

const inputMessage = ref('')
const chatBodyRef = ref()
const loadingHistory = ref(false)
const mobileShowChat = ref(false) // 移动端切换到聊天窗

// 当前会话的消息列表
const currentMessages = computed(() => {
  return messages.value[currentUserId.value] || []
})

// 当前会话信息
const currentConv = computed(() => {
  return conversations.value.find((c) => c.userId === currentUserId.value) || {}
})

// 当前用户在线状态
const isOnline = computed(() => onlineUsers.value.has(currentUserId.value))

// 选择会话
async function selectConversation(userId) {
  messageStore.setCurrentUser(userId)
  mobileShowChat.value = true
  loadingHistory.value = true
  try {
    await messageStore.fetchMessages(userId)
    scrollToBottom()
  } finally {
    loadingHistory.value = false
  }
}

// 发送消息
function handleSend() {
  const content = inputMessage.value.trim()
  if (!content || !currentUserId.value) return
  messageStore.sendMessage(currentUserId.value, content, route.query.product ? Number(route.query.product) : undefined)
  inputMessage.value = ''
  nextTick(scrollToBottom)
}

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (chatBodyRef.value) {
      chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
    }
  })
}

// 监听消息变化自动滚动
watch(currentMessages, () => {
  scrollToBottom()
}, { deep: true })

// 返回会话列表(移动端)
function backToList() {
  mobileShowChat.value = false
}

onMounted(async () => {
  // 连接 WebSocket
  messageStore.connectSocket()
  // 加载会话列表
  await messageStore.fetchConversations()

  // 如果 URL 带 to 参数,自动选中会话
  if (route.query.to) {
    const toId = Number(route.query.to)
    // 若会话列表中没有,新建占位
    if (!conversations.value.find((c) => c.userId === toId)) {
      conversations.value.unshift({
        userId: toId,
        nickname: '用户' + toId,
        avatar: '',
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0
      })
    }
    selectConversation(toId)
  }
})

onBeforeUnmount(() => {
  messageStore.setCurrentUser(null)
})
</script>

<template>
  <div class="message-page">
    <div class="message-container">
      <!-- 左侧会话列表 -->
      <aside class="conv-list" :class="{ hidden: mobileShowChat && currentUserId }">
        <div class="conv-header">
          <h3>消息</h3>
        </div>
        <div class="conv-body">
          <div
            v-for="conv in conversations"
            :key="conv.userId"
            class="conv-item"
            :class="{ active: currentUserId === conv.userId }"
            @click="selectConversation(conv.userId)"
          >
            <el-badge :value="conv.unreadCount" :hidden="!conv.unreadCount" :max="99">
              <el-avatar :size="44" :src="resolveImageUrl(conv.avatar)">
                {{ conv.nickname?.[0] }}
              </el-avatar>
            </el-badge>
            <div class="conv-info">
              <div class="conv-top">
                <span class="conv-name text-ellipsis">{{ conv.nickname }}</span>
                <span class="conv-time">{{ formatRelativeTime(conv.lastMessageTime) }}</span>
              </div>
              <div class="conv-last text-ellipsis">{{ conv.lastMessage || '暂无消息' }}</div>
            </div>
          </div>
          <el-empty v-if="!conversations.length" description="暂无会话" :image-size="80" />
        </div>
      </aside>

      <!-- 右侧聊天窗口 -->
      <section class="chat-window" :class="{ hidden: !mobileShowChat && currentUserId }">
        <template v-if="currentUserId">
          <!-- 聊天头部 -->
          <div class="chat-header">
            <el-icon class="back-icon hidden-pc" @click="backToList"><ArrowLeft /></el-icon>
            <el-avatar :size="36" :src="resolveImageUrl(currentConv.avatar)">
              {{ currentConv.nickname?.[0] }}
            </el-avatar>
            <div class="chat-header-info">
              <span class="chat-name">{{ currentConv.nickname }}</span>
              <span class="chat-status" :class="{ online: isOnline }">
                {{ isOnline ? '在线' : '离线' }}
              </span>
            </div>
          </div>

          <!-- 消息区域 -->
          <div ref="chatBodyRef" class="chat-body" v-loading="loadingHistory">
            <div
              v-for="msg in currentMessages"
              :key="msg.id"
              class="msg-row"
              :class="{ self: msg.isSelf || msg.fromUserId === userStore.userInfo?.id }"
            >
              <el-avatar :size="32" :src="resolveImageUrl(msg.isSelf ? userStore.userInfo?.avatar : currentConv.avatar)">
                {{ (msg.isSelf ? userStore.userInfo?.nickname : currentConv.nickname)?.[0] }}
              </el-avatar>
              <div class="msg-content">
                <div class="msg-bubble">{{ msg.content }}</div>
                <div class="msg-time">{{ formatTime(msg.createdAt, 'MM-DD HH:mm') }}</div>
              </div>
            </div>
            <el-empty v-if="!currentMessages.length && !loadingHistory" description="开始你们的对话吧~" :image-size="80" />
          </div>

          <!-- 输入区 -->
          <div class="chat-input">
            <el-input
              v-model="inputMessage"
              placeholder="输入消息..."
              @keyup.enter="handleSend"
              :disabled="!currentUserId"
            />
            <el-button type="primary" @click="handleSend" :disabled="!inputMessage.trim()">
              发送
            </el-button>
          </div>
        </template>
        <el-empty v-else description="选择一个会话开始聊天" class="chat-placeholder" />
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.message-page {
  height: calc(100vh - 64px);
  padding: 16px 0;
}
.message-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  height: 100%;
  display: flex;
  background: #fff;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--card-shadow);
}
.conv-list {
  width: 300px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}
.conv-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  h3 {
    font-size: 18px;
    font-weight: 600;
  }
}
.conv-body {
  flex: 1;
  overflow-y: auto;
}
.conv-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  &:hover {
    background: var(--bg-color);
  }
  &.active {
    background: var(--primary-light);
  }
}
.conv-info {
  flex: 1;
  min-width: 0;
}
.conv-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  .conv-name {
    font-size: 14px;
    font-weight: 500;
  }
  .conv-time {
    font-size: 11px;
    color: var(--text-secondary);
    flex-shrink: 0;
    margin-left: 8px;
  }
}
.conv-last {
  font-size: 12px;
  color: var(--text-secondary);
}
.chat-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  .back-icon {
    cursor: pointer;
    font-size: 20px;
  }
}
.chat-header-info {
  display: flex;
  flex-direction: column;
  .chat-name {
    font-size: 15px;
    font-weight: 500;
  }
  .chat-status {
    font-size: 12px;
    color: var(--text-secondary);
    &.online {
      color: var(--primary-color);
    }
  }
}
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: var(--bg-color);
}
.msg-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  max-width: 70%;
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
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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
.chat-input {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
}
.chat-placeholder {
  margin: auto;
}

@media (max-width: 768px) {
  .message-container {
    border-radius: 0;
  }
  .conv-list {
    width: 100%;
    &.hidden {
      display: none;
    }
  }
  .chat-window {
    &.hidden {
      display: none;
    }
  }
}
</style>
