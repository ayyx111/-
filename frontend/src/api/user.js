import { http } from './request'

// 用户相关 API
export const userApi = {
  // 获取当前用户信息
  getProfile: () => http.get('/user/profile'),

  // 更新个人资料(接收 JSON 对象)
  updateProfile: (data) => http.put('/user/profile', data),

  // 上传头像
  uploadImage: (formData) => http.upload('/upload/image', formData),

  // 修改密码
  updatePassword: (data) => http.put('/user/password', data),

  // 修改邮箱
  changeEmail: (data) => http.put('/user/email', data),

  // 获取用户公开信息(无需登录)
  getUserById: (id) => http.get(`/user/${id}`),

  // 获取用户公开主页(历史发布+评价+签名)
  getPublicProfile: (id) => http.get(`/user/${id}/profile`),

  // 学校修改申请
  submitSchoolChange: (data) => http.post('/school-change-requests', data),
  getMySchoolChangeRequests: (params) => http.get('/school-change-requests/mine', params),
  checkPendingSchoolChange: () => http.get('/school-change-requests/pending'),

  // 提交举报
  report: (data) => http.post('/reports', data)
}

export default userApi
