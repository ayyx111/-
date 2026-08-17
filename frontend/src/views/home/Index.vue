<script setup>
// 首页:分类导航 + 商品网格 + AI推荐 + 分页
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import productApi from '@/api/product'
import aiApi from '@/api/ai'
import { useProductStore } from '@/stores/product'
import ProductList from '@/components/product/ProductList.vue'

const route = useRoute()
const router = useRouter()
const productStore = useProductStore()

const loading = ref(false)
const productList = ref([])
const recommendList = ref([])
const pagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
const currentCategory = ref(null)
const sortType = ref('latest')
const finished = ref(false) // 分页是否到底

// 排序选项
const sortOptions = [
  { label: '最新发布', value: 'latest' },
  { label: '价格从低到高', value: 'price_asc' },
  { label: '价格从高到低', value: 'price_desc' },
  { label: '热度优先', value: 'hot' }
]

// 加载商品列表
async function loadProducts(reset = false) {
  if (loading.value) return
  if (reset) {
    pagination.value.page = 1
    finished.value = false
    productList.value = []
  }
  if (finished.value) return
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      sort: sortType.value
    }
    if (currentCategory.value) params.categoryId = currentCategory.value
    if (route.query.keyword) params.keyword = route.query.keyword

    const res = await productApi.getList(params)
    const list = res.list || []
    if (reset) {
      productList.value = list
    } else {
      productList.value.push(...list)
    }
    pagination.value = res.pagination || pagination.value
    if (productList.value.length >= pagination.value.total || list.length === 0) {
      finished.value = true
    }
  } catch (e) {
    // 错误已由拦截器提示
  } finally {
    loading.value = false
  }
}

// 加载 AI 推荐
async function loadRecommend() {
  try {
    const res = await aiApi.recommend({ type: 'home', limit: 8 })
    recommendList.value = res || []
  } catch (e) {
    recommendList.value = []
  }
}

// 选择分类
function selectCategory(id) {
  currentCategory.value = id
  loadProducts(true)
}

// 切换排序
function changeSort(val) {
  sortType.value = val
  loadProducts(true)
}

// 加载更多
function loadMore() {
  if (finished.value || loading.value) return
  pagination.value.page++
  loadProducts()
}

// 监听搜索关键词变化
watch(
  () => route.query.keyword,
  () => {
    if (route.name === 'Home') loadProducts(true)
  }
)

onMounted(async () => {
  await productStore.fetchCategories()
  loadProducts(true)
  loadRecommend()
})
</script>

<template>
  <div class="page-wrapper">
    <div class="container">
      <!-- 分类导航 -->
      <div class="category-bar card">
        <div
          class="category-item"
          :class="{ active: !currentCategory }"
          @click="selectCategory(null)"
        >
          <el-icon><Grid /></el-icon>
          <span>全部</span>
        </div>
        <div
          v-for="c in productStore.categories"
          :key="c.id"
          class="category-item"
          :class="{ active: currentCategory === c.id }"
          @click="selectCategory(c.id)"
        >
          <el-icon><Goods /></el-icon>
          <span>{{ c.name }}</span>
        </div>
      </div>

      <!-- 商品列表标题 + 排序 -->
      <div class="list-header">
        <h2 class="list-title">
          {{ currentCategory
            ? productStore.categories.find((c) => c.id === currentCategory)?.name
            : '全部商品' }}
        </h2>
        <el-radio-group v-model="sortType" size="small" @change="changeSort">
          <el-radio-button v-for="s in sortOptions" :key="s.value" :value="s.value">
            {{ s.label }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <!-- 商品网格 -->
      <ProductList :list="productList" :loading="loading" empty-text="暂无商品,换个条件试试" />

      <!-- 分页加载 -->
      <div v-if="productList.length" class="load-more">
        <el-button
          v-if="!finished"
          type="primary"
          plain
          :loading="loading"
          @click="loadMore"
        >
          加载更多
        </el-button>
        <span v-else class="no-more">没有更多了~</span>
      </div>

      <!-- AI 推荐区 -->
      <section v-if="recommendList.length" class="recommend-section">
        <div class="section-header">
          <h2 class="section-title">
            <el-icon class="title-icon"><MagicStick /></el-icon>
            猜你喜欢
          </h2>
          <span class="section-sub">AI 智能推荐</span>
        </div>
        <ProductList :list="recommendList" :loading="false" />
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.category-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 16px;
  margin-bottom: 20px;
}
.category-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  background: var(--bg-color);
  color: var(--text-regular);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  &:hover {
    background: var(--primary-light);
    color: var(--primary-color);
  }
  &.active {
    background: var(--primary-color);
    color: #fff;
  }
}
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  .list-title {
    font-size: 20px;
    font-weight: 600;
  }
}
.load-more {
  text-align: center;
  margin: 30px 0;
  .no-more {
    color: var(--text-secondary);
    font-size: 14px;
  }
}
.recommend-section {
  margin-top: 40px;
}
.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 20px;
    font-weight: 600;
    .title-icon {
      color: var(--secondary-color);
    }
  }
  .section-sub {
    font-size: 12px;
    color: var(--secondary-color);
    background: var(--secondary-light);
    padding: 2px 8px;
    border-radius: 10px;
  }
}

@media (max-width: 768px) {
  .list-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    .list-title {
      font-size: 18px;
    }
  }
}
</style>
