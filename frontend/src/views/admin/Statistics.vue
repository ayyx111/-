<script setup>
// 数据统计:趋势 + 分类分布
import { ref, reactive, onMounted } from 'vue'
import adminApi from '@/api/admin'
import { formatTime } from '@/utils/format'

const loading = ref(false)
const dateRange = ref([])
const trend = ref({ list: [], labels: [] })
const category = ref([])
const overview = ref({})

async function loadTrend() {
  loading.value = true
  try {
    const params = { type: 'trend' }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = formatTime(dateRange.value[0], 'YYYY-MM-DD')
      params.endDate = formatTime(dateRange.value[1], 'YYYY-MM-DD')
    }
    const res = await adminApi.getStats(params)
    trend.value = {
      list: res.list || res.trend || [],
      labels: res.labels || []
    }
  } catch (e) {
    trend.value = { list: [], labels: [] }
  } finally {
    loading.value = false
  }
}

async function loadCategory() {
  try {
    const res = await adminApi.getStats({ type: 'category' })
    category.value = res.list || res.categories || []
  } catch (e) {
    category.value = []
  }
}

async function loadOverview() {
  try {
    const res = await adminApi.getStats({ type: 'overview' })
    overview.value = res || {}
  } catch (e) {}
}

// 计算分类最大值用于条形图
const maxCategoryCount = () => {
  if (!category.value.length) return 1
  return Math.max(...category.value.map((c) => c.count || 0), 1)
}

// 标签映射
const labelMap = { users: '用户', products: '商品', orders: '订单' }

// 趋势最大值
const maxValue = () => {
  if (!trend.value.list.length) return 1
  let max = 0
  trend.value.list.forEach((item) => {
    max = Math.max(max, item.users || 0, item.products || 0, item.orders || 0)
  })
  return max || 1
}

function barHeight(val) {
  return Math.max(2, ((val || 0) / maxValue()) * 120)
}

async function refresh() {
  await Promise.all([loadTrend(), loadCategory(), loadOverview()])
}

onMounted(refresh)
</script>

<template>
  <div class="admin-page" v-loading="loading">
    <div class="head">
      <h2 class="page-title">数据统计</h2>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="x"
        @change="loadTrend"
      />
    </div>

    <!-- 概览数据 -->
    <div class="overview-grid">
      <div class="ov-card">
        <div class="ov-num">{{ overview.userCount || 0 }}</div>
        <div class="ov-label">用户总数</div>
      </div>
      <div class="ov-card">
        <div class="ov-num">{{ overview.productCount || 0 }}</div>
        <div class="ov-label">商品总数</div>
      </div>
      <div class="ov-card">
        <div class="ov-num">{{ overview.orderCount || 0 }}</div>
        <div class="ov-label">订单总数</div>
      </div>
    </div>

    <!-- 趋势 -->
    <div class="chart-card card">
      <h3 class="chart-title">近期趋势</h3>
      <div v-if="trend.list.length" class="trend-chart">
        <div v-for="(item, i) in trend.list" :key="i" class="trend-bar-wrap">
          <div class="trend-bar-col">
            <div
              v-for="(val, key) in { users: item.users, products: item.products, orders: item.orders }"
              :key="key"
              class="trend-bar"
              :class="key"
              :style="{ height: barHeight(val) + 'px' }"
              :title="`${labelMap[key]}: ${val || 0}`"
            />
          </div>
          <div class="trend-label">{{ item.date || trend.labels[i] }}</div>
        </div>
      </div>
      <el-empty v-else description="暂无趋势数据" :image-size="80" />
      <div class="legend">
        <span class="leg users">用户新增</span>
        <span class="leg products">商品新增</span>
        <span class="leg orders">订单新增</span>
      </div>
    </div>

    <!-- 分类分布 -->
    <div class="chart-card card">
      <h3 class="chart-title">商品分类分布</h3>
      <div v-if="category.length" class="category-list">
        <div v-for="c in category" :key="c.id || c.name" class="cat-item">
          <div class="cat-name">{{ c.name }}</div>
          <div class="cat-bar-bg">
            <div class="cat-bar" :style="{ width: ((c.count || 0) / maxCategoryCount() * 100) + '%' }"></div>
          </div>
          <div class="cat-count">{{ c.count || 0 }}</div>
        </div>
      </div>
      <el-empty v-else description="暂无分类数据" :image-size="80" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.page-title {
  font-size: 22px;
  font-weight: 600;
}
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.ov-card {
  background: #fff;
  border-radius: var(--radius-base);
  padding: 24px;
  text-align: center;
  box-shadow: var(--card-shadow);
  .ov-num {
    font-size: 30px;
    font-weight: 700;
    color: var(--primary-color);
  }
  .ov-label {
    font-size: 14px;
    color: var(--text-secondary);
    margin-top: 6px;
  }
}
.chart-card {
  padding: 24px;
  margin-bottom: 20px;
}
.chart-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 20px;
}
.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  height: 180px;
  overflow-x: auto;
  padding-bottom: 10px;
}
.trend-bar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 50px;
  flex: 1;
}
.trend-bar-col {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 140px;
}
.trend-bar {
  width: 10px;
  border-radius: 3px 3px 0 0;
  transition: height 0.5s;
  &.users {
    background: var(--primary-color);
  }
  &.products {
    background: var(--secondary-color);
  }
  &.orders {
    background: #2196f3;
  }
}
.trend-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 8px;
}
.legend {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-top: 16px;
  font-size: 13px;
  .leg {
    display: flex;
    align-items: center;
    gap: 6px;
    &::before {
      content: '';
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }
    &.users::before {
      background: var(--primary-color);
    }
    &.products::before {
      background: var(--secondary-color);
    }
    &.orders::before {
      background: #2196f3;
    }
  }
}
.category-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cat-item {
  display: flex;
  align-items: center;
  gap: 14px;
}
.cat-name {
  width: 100px;
  font-size: 14px;
  flex-shrink: 0;
}
.cat-bar-bg {
  flex: 1;
  height: 18px;
  background: var(--bg-color);
  border-radius: 9px;
  overflow: hidden;
}
.cat-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), #81c784);
  border-radius: 9px;
  transition: width 0.5s;
}
.cat-count {
  width: 60px;
  text-align: right;
  font-size: 14px;
  font-weight: 500;
}
@media (max-width: 768px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
  .cat-name {
    width: 70px;
  }
}
</style>
