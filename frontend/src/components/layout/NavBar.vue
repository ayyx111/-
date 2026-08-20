<script setup>
// 顶部导航栏:Logo + 搜索框 + 登录/发布 + 用户菜单 + 消息红点 + 通知下拉(可点击跳转)
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { useMessageStore } from '@/stores/message'
import { resolveImageUrl, formatRelativeTime } from '@/utils/format'
import notificationApi from '@/api/notification'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const messageStore = useMessageStore()

const { isLogin, userInfo, isAdmin } = storeToRefs(userStore)
const { totalUnread } = storeToRefs(messageStore)

const searchKeyword = ref('')

// ====== 顶栏:通知 ======
const notifVisible = ref(false)       // 下拉显隐
const notifLoading = ref(false)      // 加载状态
const notifications = ref([])        // 当前下拉展示的通知(最新20条)
const notifHasMore = ref(true)       // 未读还有更多? (做分页简单标记)
// 通知未读数:优先用 userStore.unreadCount(后端 /unread-count),下拉内部维护一个副本
const unreadCount = computed({
  get: () => userStore.unreadCount,
  set: (v) => { userStore.unreadCount = v | 0 }
})

// 消息红点
const showMsgBadge = computed(() => totalUnread.value > 0)

// 登录/登出后立即拉通知&会话&连接WS
let pollTimer = null
const POLL_INTERVAL = 15_000 // 15s 轮询兜底(WS失联也保证"及时性")

async function refreshAllBadges() {
  if (!isLogin.value) return
  // 并发:通知未读数 + 会话未读数;不阻塞页面
  try {
    await Promise.all([
      userStore.fetchUnreadCount().catch(() => {}),
      messageStore.fetchConversations().catch(() => {}),
    ])
  } catch (_) {}
}

async function ensureSocketConnected() {
  if (!isLogin.value) return
  try {
    // 没连就建立连接(包含监听 WS notification:new / message:receive)
    if (!messageStore.connected) messageStore.connectSocket()
    // 给 messageStore 挂一个通知事件接收器(只有没挂过才挂)
    attachNotifWSListener()
  } catch (_) {}
}

let _wsListenerAttached = false
function attachNotifWSListener() {
  if (_wsListenerAttached) return
  // 动态 import 避免未登录时引入 socket
  import('@/utils/socket').then(({ getSocket }) => {
    const socket = getSocket()
    if (!socket) return
    _wsListenerAttached = true
    socket.off('notification:new')
    socket.on('notification:new', ({ notification }) => {
      if (!notification) return
      // 顶栏红点+1
      unreadCount.value = (unreadCount.value || 0) + 1
      // 下拉若已打开,头部插入一条新通知
      notifications.value = [
        { ...notification, isRead: notification.isRead ?? notification.is_read ?? 0 },
        ...notifications.value.slice(0, 19)
      ]
    })
  }).catch(() => {
    _wsListenerAttached = false
  })
}

function startPollTimer() {
  stopPollTimer()
  pollTimer = setInterval(refreshAllBadges, POLL_INTERVAL)
}
function stopPollTimer() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

// 首次加载:搜索词回填 + 若已登录立即刷一次并启WS+定时器
onMounted(async () => {
  if (route.query.keyword) searchKeyword.value = route.query.keyword
  if (isLogin.value) {
    ensureSocketConnected()
    await refreshAllBadges()
    startPollTimer()
  }
})
onBeforeUnmount(() => { stopPollTimer() })

// 登录态变化:登录成功→立即拉未读+建WS;退出→清
watch(isLogin, (val) => {
  if (val) {
    ensureSocketConnected()
    refreshAllBadges()
    startPollTimer()
  } else {
    notifications.value = []
    notifHasMore.value = true
    stopPollTimer()
  }
})

// 打开下拉即加载最新20条 + 标记最新一批已读(可选)
async function openNotifications() {
  if (!isLogin.value) return
  notifLoading.value = true
  try {
    // 打开即同步刷新未读数(后端为准),避免标题/红点滞后
    userStore.fetchUnreadCount().catch(() => {})
    const res = await notificationApi.getList({ page: 1, pageSize: 20 })
    notifications.value = (res && res.list) || []
    notifHasMore.value = !!(res && res.pagination && res.pagination.total > 20)
  } catch (e) {
    notifications.value = []
  } finally {
    notifLoading.value = false
  }
}

async function handleMarkAllRead() {
  if (!unreadCount.value) return
  try {
    await notificationApi.markAllRead()
    unreadCount.value = 0
    notifications.value = notifications.value.map((n) => ({ ...n, isRead: 1 }))
    ElMessage.success('已全部标为已读')
  } catch (_) {}
}

