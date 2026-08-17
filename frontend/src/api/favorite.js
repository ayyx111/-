import { http } from './request'

// 收藏相关 API
export const favoriteApi = {
  // 收藏商品
  add: (productId) => http.post('/favorites', { productId }),

  // 取消收藏
  remove: (productId) => http.delete(`/favorites/${productId}`),

  // 获取收藏列表
  getList: (params) => http.get('/favorites', params)
}

export default favoriteApi
