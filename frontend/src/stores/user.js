import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import authApi from '@/api/auth'
import userApi from '@/api/user'
import notificationApi from '@/api/notification'
import { closeSocket } from '@/utils/socket'

// 手写持久化:使用 plain JSON.parse/stringify,避免第三方持久化插件的 destr 原型污染
const PERSIST_KEY = 'campus-user'

function safeReadPersist() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return { token: '', userInfo: null }
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return { token: '', userInfo: null }
    const token = typeof obj.token === 'string' ? obj.token : ''
    let userInfo = null
    if (obj.userInfo && typeof obj.userInfo === 'object' && !Array.isArray(obj.userInfo)) {
      // 用 JSON.parse(JSON.stringify()) 强制生成一个干净的 plain object,避免原型链问题
      try {
        userInfo = JSON.parse(JSON.stringify(obj.userInfo))
      } catch {
        userInfo = null
      }
    }
    return { token, userInfo }
  } catch {
    return { token: '', userInfo: null }
  }
}

function safeWritePersist(token, userInfo) {
  try {
    const payload = {
      token: typeof token === 'string' ? token : '',
      userInfo:
        userInfo && typeof userInfo === 'object' && !Array.isArray(userInfo)
          ? JSON.parse(JSON.stringify(userInfo))
          : null
    }
    localStorage.setItem(PERSIST_KEY, JSON.stringify(payload))
    // 同步 token 到独立 key(供 axios 拦截器/老代码读取)
    if (payload.token) localStorage.setItem('token', payload.token)
    else localStorage.removeItem('token')
  } catch {
    // 忽略写入失败(如隐私模式 localStorage 不可写)
  }
}

// 用户状态管理
export const useUserStore = defineStore('user', () => {
  const persisted = safeReadPersist()
  const token = ref(persisted.token)
  const userInfo = ref(persisted.userInfo)
  const unreadCount = ref(0) // 通知未读数

  // 监听 token/userInfo 变化,写入 localStorage
  watch(
    [token, userInfo],
    ([t, u]) => safeWritePersist(t, u),
    { deep: true }
  )

  // 是否已登录
  const isLogin = computed(() => !!token.value)
  // 是否管理员
  const isAdmin = computed(() => userInfo.value?.role === 1)
  // 认证状态(0未认证 1已通过 2待审核 3未通过)
  // - 1或2都认为"已提交认证/可发布商品",避免待审核阶段无法使用功能
  const verifyStatus = computed(() =>
    userInfo.value?.is_verified ?? userInfo.value?.isVerified ?? 0
  )
  const isVerified = computed(() =>
    verifyStatus.value === 1 || verifyStatus.value === 2
  )
  const verifyStatusText = computed(() => {
    switch (verifyStatus.value) {
      case 1:
        return '已通过校园认证'
      case 2:
        return '认证审核中,请耐心等待'
      case 3:
        return '认证未通过,请重新提交'
      default:
        return ''
    }
  })

  /**
   * 登录
   */
  async function login(data) {
    const res = await authApi.login(data)
    token.value = res.accessToken
    if (res.user) {
      userInfo.value = res.user
    }
    return res
  }

  /**
   * 获取用户信息
   */
  async function getUserInfo() {
    const res = await userApi.getProfile()
    userInfo.value = res
    return res
  }

  /**
   * 退出登录
   */
  async function logout() {
    try {
      await authApi.logout()
    } catch (e) {
      // 即使接口失败也清除本地状态
    }
    closeSocket()
    resetState()
  }

  /**
   * 应用启动时恢复:有 token 则拉取用户信息
   */
  async function restore() {
    if (token.value && !userInfo.value) {
      try {
        await getUserInfo()
        fetchUnreadCount()
      } catch (e) {
        resetState()
      }
    }
  }

  /**
   * 更新本地用户信息(无需请求)
   */
  function setUserInfo(info) {
    userInfo.value = { ...(userInfo.value || {}), ...info }
  }

  /**
   * 获取未读通知数
   */
  async function fetchUnreadCount() {
    if (!token.value) return
    try {
      const res = await notificationApi.getUnreadCount()
      unreadCount.value = res.total || 0
    } catch (e) {
      // ignore
    }
  }

  /**
   * 重置状态
   */
  function resetState() {
    token.value = ''
    userInfo.value = null
    unreadCount.value = 0
    localStorage.removeItem('token')
    localStorage.removeItem(PERSIST_KEY)
  }

  return {
    token,
    userInfo,
    unreadCount,
    isLogin,
    isAdmin,
    verifyStatus,
    isVerified,
    verifyStatusText,
    login,
    getUserInfo,
    logout,
    restore,
    setUserInfo,
    fetchUnreadCount,
    resetState
  }
})
