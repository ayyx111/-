<script setup>
// 顶部导航栏:Logo + 搜索框 + 登录/发布 + 用户菜单
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { useMessageStore } from '@/stores/message'
import { resolveImageUrl } from '@/utils/format'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const messageStore = useMessageStore()

const { isLogin, userInfo, isAdmin, unreadCount } = storeToRefs(userStore)
const { totalUnread } = storeToRefs(messageStore)

const searchKeyword = ref('')

// 是否在消息页(用于隐藏移动端底部?)
const showMsgBadge = computed(() => totalUnread.value > 0)

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

onMounted(() => {
  // 回填搜索词
  if (route.query.keyword) searchKeyword.value = route.query.keyword
})
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

        <!-- 消息 -->
        <router-link v-if="isLogin" to="/messages" class="nav-icon-item">
          <el-badge :value="showMsgBadge ? totalUnread : 0" :hidden="!showMsgBadge" :max="99">
            <el-icon :size="22"><ChatDotRound /></el-icon>
          </el-badge>
        </router-link>

        <!-- 通知 -->
        <el-badge v-if="isLogin" :value="unreadCount" :hidden="!unreadCount" :max="99" class="nav-icon-item">
          <el-icon :size="22"><Bell /></el-icon>
        </el-badge>

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
  .logo-icon {
    font-size: 28px;
    color: var(--primary-color);
  }
  .logo-text {
    font-size: 20px;
    font-weight: 700;
    color: var(--primary-color);
    white-space: nowrap;
  }
}
.search-box {
  flex: 1;
  max-width: 500px;
  :deep(.el-input-group__append) {
    background: var(--primary-color);
    border-color: var(--primary-color);
    .el-button {
      color: #fff;
    }
  }
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-shrink: 0;
}
.login-link {
  font-size: 15px;
  font-weight: 500;
}
.nav-icon-item {
  display: flex;
  align-items: center;
  color: var(--text-regular);
  cursor: pointer;
  &:hover {
    color: var(--primary-color);
  }
}
.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  .username {
    font-size: 14px;
    color: var(--text-primary);
    max-width: 100px;
  }
}

@media (max-width: 768px) {
  .navbar-inner {
    gap: 10px;
    height: 56px;
  }
  .logo .logo-text {
    display: none;
  }
  .search-box {
    max-width: none;
  }
  .nav-actions {
    gap: 10px;
  }
  .nav-actions .el-button span {
    display: none;
  }
}
</style>
