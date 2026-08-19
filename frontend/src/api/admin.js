import { http } from './request'

// 管理后台 API(需 role=1)
export const adminApi = {
  // 商品审核:待审核列表
  getPendingProducts: (params) => http.get('/admin/products/pending', params),

  // 商品审核:通过/拒绝
  reviewProduct: (id, data) => http.put(`/admin/products/${id}/review`, data),

  // 商品审核:重新触发 AI 审核
  reReviewByAi: (id) => http.post(`/admin/products/${id}/ai-review`),

  // 用户管理:用户列表
  getUsers: (params) => http.get('/admin/users', params),

  // 用户管理:修改用户状态(0封禁 1正常)
  updateUserStatus: (id, status) => http.put(`/admin/users/${id}/status`, { status }),

  // 校园认证审核:待审核列表(默认 verifyStatus=2 待审核)
  getVerifications: (params) => http.get('/admin/verifications', params),

  // 校园认证审核:pass / reject
  reviewVerification: (id, data) => http.put(`/admin/users/${id}/verify`, data),

  // 管理员待办汇总(待审商品/待处理举报/待审认证)
  getTodoCount: () => http.get('/admin/todo-count'),

  // 举报处理:列表
  getReports: (params) => http.get('/admin/reports', params),

  // 举报处理:处理举报
  handleReport: (id, data) => http.put(`/admin/reports/${id}`, data),

  // 数据统计
  getStats: (params) => http.get('/admin/stats', params)
}

export default adminApi
