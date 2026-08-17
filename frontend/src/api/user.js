import { http } from './request'

// 用户相关 API
export const userApi = {
  // 获取当前用户信息
  getProfile: () => http.get('/user/profile'),

  // 更新个人资料
  updateProfile: (formData) => http.upload('/user/profile', formData, { method: 'put' }),

  // 修改密码
  updatePassword: (data) => http.put('/user/password', data),

  // 提交举报
  report: (data) => http.post('/reports', data)
}

export default userApi
