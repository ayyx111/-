<script setup>
// 个人中心:用户信息卡片 + 功能列表
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { resolveImageUrl } from '@/utils/format'

const router = useRouter()
const userStore = useUserStore()
const { userInfo, isVerified, verifyStatus } = storeToRefs(userStore)

// 功能菜单
const menus = [
  { title: '我的发布', desc: '管理我发布的商品', icon: 'Goods', path: '/profile/products' },
  { title: '我的订单', desc: '买到 / 卖出的订单', icon: 'List', path: '/profile/orders' },
  { title: '我的收藏', desc: '收藏的商品', icon: 'Star', path: '/profile/favorites' },
  { title: '我的消息', desc: '会话与聊天', icon: 'ChatDotRound', path: '/messages' },
  { title: '校园认证', desc: '学生身份认证', icon: 'CircleCheck', path: '/profile/verify' },
  { title: '智能客服', desc: 'AI 在线答疑', icon: 'Service', path: '/service' },
  { title: '设置', desc: '账号与安全', icon: 'Setting', path: '/profile/settings' }
]

onMounted(async () => {
  if (!userInfo.value) {
    try {
      await userStore.getUserInfo()
    } catch (e) {}
  }
})

function go(path) {
  router.push(path)
}
</script>

<template>
  <div class="page-wrapper">
    <div class="container">
      <!-- 用户信息卡片 -->
      <div class="profile-header card">
        <div class="avatar-wrap">
          <el-avatar :size="80" :src="resolveImageUrl(userInfo?.avatar)">
            {{ userInfo?.nickname?.[0] || 'U' }}
          </el-avatar>
        </div>
        <div class="user-meta">
          <div class="username">
            {{ userInfo?.nickname || userInfo?.username || '用户' }}
            <el-tag v-if="verifyStatus === 1" type="success" size="small" round>
              <el-icon><CircleCheck /></el-icon>已认证
            </el-tag>
            <el-tag v-else-if="verifyStatus === 2" type="primary" size="small" round>审核中</el-tag>
            <el-tag v-else-if="verifyStatus === 3" type="danger" size="small" round>认证未通过</el-tag>
            <el-tag v-else type="warning" size="small" round>未认证</el-tag>
          </div>
          <div class="user-school">
            <el-icon><Location /></el-icon>{{ userInfo?.school || '未填写学校' }}
          </div>
          <div class="user-stats">
            <div class="stat">
              <span class="num">{{ userInfo?.productCount || 0 }}</span>
              <span class="label">发布</span>
            </div>
            <div class="stat">
              <span class="num">{{ userInfo?.soldCount || 0 }}</span>
              <span class="label">已售</span>
            </div>
            <div class="stat">
              <span class="num text-primary">{{ userInfo?.creditScore || 100 }}</span>
              <span class="label">信用分</span>
            </div>
          </div>
        </div>
        <el-button type="primary" plain @click="router.push('/profile/settings')">编辑资料</el-button>
      </div>

      <!-- 功能列表 -->
      <div class="menu-grid">
        <div
          v-for="m in menus"
          :key="m.title"
          class="menu-item card"
          @click="go(m.path)"
        >
          <el-icon class="menu-icon"><component :is="m.icon" /></el-icon>
          <div class="menu-text">
            <div class="menu-title">{{ m.title }}</div>
            <div class="menu-desc">{{ m.desc }}</div>
          </div>
          <el-icon class="arrow"><ArrowRight /></el-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.profile-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 24px;
  margin-bottom: 20px;
}
.avatar-wrap {
  flex-shrink: 0;
}
.user-meta {
  flex: 1;
}
.username {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 8px;
}
.user-school {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 14px;
}
.user-stats {
  display: flex;
  gap: 30px;
}
.stat {
  display: flex;
  flex-direction: column;
  .num {
    font-size: 22px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .label {
    font-size: 12px;
    color: var(--text-secondary);
  }
}
.menu-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  cursor: pointer;
  .menu-icon {
    font-size: 28px;
    color: var(--primary-color);
    background: var(--primary-light);
    padding: 10px;
    border-radius: 10px;
  }
  .menu-text {
    flex: 1;
  }
  .menu-title {
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 4px;
  }
  .menu-desc {
    font-size: 12px;
    color: var(--text-secondary);
  }
  .arrow {
    color: var(--text-secondary);
  }
}

@media (max-width: 768px) {
  .profile-header {
    flex-direction: column;
    text-align: center;
  }
  .menu-grid {
    grid-template-columns: 1fr;
  }
}
</style>
