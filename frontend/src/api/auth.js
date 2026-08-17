import { http } from './request'

// 认证相关 API
export const authApi = {
  // 用户注册
  register: (data) => http.post('/auth/register', data),

  // 发送验证码
  sendCode: (data) => http.post('/auth/send-code', data),

  // 用户登录
  login: (data) => http.post('/auth/login', data),

  // 刷新 Token
  refresh: (refreshToken) => http.post('/auth/refresh', { refreshToken }),

  // 退出登录
  logout: () => http.post('/auth/logout'),

  // 重置密码
  resetPassword: (data) => http.post('/auth/reset-password', data),

  // 校园身份认证
  verifyCampus: (formData) => http.upload('/auth/verify-campus', formData)
}

export default authApi
