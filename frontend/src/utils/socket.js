import { io } from 'socket.io-client'

// WebSocket 单例:统一管理聊天实时通信
let socket = null

/**
 * 创建/获取 Socket.IO 连接
 * @param {string} token 访问令牌
 * @returns {Socket} socket 实例
 */
export function createSocket(token) {
  if (socket && socket.connected) return socket

  const wsUrl = import.meta.env.VITE_WS_URL || '/'

  socket = io(wsUrl, {
    path: '/ws/chat',
    transports: ['websocket'],
    query: { token },
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionAttempts: 5,
    autoConnect: true
  })

  socket.on('connect', () => {
    console.log('[WS] 已连接:', socket.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('[WS] 已断开:', reason)
  })

  socket.on('connect_error', (err) => {
    console.error('[WS] 连接错误:', err.message)
  })

  return socket
}

/**
 * 获取当前 socket 实例
 */
export function getSocket() {
  return socket
}

/**
 * 关闭 socket 连接
 */
export function closeSocket() {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}

/**
 * 发送消息事件
 */
export function emitMessage(payload) {
  if (socket) {
    socket.emit('message:send', payload)
  }
}

/**
 * 标记已读事件
 */
export function emitRead(fromUserId) {
  if (socket) {
    socket.emit('message:read', { fromUserId })
  }
}

/**
 * 发送正在输入事件
 */
export function emitTyping(toUserId) {
  if (socket) {
    socket.emit('typing', { toUserId })
  }
}

export default {
  createSocket,
  getSocket,
  closeSocket,
  emitMessage,
  emitRead,
  emitTyping
}
