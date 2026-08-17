import { http } from './request'

// 消息相关 API
export const messageApi = {
  // 获取会话列表
  getConversations: () => http.get('/messages/conversations'),

  // 获取聊天记录
  getHistory: (userId, params) => http.get(`/messages/${userId}`, params),

  // 发送消息
  send: (data) => http.post('/messages', data),

  // 标记消息已读
  markRead: (userId) => http.put(`/messages/read/${userId}`)
}

export default messageApi
