import { http } from './request'

// AI 相关 API
export const aiApi = {
  // 智能推荐 home(首页) / similar(相似商品)
  recommend: (params) => http.get('/ai/recommend', params),

  // 智能搜索
  search: (params) => http.get('/ai/search', params),

  // 智能客服
  chatbot: (data) => http.post('/ai/chatbot', data)
}

export default aiApi
