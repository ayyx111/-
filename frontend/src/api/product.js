import { http } from './request'

// 商品相关 API
export const productApi = {
  // 获取商品列表
  getList: (params) => http.get('/products', params),

  // 获取商品详情
  getDetail: (id) => http.get(`/products/${id}`),

  // 发布商品(multipart)
  create: (formData) => http.upload('/products', formData),

  // 更新商品
  update: (id, formData) => http.upload(`/products/${id}`, formData, { method: 'put' }),

  // 删除/下架商品
  remove: (id) => http.delete(`/products/${id}`),

  // 获取分类列表
  getCategories: () => http.get('/categories'),

  // 获取我发布的商品
  getMyProducts: (params) => http.get('/user/products', params),

  // 通用文件上传
  uploadImage: (formData) => http.upload('/upload/image', formData)
}

export default productApi
