<script setup>
// 订单详情页
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

const loading = ref(false)
const order = ref(null)
const reviewVisible = ref(false)
const reviewForm = ref({ rating: 5, content: '' })

const status = computed(() => getMapLabel(ORDER_STATUS_MAP, order.value?.status))
const isBuyer = computed(() => order.value?.buyer?.id === userInfo.value?.id)
const isSeller = computed(() => order.value?.seller?.id === userInfo.value?.id)
// 当前用户是否已评价(后端按当前用户计算)
const hasReviewed = computed(() => !!order.value?.isReviewed)

async function loadOrder() {
  loading.value = true
  try {
    const res = await orderApi.getDetail(route.params.id)
    order.value = res
  } catch (e) {
    ElMessage.error('订单不存在')
    router.push('/profile/orders')
  } finally {
    loading.value = false
  }
}

// 卖家确认/拒绝
async function handleConfirm(action) {
  const tip = action === 'accept' ? '确认接受该订单?' : '确认拒绝该订单?'
  let reason = ''
  try {
    if (action === 'reject') {
      const { value } = await ElMessageBox.prompt('请输入拒绝原因', '拒绝订单', {
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      })
      reason = value
    } else {
      await ElMessageBox.confirm(tip, '提示', { type: 'info' })
    }
    await orderApi.confirm(order.value.id, { action, reason })
    ElMessage.success('操作成功')
    loadOrder()
  } catch (e) {
    // 取消
  }
}

// 买家取消
async function handleCancel() {
  try {
    await ElMessageBox.confirm('确认取消该订单?', '提示', { type: 'warning' })
    await orderApi.cancel(order.value.id, {})
    ElMessage.success('订单已取消')
    loadOrder()
  } catch (e) {}
}

// 确认完成
async function handleComplete() {
  try {
    await ElMessageBox.confirm('确认交易已完成?', '提示', { type: 'info' })
    await orderApi.complete(order.value.id)
    ElMessage.success('交易已完成')
    loadOrder()
  } catch (e) {}
}

// 评价
function openReview() {
  reviewForm.value = { rating: 5, content: '' }
  reviewVisible.value = true
}

async function submitReview() {
  try {
    await orderApi.review(order.value.id, reviewForm.value)
    ElMessage.success('评价成功')
    reviewVisible.value = false
    loadOrder()
  } catch (e) {}
}

onMounted(loadOrder)
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <div class="container" v-if="order">
      <el-breadcrumb separator="/" class="crumb">
        <el-breadcrumb-item :to="{ path: '/profile/orders' }">我的订单</el-breadcrumb-item>
        <el-breadcrumb-item>订单详情</el-breadcrumb-item>
      </el-breadcrumb>

      <div class="order-card card">
        <div class="order-head">
          <div>
            <span class="order-no">订单号:{{ order.orderNo }}</span>
            <el-tag :type="status.color" size="small" round>{{ status.label }}</el-tag>
          </div>
          <span class="order-time">下单时间:{{ formatTime(order.createdAt) }}</span>
        </div>

        <div class="product-row">
          <el-image :src="resolveImageUrl(order.product?.coverImage)" fit="cover" class="p-img" />
          <div class="p-info">
            <h3 @click="router.push(`/products/${order.product?.id}`)">{{ order.product?.title }}</h3>
            <span class="price">{{ formatPrice(order.product?.price) }}</span>
          </div>
        </div>

        <!-- 交易双方 -->
        <div class="parties">
          <div class="party">
            <span class="label">买家</span>
            <el-avatar :size="32" :src="resolveImageUrl(order.buyer?.avatar)">{{ order.buyer?.nickname?.[0] }}</el-avatar>
            <span>{{ order.buyer?.nickname }}</span>
          </div>
          <div class="party">
            <span class="label">卖家</span>
            <el-avatar :size="32" :src="resolveImageUrl(order.seller?.avatar)">{{ order.seller?.nickname?.[0] }}</el-avatar>
            <span>{{ order.seller?.nickname }}</span>
          </div>
        </div>

        <div v-if="order.remark" class="remark">
          <span class="label">备注:</span>{{ order.remark }}
        </div>

        <!-- 操作 -->
        <div class="order-actions">
          <template v-if="isSeller && order.status === 0">
            <el-button type="primary" @click="handleConfirm('accept')">接受订单</el-button>
            <el-button type="danger" plain @click="handleConfirm('reject')">拒绝订单</el-button>
          </template>
          <template v-if="isBuyer && order.status === 0">
            <el-button @click="handleCancel">取消订单</el-button>
          </template>
          <!-- 仅买家确认交易完成(status=2 为旧版两步确认流遗留订单,提供恢复通道) -->
          <template v-if="isBuyer && (order.status === 1 || order.status === 2)">
            <el-button type="primary" @click="handleComplete">确认交易完成</el-button>
          </template>
          <template v-if="order.status === 3 && !hasReviewed">
            <el-button type="warning" @click="openReview">评价</el-button>
          </template>
        </div>
      </div>

      <!-- 评价展示(买卖双方互评) -->
      <div v-if="order.reviews?.length" class="review-card card">
        <h3>交易评价</h3>
        <div v-for="rev in order.reviews" :key="rev.id" class="review-item">
          <el-rate :model-value="rev.rating" disabled />
          <p>{{ rev.content || '该用户未填写评价内容' }}</p>
          <span class="review-meta">
            {{ rev.reviewer_role === 1 ? '买家' : '卖家' }} {{ rev.reviewer?.nickname }}
            · {{ formatTime(rev.createdAt) }}
          </span>
        </div>
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
.crumb {
  margin-bottom: 16px;
}
.order-card {
  padding: 24px;
  margin-bottom: 20px;
}
.order-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
  .order-no {
    margin-right: 12px;
    color: var(--text-secondary);
    font-size: 13px;
  }
  .order-time {
    font-size: 13px;
    color: var(--text-secondary);
  }
}
.product-row {
  display: flex;
  gap: 16px;
  padding: 20px 0;
  .p-img {
    width: 90px;
    height: 90px;
    border-radius: 8px;
    flex-shrink: 0;
  }
  .p-info {
    h3 {
      font-size: 16px;
      margin-bottom: 10px;
      cursor: pointer;
      &:hover {
        color: var(--primary-color);
      }
    }
    .price {
      font-size: 20px;
    }
  }
}
.parties {
  display: flex;
  gap: 40px;
  padding: 16px 0;
  border-top: 1px solid var(--border-color);
}
.party {
  display: flex;
  align-items: center;
  gap: 8px;
  .label {
    color: var(--text-secondary);
    font-size: 13px;
    margin-right: 4px;
  }
}
.remark {
  padding: 12px;
  background: var(--bg-color);
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  .label {
    color: var(--text-secondary);
  }
}
.order-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}
.review-card {
  padding: 24px;
  h3 {
    font-size: 16px;
    margin-bottom: 12px;
  }
  .review-item {
    padding: 14px 0;
    border-bottom: 1px dashed var(--border-color);
    &:last-child {
      border-bottom: none;
    }
    p {
      margin: 8px 0;
      line-height: 1.6;
    }
    .review-meta {
      font-size: 12px;
      color: var(--text-secondary);
    }
  }
}
</style>
