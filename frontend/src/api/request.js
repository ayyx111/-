import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import router from '@/router'
import { useUserStore } from '@/stores/user'

// 从环境变量读取后端基础路径
// - 有 VITE_API_BASE_URL 时直接用
// - 否则默认走 Vite 代理(/api/v1 -> localhost:3000),适用于本地开发和 CloudStudio
const envBase = import.meta.env.VITE_API_BASE_URL
const baseURL = (envBase && envBase.trim()) || '/api/v1'

// 创建 Axios 实例
// 注意:不要在实例级强制 `Content-Type: application/json`——
// 当请求体是 FormData(上传文件等)时,axios 会自动设置 multipart/form-data(带 boundary),
// 如果这里硬塞了 Content-Type,浏览器会优先用手动头,导致后端 multer 解析不到文件字段,
// 前端发布页上传图片会报"请选择要上传的图片"。
// 对于普通 POST 对象,axios 会自动根据 data 类型添加 application/json。
const service = axios.create({
  baseURL,
  timeout: 60000,
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
          // 在登录页:401 = 账号密码错误,直接显示后端返回的错误信息
          if (router.currentRoute.value.name === 'Login') {
            ElMessage.error(response.data?.message || '账号或密码错误')
          } else {
            handleUnauthorized()
          }
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
// 全局节流:多个接口同时 401 时,只弹一次 MessageBox + 一次 router.push,
// 避免连弹多个弹窗、多次跳 Login 导致的"页面反复闪"。
let unauthorizedHandledTs = 0
function handleUnauthorized() {
  const now = Date.now()
  if (isRefreshing || (now - unauthorizedHandledTs) < 1500) return
  isRefreshing = true
  unauthorizedHandledTs = now
  localStorage.removeItem('token')
  localStorage.removeItem('userInfo')
  const currentPath = router.currentRoute.value.fullPath
  // 已在 Login 页不弹
  if (router.currentRoute.value.name === 'Login') {
    setTimeout(() => { isRefreshing = false }, 1200)
    return
  }
  // 先清登录态、再直接跳 Login(不再阻塞式弹窗,避免多弹窗闪烁)
  try {
    // ESM:调用 store 时必须已安装 pinia(App.vue setup执行后已ok);这里兜底 try/catch
    const userStore = useUserStore()
    if (userStore && typeof userStore.resetState === 'function') userStore.resetState()
  } catch (_) {}
  router.replace({ name: 'Login', query: { redirect: currentPath } })
    .then(() => {
      setTimeout(() => { isRefreshing = false }, 1200)
    })
    .catch(() => {
      setTimeout(() => { isRefreshing = false }, 1200)
    })
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
