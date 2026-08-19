import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
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
      const fromId = msg.fromUserId ?? msg.from_user_id
      if (!fromId) return
      if (!messages.value[fromId]) messages.value[fromId] = []
      // 去重:避免同一消息被 REST+WS 两条路径都插入
      const exists = (messages.value[fromId] || []).find((m) => m.id && m.id === msg.id)
      if (!exists) messages.value[fromId].push(msg)
      // 更新会话最后消息
      updateConversation(fromId, msg.content, msg.createdAt || msg.created_at)
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
   * 发送消息:先走 REST /messages 持久化写库(确保对方下次登录也能看到会话/历史),
   * WebSocket 只是在线端的实时推送(不保证落库)。老实现只 emitMessage(Socket),
   * 导致:1)对方没上线→DB没存→"发了消息,我的消息里看不到/对面也看不到";
   *      2)自己页面只有乐观更新,刷新后就没了。
   */
  async function sendMessage(toUserId, content, productId) {
    const userStore = useUserStore()
    const payload = { toUserId, content, msgType: 0, productId: productId ?? null }
    // 本地先乐观追加(让用户立即感知发送成功)
    const tempId = Date.now()
    const selfId = userStore.userInfo?.id
    if (!messages.value[toUserId]) messages.value[toUserId] = []
    messages.value[toUserId].push({
      id: tempId,
      fromUserId: selfId,
      toUserId,
      content,
      msgType: 0,
      createdAt: new Date().toISOString(),
      productId: productId ?? null,
      isSelf: true,
      _pending: true,
    })
    updateConversation(toUserId, content, new Date().toISOString())
    // 在线则尝试 WebSocket 推给对方
    emitMessage(payload)
    // REST 持久化
    try {
      const saved = await messageApi.send(payload)
      // 将临时消息替换为服务端返回的真实消息(保留 id,避免 v-for 闪)
      const arr = messages.value[toUserId] || []
      const idx = arr.findIndex((m) => m.id === tempId)
      if (idx >= 0 && saved) {
        arr.splice(idx, 1, {
          ...saved,
          fromUserId: saved.fromUserId ?? selfId,
          toUserId: saved.toUserId ?? toUserId,
          createdAt: saved.createdAt || new Date().toISOString(),
          isSelf: true,
          _pending: false,
        })
      }
    } catch (e) {
      ElMessage?.error?.(e?.message || '消息发送失败,请稍后重试')
      // 发送失败回滚临时消息(标红提示或删除,这里删除避免误导)
      const arr = messages.value[toUserId] || []
      const idx = arr.findIndex((m) => m.id === tempId)
      if (idx >= 0) arr.splice(idx, 1)
    }
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
