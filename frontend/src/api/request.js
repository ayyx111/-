import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import router from '@/router'

// 从环境变量读取后端基础路径
// - 有 VITE_API_BASE_URL 时直接用
// - 否则兜底到 Railway 公网地址(IGA Pages 静态托管下,不能靠相对路径代理到本地后端)
// - 开发环境(http://localhost:5173)时仍然走 Vite 代理(/api/v1 -> localhost:3000)
const isLocalDev = typeof location !== 'undefined' && location.hostname === 'localhost'
const FALLBACK_RAILWAY_URL = 'https://resplendent-caring-production-ebd2.up.railway.app/api/v1'
const envBase = import.meta.env.VITE_API_BASE_URL
const baseURL = envBase && envBase.trim()
  ? envBase
  : (isLocalDev ? '/api/v1' : FALLBACK_RAILWAY_URL)

// 创建 Axios 实例
// 注意:不要在此设置默认 Content-Type: application/json——
// 否则上传 FormData 时 axios 不会自动切换为 multipart/form-data(带 boundary),
// 后端 multer 解析不到文件字段,会返回"请选择要上传的图片"。
// 不设默认头时:axios 对普通对象自动用 application/json,对 FormData 自动用 multipart/form-data。
const service = axios.create({
  baseURL,
  timeout: 60000
})

// 是否正在刷新 Token,避免重复弹窗
let isRefreshing = false

// ============ 请求拦截器:自动添加 token ============
service.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ============ 响应拦截器:统一处理 ============
service.interceptors.response.use(
  (response) => {
    const res = response.data

    // 如果是文件流等非 JSON 响应,直接返回
    if (response.config.responseType === 'blob') {
      return response
    }

    // 统一响应格式: { code, message, data, timestamp }
    if (res.code === 200 || res.code === 201) {
      return res
    }

    // 401 未认证
    if (res.code === 401) {
      handleUnauthorized()
      return Promise.reject(new Error(res.message || '登录已过期'))
    }

    // 403 无权限
    if (res.code === 403) {
      ElMessage.error(res.message || '无权限访问')
      return Promise.reject(new Error(res.message || '无权限'))
    }

    // 其它业务错误
    ElMessage.error(res.message || '请求失败')
    return Promise.reject(new Error(res.message || 'Error'))
  },
  (error) => {
    // HTTP 状态码错误处理
    const { response } = error
    if (response) {
      switch (response.status) {
        case 401:
          handleUnauthorized()
          break
        case 403:
          ElMessage.error(response.data?.message || '无权限访问')
          break
        case 404:
          ElMessage.error('请求的资源不存在')
          break
        case 429:
          ElMessage.error('请求过于频繁,请稍后再试')
          break
        case 500:
          ElMessage.error('服务器开小差了,请稍后再试')
          break
        default:
          ElMessage.error(response.data?.message || `请求错误(${response.status})`)
      }
    } else if (error.code === 'ECONNABORTED') {
      ElMessage.error('请求超时,请检查网络')
    } else {
      ElMessage.error('网络异常,请检查连接')
    }
    return Promise.reject(error)
  }
)

// 处理 401 未授权:清除登录态并跳转登录页
function handleUnauthorized() {
  if (isRefreshing) return
  isRefreshing = true
  localStorage.removeItem('token')
  localStorage.removeItem('userInfo')
  const currentPath = router.currentRoute.value.fullPath
  if (router.currentRoute.value.name !== 'Login') {
    ElMessageBox.confirm('登录状态已过期,请重新登录', '提示', {
      confirmButtonText: '重新登录',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(() => {
        router.push({ name: 'Login', query: { redirect: currentPath } })
      })
      .finally(() => {
        isRefreshing = false
      })
  } else {
    isRefreshing = false
  }
}

/**
 * 统一请求方法封装
 * @param {Object} config axios 配置
 * @returns {Promise} 返回 data 部分
 */
export function request(config) {
  return service(config).then((res) => res.data)
}

// 便捷方法
export const http = {
  get: (url, params, config = {}) => request({ method: 'get', url, params, ...config }),
  post: (url, data, config = {}) => request({ method: 'post', url, data, ...config }),
  put: (url, data, config = {}) => request({ method: 'put', url, data, ...config }),
  delete: (url, params, config = {}) => request({ method: 'delete', url, params, ...config }),
  // 注意:不要手动写 Content-Type: multipart/form-data,
  // axios+浏览器会在发送时自动生成并带上正确的 boundary 参数,否则 multer 无法解析 parts
  upload: (url, formData, config = {}) =>
    request({ method: 'post', url, data: formData, ...config })
}

export default service
