<script setup>
// 我的订单:Tab 切换 买到/卖出 + 订单卡片 + 操作
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import orderApi from '@/api/order'
import { useUserStore } from '@/stores/user'
import {
  formatPrice,
  formatTime,
  resolveImageUrl,
  getMapLabel,
  ORDER_STATUS_MAP
} from '@/utils/format'

const router = useRouter()
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)
const loading = ref(false)
const activeTab = ref('buyer')
const list = ref([])
const pagination = ref({ page: 1, pageSize: 10, total: 0, totalPages: 0 })

async function loadData() {
  loading.value = true
  try {
    const res = await orderApi.getList({
      role: activeTab.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })
    list.value = res.list || []
    pagination.value = res.pagination || pagination.value
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function changeTab(tab) {
  activeTab.value = tab
  pagination.value.page = 1
  loadData()
}

function changePage(p) {
  pagination.value.page = p
  loadData()
}

// 卖家确认/拒绝
async function handleConfirm(order, action) {
  try {
    if (action === 'reject') {
      const { value } = await ElMessageBox.prompt('请输入拒绝原因', '拒绝订单', {
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      })
      await orderApi.confirm(order.id, { action, reason: value })
    } else {
      await ElMessageBox.confirm('确认接受该订单?', '提示', { type: 'info' })
      await orderApi.confirm(order.id, { action })
    }
    ElMessage.success('操作成功')
    loadData()
  } catch (e) {}
}

async function handleCancel(order) {
  try {
    await ElMessageBox.confirm('确认取消该订单?', '提示', { type: 'warning' })
    await orderApi.cancel(order.id, {})
    ElMessage.success('已取消')
    loadData()
  } catch (e) {}
}

async function handleComplete(order) {
  try {
    await ElMessageBox.confirm('确认交易已完成?', '提示', { type: 'info' })
    await orderApi.complete(order.id)
    ElMessage.success('交易完成')
    loadData()
  } catch (e) {}
}

// 当前订单中当前用户是否为买家/卖家
function isBuyer(order) {
  return order?.buyer?.id === userInfo.value?.id
}
function isSeller(order) {
  return order?.seller?.id === userInfo.value?.id
}

// 列表内联评价
const reviewVisible = ref(false)
const reviewForm = ref({ orderId: null, rating: 5, content: '' })
function openReview(order) {
  reviewForm.value = { orderId: order.id, rating: 5, content: '' }
  reviewVisible.value = true
}
async function submitReview() {
  try {
    await orderApi.review(reviewForm.value.orderId, { rating: reviewForm.value.rating, content: reviewForm.value.content })
    ElMessage.success('评价成功')
    reviewVisible.value = false
    loadData()
  } catch (e) {}
}

onMounted(loadData)
</script>

<template>
  <div class="page-wrapper">
    <div class="container">
      <h2 class="page-title">我的订单</h2>

      <el-tabs :model-value="activeTab" @tab-change="changeTab">
        <el-tab-pane label="我买到的" name="buyer" />
        <el-tab-pane label="我卖出的" name="seller" />
      </el-tabs>

      <div v-loading="loading" class="list-wrap">
        <div v-if="list.length" class="order-list">
          <div
            v-for="order in list"
            :key="order.id"
            class="order-item card"
            @click="router.push(`/orders/${order.id}`)"
          >
            <el-image :src="resolveImageUrl(order.product?.coverImage)" fit="cover" class="o-img" />
            <div class="o-info">
              <h3 class="o-title text-ellipsis">{{ order.product?.title }}</h3>
              <div class="o-price price">{{ formatPrice(order.product?.price) }}</div>
              <div class="o-meta">
                <span>订单号:{{ order.orderNo }}</span>
                <span>{{ formatTime(order.createdAt) }}</span>
              </div>
            </div>
            <div class="o-right">
              <el-tag :type="getMapLabel(ORDER_STATUS_MAP, order.status).color" size="small">
                {{ getMapLabel(ORDER_STATUS_MAP, order.status).label }}
              </el-tag>
              <div class="o-actions" @click.stop>
                <template v-if="isSeller(order) && order.status === 0">
                  <el-button size="small" type="primary" @click="handleConfirm(order, 'accept')">接受</el-button>
                  <el-button size="small" type="danger" plain @click="handleConfirm(order, 'reject')">拒绝</el-button>
                </template>
                <template v-if="isBuyer(order) && order.status === 0">
                  <el-button size="small" @click="handleCancel(order)">取消</el-button>
                </template>
                <!-- 仅买家确认交易完成(status=2 为旧版两步确认流遗留订单,提供恢复通道) -->
                <template v-if="isBuyer(order) && (order.status === 1 || order.status === 2)">
                  <el-button size="small" type="primary" @click="handleComplete(order)">确认完成</el-button>
                </template>
                <!-- 买卖双方各自评价:交易完成后未评价 -->
                <template v-if="order.status === 3 && !order.isReviewed">
                  <el-button size="small" type="warning" @click="openReview(order)">评价</el-button>
                </template>
                <el-button size="small" plain @click="router.push(`/orders/${order.id}`)">详情</el-button>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else-if="!loading" :description="activeTab === 'buyer' ? '暂无购买订单' : '暂无销售订单'" />
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

    <el-dialog v-model="reviewVisible" title="评价交易" width="460px">
      <el-form :model="reviewForm" label-width="80px">
        <el-form-item label="评分">
          <el-rate v-model="reviewForm.rating" />
        </el-form-item>
        <el-form-item label="评价内容">
          <el-input v-model="reviewForm.content" type="textarea" :rows="4" placeholder="说说您的交易感受(选填)" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReview">提交评价</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.page-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 16px;
}
.list-wrap {
  min-height: 200px;
}
.order-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px;
  margin-bottom: 12px;
  cursor: pointer;
}
.o-img {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  flex-shrink: 0;
}
.o-info {
  flex: 1;
  min-width: 0;
}
.o-title {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 8px;
}
.o-price {
  font-size: 17px;
  margin-bottom: 8px;
}
.o-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}
.o-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}
.o-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.pagination {
  margin-top: 20px;
  text-align: center;
}

@media (max-width: 768px) {
  .order-item {
    flex-wrap: wrap;
  }
  .o-right {
    flex-direction: row;
    align-items: center;
    width: 100%;
    justify-content: space-between;
  }
}
</style>
