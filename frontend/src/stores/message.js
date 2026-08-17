import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import messageApi from '@/api/message'
import { createSocket, getSocket, closeSocket, emitMessage, emitRead } from '@/utils/socket'
import { useUserStore } from './user'

// 消息状态管理:会话列表 + WebSocket
export const useMessageStore = defineStore('message', () => {
  const conversations = ref([])
  const currentUserId = ref(null) // 当前聊天对象 userId
  const messages = ref({}) // { [userId]: [] }
  const onlineUsers = ref(new Set())
  const connected = ref(false)

  // 总未读数
  const totalUnread = computed(() =>
    conversations.value.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
  )

  /**
   * 加载会话列表
   */
  async function fetchConversations() {
    try {
      const res = await messageApi.getConversations()
      conversations.value = res || []
    } catch (e) {
      conversations.value = []
    }
  }

  /**
   * 加载与某用户的聊天记录
   */
  async function fetchMessages(userId, params = {}) {
    try {
      const res = await messageApi.getHistory(userId, params)
      const list = res.list || res || []
      messages.value[userId] = Array.isArray(list) ? list : []
      // 进入会话标记已读
      markRead(userId)
      return messages.value[userId]
    } catch (e) {
      messages.value[userId] = []
      return []
    }
  }

  /**
   * 连接 WebSocket
   */
  function connectSocket() {
    const userStore = useUserStore()
    if (!userStore.token) return
    const socket = createSocket(userStore.token)
    if (!socket) return

    // 监听接收消息
    socket.off('message:receive')
    socket.on('message:receive', (msg) => {
      const fromId = msg.fromUserId
      if (!messages.value[fromId]) messages.value[fromId] = []
      messages.value[fromId].push(msg)
      // 更新会话最后消息
      updateConversation(fromId, msg.content, msg.createdAt)
      // 非当前会话则增加未读
      if (currentUserId.value !== fromId) {
        const conv = conversations.value.find((c) => c.userId === fromId)
        if (conv) conv.unreadCount = (conv.unreadCount || 0) + 1
      } else {
        // 当前会话标记已读
        markRead(fromId)
      }
    })

    // 用户上线/离线
    socket.off('user:online')
    socket.on('user:online', ({ userId }) => {
      onlineUsers.value.add(userId)
    })
    socket.off('user:offline')
    socket.on('user:offline', ({ userId }) => {
      onlineUsers.value.delete(userId)
    })

    connected.value = true
  }

  /**
   * 发送消息
   */
  function sendMessage(toUserId, content, productId) {
    const userStore = useUserStore()
    const payload = { toUserId, content, msgType: 0, productId }
    emitMessage(payload)
    // 本地立即追加(乐观更新)
    if (!messages.value[toUserId]) messages.value[toUserId] = []
    messages.value[toUserId].push({
      id: Date.now(),
      fromUserId: userStore.userInfo?.id,
      content,
      msgType: 0,
      createdAt: new Date().toISOString(),
      isSelf: true
    })
    updateConversation(toUserId, content, new Date().toISOString())
  }

  /**
   * 标记已读
   */
  function markRead(userId) {
    emitRead(userId)
    try {
      messageApi.markRead(userId)
    } catch (e) {
      // ignore
    }
    const conv = conversations.value.find((c) => c.userId === userId)
    if (conv) conv.unreadCount = 0
  }

  /**
   * 更新会话最后消息
   */
  function updateConversation(userId, lastMessage, lastMessageTime) {
    let conv = conversations.value.find((c) => c.userId === userId)
    if (conv) {
      conv.lastMessage = lastMessage
      conv.lastMessageTime = lastMessageTime
    } else {
      // 不存在则新建占位
      conversations.value.unshift({
        userId,
        nickname: '用户' + userId,
        avatar: '',
        lastMessage,
        lastMessageTime,
        unreadCount: 0
      })
    }
  }

  /**
   * 设置当前聊天对象
   */
  function setCurrentUser(userId) {
    currentUserId.value = userId
    if (userId) markRead(userId)
  }

  /**
   * 重置(登出时调用)
   */
  function reset() {
    closeSocket()
    conversations.value = []
    currentUserId.value = null
    messages.value = {}
    onlineUsers.value = new Set()
    connected.value = false
  }

  return {
    conversations,
    currentUserId,
    messages,
    onlineUsers,
    connected,
    totalUnread,
    fetchConversations,
    fetchMessages,
    connectSocket,
    sendMessage,
    markRead,
    setCurrentUser,
    reset
  }
})
