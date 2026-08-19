<script setup>
// 管理后台总览:数据卡片
import { ref, onMounted } from 'vue'
import adminApi from '@/api/admin'

const loading = ref(false)
const stats = ref({
  userCount: 0,
  productCount: 0,
  orderCount: 0,
  todayNewUsers: 0,
  todayNewProducts: 0,
  pendingReviews: 0,
  pendingReports: 0,
  pendingVerifications: 0,
})

const cards = [
  { key: 'userCount', title: '用户总数', icon: 'UserFilled', color: '#4caf50' },
  { key: 'productCount', title: '商品总数', icon: 'Goods', color: '#ff9800' },
  { key: 'orderCount', title: '订单总数', icon: 'List', color: '#2196f3' },
  { key: 'pendingReviews', title: '待审核商品', icon: 'Clock', color: '#f44336' },
  { key: 'pendingVerifications', title: '认证待审核', icon: 'Medal', color: '#e91e63' },
  { key: 'pendingReports', title: '待处理举报', icon: 'Warning', color: '#9c27b0' },
  { key: 'todayNewUsers', title: '今日新增用户', icon: 'User', color: '#00bcd4' },
  { key: 'todayNewProducts', title: '今日新增商品', icon: 'Box', color: '#ffc107' }
]

async function loadStats() {
  loading.value = true
  try {
    const res = await adminApi.getStats({ type: 'overview' })
    stats.value = { ...stats.value, ...res }
  } catch (e) {
    // ignore
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

<template>
  <div class="admin-page" v-loading="loading">
    <h2 class="page-title">总览</h2>
    <div class="stat-grid">
      <div v-for="c in cards" :key="c.key" class="stat-card">
        <div class="stat-icon" :style="{ background: c.color }">
          <el-icon :size="26"><component :is="c.icon" /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-num">{{ stats[c.key] || 0 }}</div>
          <div class="stat-title">{{ c.title }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 24px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
.stat-card {
  background: #fff;
  border-radius: var(--radius-base);
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--card-shadow);
}
.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}
.stat-title {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}
@media (max-width: 992px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 480px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
