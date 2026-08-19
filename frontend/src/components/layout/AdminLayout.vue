<script setup>
// 管理后台布局:侧边菜单 + 内容区
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { resolveImageUrl } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 菜单项
const menus = [
  { index: '/admin/overview', title: '总览', icon: 'DataAnalysis', badge: null },
  { index: '/admin/audit', title: '商品审核', icon: 'Goods', badge: null },
  { index: '/admin/verify', title: '校园认证审核', icon: 'Medal', badge: null },
  { index: '/admin/users', title: '用户管理', icon: 'UserFilled', badge: null },
  { index: '/admin/reports', title: '举报处理', icon: 'Warning', badge: null },
  { index: '/admin/statistics', title: '数据统计', icon: 'TrendCharts', badge: null }
]

const activeMenu = computed(() => route.path)

function handleSelect(index) {
  router.push(index)
}

function backHome() {
  router.push('/')
}

async function handleLogout() {
  await userStore.logout()
  router.push('/')
}
</script>

<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <el-icon class="header-icon"><Platform /></el-icon>
        <span class="header-title">管理后台</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        @select="handleSelect"
      >
        <el-menu-item v-for="m in menus" :key="m.index" :index="m.index">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.title }}</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <div class="admin-user">
          <el-avatar :size="32" :src="resolveImageUrl(userStore.userInfo?.avatar)">
            {{ userStore.userInfo?.nickname?.[0] || 'A' }}
          </el-avatar>
          <span class="admin-name">{{ userStore.userInfo?.nickname || '管理员' }}</span>
        </div>
        <div class="sidebar-actions">
          <el-button text size="small" @click="backHome">
            <el-icon><HomeFilled /></el-icon>回前台
          </el-button>
          <el-button text size="small" @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>退出
          </el-button>
        </div>
      </div>
    </aside>

    <!-- 内容区 -->
    <main class="admin-main">
      <router-view />
    </main>
  </div>
</template>

<style lang="scss" scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-color);
}
.admin-sidebar {
  width: 220px;
  background: #001529;
  color: #fff;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
}
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 64px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  .header-icon {
    font-size: 24px;
    color: var(--primary-color);
  }
  .header-title {
    font-size: 18px;
    font-weight: 600;
  }
}
.sidebar-menu {
  flex: 1;
  border-right: none;
  background: transparent;
  :deep(.el-menu-item) {
    color: rgba(255, 255, 255, 0.75);
    &:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }
    &.is-active {
      background: var(--primary-color);
      color: #fff;
    }
  }
}
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.admin-user {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  .admin-name {
    color: #fff;
    font-size: 14px;
  }
}
.sidebar-actions {
  display: flex;
  gap: 8px;
  :deep(.el-button) {
    color: rgba(255, 255, 255, 0.75);
    &:hover {
      color: #fff;
    }
  }
}
.admin-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .admin-sidebar {
    width: 64px;
  }
  .sidebar-header .header-title,
  .sidebar-menu :deep(.el-menu-item span),
  .admin-name {
    display: none;
  }
  .sidebar-menu :deep(.el-menu-item) {
    padding: 0 !important;
    justify-content: center;
  }
}
</style>