/** 通知类型 → 跳转目标(与后端 NOTIF_TYPE 保持一致: 1订单 2审核 3评价 4系统 5聊天) */
function resolveNotifLink(n) {
  const type = Number(n.type)
  const relatedId = n.relatedId ?? n.related_id
  switch (type) {
    case 1: // ORDER → 订单详情 / 我的订单
      return relatedId ? { name: 'OrderDetail', params: { id: relatedId } } : { name: 'ProfileOrders' }
    case 5: // CHAT → 消息页打开 relatedId 用户
      return relatedId ? { name: 'Messages', params: { userId: relatedId } } : { name: 'Messages' }
    case 2: // AUDIT (卖家→通过商品审核/买家→驳回) → 商品详情
      return relatedId ? { name: 'ProductDetail', params: { id: relatedId } } : { name: 'ProfileProducts' }
    case 3: // REVIEW → 订单详情
      return relatedId ? { name: 'OrderDetail', params: { id: relatedId } } : { name: 'ProfileOrders' }
    case 4: // SYSTEM → 个人中心-消息
    default:
      return { name: 'Profile' }
  }
}

async function clickNotification(n) {
  if (!n) return
  // 先标已读(不阻塞跳转)
  if (!(n.isRead ?? n.is_read)) {
    notificationApi.markRead(n.id).then(() => {
      if (unreadCount.value > 0) unreadCount.value -= 1
      const row = notifications.value.find((x) => x.id === n.id)
      if (row) { row.isRead = 1 }
    }).catch(() => {})
  }
  // 关下拉 → 跳页面
  notifVisible.value = false
  await nextTick()
  try {
    await router.push(resolveNotifLink(n))
  } catch (e) {
    // navigation cancelled ignore
  }
}

// 搜索
function handleSearch() {
  const kw = searchKeyword.value.trim()
  if (!kw) return
  router.push({ name: 'Search', query: { keyword: kw } })
}

// 发布商品
function handlePublish() {
  if (!isLogin.value) {
    router.push({ name: 'Login', query: { redirect: '/products/create' } })
    return
  }
  router.push({ name: 'ProductCreate' })
}

// 退出登录
async function handleLogout() {
  await userStore.logout()
  messageStore.reset()
  router.push({ name: 'Home' })
}

// 用户菜单跳转
function handleCommand(cmd) {
  switch (cmd) {
    case 'profile':
      router.push({ name: 'Profile' })
      break
    case 'orders':
      router.push({ name: 'ProfileOrders' })
      break
    case 'favorites':
      router.push({ name: 'ProfileFavorites' })
      break
    case 'admin':
      router.push('/admin')
      break
    case 'logout':
      handleLogout()
      break
  }
}
</script>

