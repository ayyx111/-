<script setup>
// 搜索结果页:支持 AI 智能搜索扩展词
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import aiApi from '@/api/ai'
import ProductList from '@/components/product/ProductList.vue'

const route = useRoute()
const loading = ref(false)
const resultList = ref([])
const pagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
const expandedKeywords = ref([])
const suggestion = ref('')
const keyword = ref('')

async function doSearch() {
  keyword.value = route.query.keyword
  if (!keyword.value) return
  loading.value = true
  pagination.value.page = 1
  try {
    const res = await aiApi.search({
      keyword: keyword.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })
    resultList.value = res.list || []
    pagination.value = res.pagination || pagination.value
    expandedKeywords.value = res.expandedKeywords || []
    suggestion.value = res.suggestion || ''
  } catch (e) {
    resultList.value = []
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value) return
  pagination.value.page++
  loading.value = true
  try {
    const res = await aiApi.search({
      keyword: keyword.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })
    resultList.value.push(...(res.list || []))
    pagination.value = res.pagination || pagination.value
  } catch (e) {
    // ignore
  } finally {
    loading.value = false
  }
}

watch(() => route.query.keyword, doSearch)
onMounted(doSearch)
</script>

<template>
  <div class="page-wrapper">
    <div class="container">
      <div class="search-info">
        <h2>搜索"<span class="kw">{{ keyword }}</span>"</h2>
        <p v-if="pagination.total" class="result-count">共找到 {{ pagination.total }} 条结果</p>
      </div>

      <!-- AI 扩展提示 -->
      <el-alert
        v-if="suggestion"
        :title="suggestion"
        type="info"
        :closable="false"
        show-icon
        class="ai-suggest"
      />
      <div v-if="expandedKeywords.length" class="expanded">
        <span class="label">相关词:</span>
        <el-tag
          v-for="k in expandedKeywords"
          :key="k"
          size="small"
          effect="plain"
          class="tag"
        >
          {{ k }}
        </el-tag>
      </div>

      <ProductList :list="resultList" :loading="loading" empty-text="未找到相关商品" />

      <div v-if="resultList.length < pagination.total" class="load-more">
        <el-button type="primary" plain :loading="loading" @click="loadMore">加载更多</el-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-info {
  margin: 10px 0 16px;
  h2 {
    font-size: 20px;
    .kw {
      color: var(--primary-color);
    }
  }
  .result-count {
    color: var(--text-secondary);
    font-size: 13px;
    margin-top: 4px;
  }
}
.ai-suggest {
  margin-bottom: 12px;
}
.expanded {
  margin-bottom: 20px;
  .label {
    color: var(--text-secondary);
    font-size: 13px;
    margin-right: 8px;
  }
  .tag {
    margin-right: 6px;
  }
}
.load-more {
  text-align: center;
  margin: 30px 0;
}
</style>
