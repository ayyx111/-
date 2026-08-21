<script setup>
// 我的发布:商品列表 + 状态标签 + 编辑/下架/删除
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import productApi from '@/api/product'
import {
  formatPrice,
  formatTime,
  resolveImageUrl,
  getMapLabel,
  PRODUCT_STATUS_MAP
} from '@/utils/format'

const router = useRouter()
const loading = ref(false)
const list = ref([])
const pagination = ref({ page: 1, pageSize: 10, total: 0, totalPages: 0 })
const statusFilter = ref('')

const statusTabs = [
  { label: '全部', value: '' },
  { label: '待审核', value: 0 },
  { label: '在售', value: 1 },
  { label: '已锁定', value: 2 },
  { label: '已售', value: 3 },
  { label: '已下架', value: 4 },
  { label: '审核未通过', value: 5 }
]

async function loadData() {
  loading.value = true
  try {
    const params = { page: pagination.value.page, pageSize: pagination.value.pageSize }
    if (statusFilter.value !== '') params.status = statusFilter.value
    const res = await productApi.getMyProducts(params)
    list.value = res.list || []
    pagination.value = res.pagination || pagination.value
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function changeTab(val) {
  statusFilter.value = val
  pagination.value.page = 1
  loadData()
}

function changePage(p) {
  pagination.value.page = p
  loadData()
}

function editItem(item) {
  router.push({ name: 'ProductEdit', params: { id: item.id } })
}

// 下架/上架 (后端:1=在售 4=已下架)
async function toggleShelf(item) {
  try {
    await ElMessageBox.confirm(item.status === 1 ? '确认下架该商品?' : '确认重新上架?', '提示', {
      type: 'warning'
    })
    await productApi.update(item.id, { status: item.status === 1 ? 4 : 1 })
    ElMessage.success('操作成功')
    loadData()
  } catch (e) {}
}

// 删除
async function deleteItem(item) {
  try {
    await ElMessageBox.confirm('确认删除该商品?删除后不可恢复', '危险操作', {
      type: 'error',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    })
    await productApi.remove(item.id)
    ElMessage.success('已删除')
    loadData()
  } catch (e) {}
}

onMounted(loadData)
</script>

<template>
  <div class="page-wrapper">
    <div class="container">
      <div class="page-head">
        <h2 class="page-title">我的发布</h2>
        <el-button type="primary" @click="router.push('/products/create')">
          <el-icon><Plus /></el-icon>发布商品
        </el-button>
      </div>

      <el-tabs :model-value="statusFilter" @tab-change="changeTab">
        <el-tab-pane v-for="t in statusTabs" :key="t.value" :label="t.label" :name="t.value" />
      </el-tabs>

      <div v-loading="loading" class="list-wrap">
        <div v-if="list.length" class="my-list">
          <div v-for="item in list" :key="item.id" class="my-item card">
            <el-image :src="resolveImageUrl(item.coverImage || item.images?.[0])" fit="cover" class="item-img" />
            <div class="item-info">
              <h3 class="item-title text-ellipsis" @click="router.push(`/products/${item.id}`)">
                {{ item.title }}
              </h3>
              <div class="item-price price">{{ formatPrice(item.price) }}</div>
              <div class="item-meta">
                <el-tag :type="getMapLabel(PRODUCT_STATUS_MAP, item.status).color" size="small">
                  {{ getMapLabel(PRODUCT_STATUS_MAP, item.status).label }}
                </el-tag>
                <span class="time">{{ formatTime(item.createdAt) }}</span>
                <span class="view">浏览 {{ item.viewCount || 0 }}</span>
              </div>
            </div>
            <div class="item-actions">
              <el-button size="small" @click="editItem(item)">编辑</el-button>
              <el-button
                v-if="item.status === 1"
                size="small"
                type="warning"
                plain
                @click="toggleShelf(item)"
              >下架</el-button>
              <el-button
                v-else-if="item.status === 4"
                size="small"
                type="success"
                plain
                @click="toggleShelf(item)"
              >上架</el-button>
              <el-button size="small" type="danger" plain @click="deleteItem(item)">删除</el-button>
            </div>
          </div>
        </div>
        <el-empty v-else-if="!loading" description="暂无商品" />
      </div>

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
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-title {
  font-size: 22px;
  font-weight: 600;
}
.list-wrap {
  min-height: 200px;
}
.my-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px;
  margin-bottom: 12px;
}
.item-img {
  width: 90px;
  height: 90px;
  border-radius: 8px;
  flex-shrink: 0;
}
.item-info {
  flex: 1;
  min-width: 0;
}
.item-title {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 8px;
  cursor: pointer;
  &:hover {
    color: var(--primary-color);
  }
}
.item-price {
  font-size: 18px;
  margin-bottom: 8px;
}
.item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}
.item-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pagination {
  margin-top: 20px;
  text-align: center;
}

@media (max-width: 768px) {
  .item-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