<template>
  <header class="navbar">
    <div class="container navbar-inner">
      <!-- Logo -->
      <router-link to="/" class="logo">
        <el-icon class="logo-icon"><ShoppingBag /></el-icon>
        <span class="logo-text">校园咸鱼</span>
      </router-link>

      <!-- 搜索框 -->
      <div class="search-box">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索教材、数码、生活用品..."
          clearable
          @keyup.enter="handleSearch"
        >
          <template #append>
            <el-button :icon="'Search'" @click="handleSearch" />
          </template>
        </el-input>
      </div>

      <!-- 右侧操作 -->
      <div class="nav-actions">
        <el-button type="primary" round @click="handlePublish">
          <el-icon><Plus /></el-icon>
          <span>发布</span>
        </el-button>

        <!-- 消息:跳转 /messages(红点会在登录后拉取会话立即显示) -->
        <router-link v-if="isLogin" to="/messages" class="nav-icon-item" title="我的消息">
          <el-badge :value="showMsgBadge ? totalUnread : 0" :hidden="!showMsgBadge" :max="99">
            <el-icon :size="22"><ChatDotRound /></el-icon>
          </el-badge>
        </router-link>

        <!-- 通知:下拉列表 + 点击跳转订单/消息/商品/个人中心 -->
        <el-popover
          v-if="isLogin"
          v-model:visible="notifVisible"
          placement="bottom-end"
          trigger="click"
          :width="360"
          popper-class="notif-popover"
          @show="openNotifications"
        >
          <template #reference>
            <div class="nav-icon-item" title="通知">
              <el-badge :value="unreadCount" :hidden="!unreadCount" :max="99">
                <el-icon :size="22"><Bell /></el-icon>
              </el-badge>
            </div>
          </template>

          <div class="notif-panel">
            <div class="notif-head">
              <span class="notif-title">通知({{ unreadCount }}条未读)</span>
              <el-button
                v-if="unreadCount"
                text size="small" type="primary"
                @click="handleMarkAllRead"
              >全部已读</el-button>
            </div>

            <div v-loading="notifLoading" class="notif-list">
              <template v-if="notifications.length">
                <div
                  v-for="n in notifications"
                  :key="n.id"
                  class="notif-item"
                  :class="{ unread: !(n.isRead ?? n.is_read) }"
                  @click="clickNotification(n)"
                >
                  <div class="notif-row1">
                    <span class="notif-dot" v-if="!(n.isRead ?? n.is_read)" />
                    <span class="notif-t">{{ n.title }}</span>
                    <span class="notif-time">{{ formatRelativeTime(n.createdAt || n.created_at) }}</span>
                  </div>
                  <div class="notif-c text-ellipsis">{{ n.content }}</div>
                  <div class="notif-go">点击查看详情 →</div>
                </div>
              </template>
              <el-empty
                v-else-if="!notifLoading"
                description="暂无通知"
                :image-size="72"
              />
            </div>

            <div v-if="notifHasMore" class="notif-foot">
              <router-link to="/profile" @click="notifVisible=false">查看更多 →</router-link>
            </div>
          </div>
        </el-popover>

        <!-- 未登录:登录按钮 -->
        <router-link v-if="!isLogin" to="/login" class="login-link">登录</router-link>

        <!-- 已登录:用户菜单 -->
        <el-dropdown v-else trigger="click" @command="handleCommand">
          <div class="user-info">
            <el-avatar :size="36" :src="resolveImageUrl(userInfo?.avatar)">
              {{ userInfo?.nickname?.[0] || 'U' }}
            </el-avatar>
            <span class="username hidden-mobile">{{ userInfo?.nickname || userInfo?.username }}</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                <el-icon><User /></el-icon>个人中心
              </el-dropdown-item>
              <el-dropdown-item command="orders">
                <el-icon><List /></el-icon>我的订单
              </el-dropdown-item>
              <el-dropdown-item command="favorites">
                <el-icon><Star /></el-icon>我的收藏
              </el-dropdown-item>
              <el-dropdown-item v-if="isAdmin" command="admin" divided>
                <el-icon><Setting /></el-icon>管理后台
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided>
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.navbar-inner {
  display: flex;
  align-items: center;
  height: 64px;
  gap: 20px;
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  .logo-icon { font-size: 28px; color: var(--primary-color); }
  .logo-text {
    font-size: 20px; font-weight: 700; color: var(--primary-color);
    white-space: nowrap;
  }
}
.search-box {
  flex: 1; max-width: 500px;
  :deep(.el-input-group__append) {
    background: var(--primary-color);
    border-color: var(--primary-color);
    .el-button { color: #fff; }
  }
}
.nav-actions {
  display: flex; align-items: center; gap: 18px; flex-shrink: 0;
}
.login-link { font-size: 15px; font-weight: 500; }
.nav-icon-item {
  display: flex; align-items: center; color: var(--text-regular); cursor: pointer;
  &:hover { color: var(--primary-color); }
}
.user-info {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  .username {
    font-size: 14px; color: var(--text-primary); max-width: 100px;
  }
}

/* —— 通知下拉样式 —— */
.notif-panel {
  max-height: 480px;
  display: flex;
  flex-direction: column;
}
.notif-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; border-bottom: 1px solid #eee; flex-shrink: 0;
  .notif-title { font-weight: 600; }
}
.notif-list {
  overflow-y: auto;
  max-height: 380px;
  min-height: 120px;
  padding: 4px 0;
}
.notif-item {
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px dashed #f0f0f0;
  transition: background .15s;
  &:hover { background: #f6f7fb; }
  &.unread { background: #fafcff; }
}
.notif-row1 {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 4px;
  position: relative;
}
.notif-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #f56c6c; flex-shrink: 0;
}
.notif-t {
  font-size: 14px; font-weight: 600; flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.notif-time {
  font-size: 12px; color: #999; flex-shrink: 0;
}
.notif-c {
  font-size: 13px; color: #555;
  line-height: 1.4; padding-left: 14px;
}
.notif-go {
  margin-top: 6px; padding-left: 14px;
  font-size: 12px; color: var(--primary-color);
}
.notif-foot {
  flex-shrink: 0;
  padding: 8px 14px; text-align: center;
  border-top: 1px solid #eee;
  font-size: 13px;
  a { color: var(--primary-color); }
}

@media (max-width: 768px) {
  .navbar-inner {
    gap: 10px; height: 56px;
  }
  .logo .logo-text { display: none; }
  .search-box { max-width: none; }
  .nav-actions { gap: 10px; }
  .nav-actions .el-button span { display: none; }
}
</style>
