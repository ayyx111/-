<script setup>
// 我的收藏:收藏商品列表 + 取消收藏
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import favoriteApi from '@/api/favorite'
import ProductList from '@/components/product/ProductList.vue'

const loading = ref(false)
const list = ref([])
const pagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 0 })

async function loadData() {
  loading.value = true
  try {
    const res = await favoriteApi.getList({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })
    list.value = (res.list || []).map((item) => item.product || item)
    pagination.value = res.pagination || pagination.value
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function changePage(p) {
  pagination.value.page = p
  loadData()
}

onMounted(loadData)
</script>

<template>
  <div class="page-wrapper">
    <div class="container">
      <h2 class="page-title">我的收藏</h2>
      <ProductList :list="list" :loading="loading" empty-text="暂无收藏商品" />

      <div v-if="pagination.total > pagination.pageSize" class="pagination">
        <el-pagination
          background
          layout="prev, pager, next"
          :total="pagination.total"
          :page-size="pagination.pageSize"
          :current-page="pagination.page"
          @current-change="changePage"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 20px;
}
.pagination {
  margin-top: 30px;
  text-align: center;
}
</style>
