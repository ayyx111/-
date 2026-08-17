import { http } from './request'

// 通知相关 API
export const notificationApi = {
  // 获取通知列表
  getList: (params) => http.get('/notifications', params),

  // 标记通知已读
  markRead: (id) => http.put(`/notifications/${id}/read`),

  // 全部标记已读
  markAllRead: () => http.put('/notifications/read-all'),

  // 获取未读数量
  getUnreadCount: () => http.get('/notifications/unread-count')
}

export default notificationApi
