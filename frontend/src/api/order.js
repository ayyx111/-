import { http } from './request'

// 订单相关 API
export const orderApi = {
  // 创建订单
  create: (data) => http.post('/orders', data),

  // 获取订单列表
  getList: (params) => http.get('/orders', params),

  // 获取订单详情
  getDetail: (id) => http.get(`/orders/${id}`),

  // 卖家确认/拒绝订单
  confirm: (id, data) => http.put(`/orders/${id}/confirm`, data),

  // 买家取消订单
  cancel: (id, data) => http.put(`/orders/${id}/cancel`, data),

  // 确认交易完成
  complete: (id) => http.put(`/orders/${id}/complete`),

  // 提交评价
  review: (id, data) => http.post(`/orders/${id}/review`, data)
}

export default orderApi
