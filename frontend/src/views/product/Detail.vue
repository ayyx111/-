<script setup>
// 商品详情页:图片轮播 + 商品信息 + 卖家信息 + 操作 + AI相似推荐
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import productApi from '@/api/product'
import orderApi from '@/api/order'
import aiApi from '@/api/ai'
import userApi from '@/api/user'
import { useUserStore } from '@/stores/user'
import { useProductStore } from '@/stores/product'
import { useMessageStore } from '@/stores/message'
import {
  formatPrice,
  formatTime,
  resolveImageUrl,
  getMapLabel,
  CONDITION_MAP,
  TRADE_TYPE_MAP,
  PRODUCT_STATUS_MAP
} from '@/utils/format'
import ProductCard from '@/components/product/ProductCard.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const productStore = useProductStore()
const messageStore = useMessageStore()
const { isLogin, userInfo, isVerified } = storeToRefs(userStore)

const loading = ref(false)
const detail = ref(null)
const relatedList = ref([])
const activeImage = ref(0)
const reportVisible = ref(false)
const reportForm = ref({ reason: '', description: '' })

// 图片列表
const images = computed(() => {
  if (!detail.value) return []
  return detail.value.images?.length ? detail.value.images : [detail.value.coverImage].filter(Boolean)
})

const condition = computed(() => getMapLabel(CONDITION_MAP, detail.value?.conditionLevel))
const tradeType = computed(() => getMapLabel(TRADE_TYPE_MAP, detail.value?.tradeType))
const isOwner = computed(() => detail.value?.user?.id === userInfo.value?.id)
const isFavorited = ref(false)

// 加载详情
async function loadDetail() {
  loading.value = true
  try {
    const res = await productApi.getDetail(route.params.id)
    detail.value = res
    isFavorited.value = !!res.isFavorited
    loadRelated(res.id)
  } catch (e) {
    ElMessage.error('商品不存在或已下架')
    router.push('/')
  } finally {
    loading.value = false
  }
}

// AI 相似推荐
async function loadRelated(productId) {
  try {
    const res = await aiApi.recommend({ type: 'similar', productId, limit: 5 })
    relatedList.value = res || []
  } catch (e) {
    relatedList.value = []
  }
}

// 联系卖家
function contactSeller() {
  if (!isLogin.value) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  const sellerId = detail.value.user.id
  messageStore.setCurrentUser(null)
  router.push({ name: 'Messages', query: { to: sellerId, product: detail.value.id } })
}

// 立即购买
async function buyNow() {
  if (!isLogin.value) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  if (isOwner.value) {
    ElMessage.warning('不能购买自己的商品')
    return
  }
  if (!isVerified.value) {
    ElMessage.warning('请先完成校园认证')
    router.push({ name: 'ProfileVerify' })
    return
  }
  try {
    await ElMessageBox.confirm('确认购买该商品?将创建订单等待卖家确认', '提示', {
      confirmButtonText: '确认购买',
      cancelButtonText: '取消',
      type: 'info'
    })
    const res = await orderApi.create({ productId: detail.value.id })
    ElMessage.success('下单成功,等待卖家确认')
    router.push({ name: 'OrderDetail', params: { id: res.orderId } })
  } catch (e) {
    // 取消或失败
  }
}

// 收藏/取消
async function toggleFavorite() {
  if (!isLogin.value) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  try {
    const newState = await productStore.toggleFavorite(detail.value.id, isFavorited.value)
    isFavorited.value = newState
    ElMessage.success(newState ? '已收藏' : '已取消收藏')
  } catch (e) {
    // ignore
  }
}

// 举报
function openReport() {
  if (!isLogin.value) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  reportForm.value = { reason: '', description: '' }
  reportVisible.value = true
}

async function submitReport() {
  if (!reportForm.value.reason) {
    ElMessage.warning('请选择举报原因')
    return
  }
  try {
    await userApi.report({
      targetType: 1,
      targetId: detail.value.id,
      reason: reportForm.value.reason,
      description: reportForm.value.description
    })
    ElMessage.success('举报已提交,我们将尽快处理')
    reportVisible.value = false
  } catch (e) {
    // ignore
  }
}

watch(() => route.params.id, loadDetail)
onMounted(loadDetail)
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <div class="container" v-if="detail">
      <!-- 面包屑 -->
      <el-breadcrumb separator="/" class="crumb">
        <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item>{{ detail.category?.name }}</el-breadcrumb-item>
        <el-breadcrumb-item>商品详情</el-breadcrumb-item>
      </el-breadcrumb>

      <div class="detail-layout">
        <!-- 左侧:图片 -->
        <div class="detail-left">
          <div class="main-image">
            <el-image :src="resolveImageUrl(images[activeImage])" fit="cover" :preview-src-list="images.map(resolveImageUrl)" hide-on-click-modal>
              <template #error>
                <div class="img-fallback"><el-icon :size="60"><Picture /></el-icon></div>
              </template>
            </el-image>
          </div>
          <div v-if="images.length > 1" class="thumbs">
            <div
              v-for="(img, i) in images"
              :key="i"
              class="thumb"
              :class="{ active: activeImage === i }"
              @click="activeImage = i"
            >
              <el-image :src="resolveImageUrl(img)" fit="cover" />
            </div>
          </div>
        </div>

        <!-- 右侧:信息 -->
        <div class="detail-right">
          <h1 class="detail-title">{{ detail.title }}</h1>
          <div class="price-box">
            <span class="price big">{{ formatPrice(detail.price) }}</span>
            <span v-if="detail.originalPrice" class="original-price">
              原价 ¥{{ formatPrice(detail.originalPrice) }}
            </span>
            <el-tag v-if="condition.label" :type="condition.color" size="small" round>
              {{ condition.label }}
            </el-tag>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <span class="label">交易方式</span>
              <span class="value">{{ tradeType.label }}</span>
            </div>
            <div class="info-item">
              <span class="label">交易地点</span>
              <span class="value">{{ detail.location || '面议' }}</span>
            </div>
            <div class="info-item">
              <span class="label">浏览量</span>
              <span class="value">{{ detail.viewCount || 0 }}</span>
            </div>
            <div class="info-item">
              <span class="label">收藏数</span>
              <span class="value">{{ detail.favoriteCount || 0 }}</span>
            </div>
            <div class="info-item">
              <span class="label">发布时间</span>
              <span class="value">{{ formatTime(detail.createdAt) }}</span>
            </div>
          </div>

          <!-- 卖家信息 -->
          <div class="seller-card" style="cursor:pointer" @click="router.push(`/user/${detail.user?.id}`)">
            <el-avatar :size="48" :src="resolveImageUrl(detail.user?.avatar)">
              {{ detail.user?.nickname?.[0] }}
            </el-avatar>
            <div class="seller-info">
              <div class="seller-name">
                {{ detail.user?.nickname }}
                <el-tag v-if="detail.user?.isVerified === 1" type="success" size="small" round>
                  <el-icon><CircleCheck /></el-icon>已认证
                </el-tag>
              </div>
              <div class="seller-meta">
                <span class="school">
                  <el-icon><Location /></el-icon>{{ detail.user?.school || '未填写' }}
                </span>
                <span class="credit">
                  信用分: <b class="text-primary">{{ detail.user?.creditScore || 100 }}</b>
                </span>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="action-box">
            <el-button
              v-if="!isOwner"
              type="primary"
              size="large"
              class="action-btn"
              @click="contactSeller"
            >
              <el-icon><ChatDotRound /></el-icon>联系卖家
            </el-button>
            <el-button
              v-if="!isOwner"
              type="warning"
              size="large"
              class="action-btn"
              @click="buyNow"
            >
              <el-icon><ShoppingCart /></el-icon>立即购买
            </el-button>
            <el-button
              size="large"
              :class="['action-btn', { favorited: isFavorited }]"
              @click="toggleFavorite"
            >
              <el-icon><Star v-if="!isFavorited" /><StarFilled v-else /></el-icon>
              {{ isFavorited ? '已收藏' : '收藏' }}
            </el-button>
            <el-button v-if="!isOwner" size="large" plain @click="openReport">
              <el-icon><Warning /></el-icon>举报
            </el-button>
            <el-button v-if="isOwner" size="large" plain @click="router.push({ name: 'ProductEdit', params: { id: detail.id } })">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
          </div>
        </div>
      </div>

      <!-- 商品描述 -->
      <div class="desc-section card">
        <h3 class="section-title">商品描述</h3>
        <div class="desc-content">{{ detail.description || '卖家暂无描述' }}</div>
      </div>

      <!-- 买家评价(买家对卖家售卖该商品的评价) -->
      <div v-if="detail.reviews?.length" class="reviews-section card">
        <h3 class="section-title">
          <el-icon class="title-icon"><ChatLineRound /></el-icon>买家评价
        </h3>
        <div v-for="rev in detail.reviews" :key="rev.id" class="review-item">
          <div class="review-head">
            <span class="reviewer">{{ rev.reviewer?.nickname }}</span>
            <el-rate :model-value="rev.rating" disabled />
          </div>
          <p class="review-content">{{ rev.content || '该用户未填写评价内容' }}</p>
          <span class="review-time">{{ formatTime(rev.createdAt) }}</span>
        </div>
      </div>

      <!-- AI 相似推荐 -->
      <section v-if="relatedList.length" class="related-section">
        <div class="section-header">
          <h3 class="section-title">
            <el-icon class="title-icon"><MagicStick /></el-icon>相似好物推荐
          </h3>
          <span class="section-sub">AI 智能匹配</span>
        </div>
        <div class="related-grid">
          <ProductCard v-for="item in relatedList" :key="item.id" :product="item" />
        </div>
      </section>
    </div>

    <!-- 举报弹窗 -->
    <el-dialog v-model="reportVisible" title="举报商品" width="460px">
      <el-form :model="reportForm" label-width="80px">
        <el-form-item label="举报原因" required>
          <el-select v-model="reportForm.reason" placeholder="请选择举报原因" style="width: 100%">
            <el-option label="虚假信息" value="虚假信息" />
            <el-option label="违禁品" value="违禁品" />
            <el-option label="欺诈行为" value="欺诈行为" />
            <el-option label="色情低俗" value="色情低俗" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="详细描述">
          <el-input
            v-model="reportForm.description"
            type="textarea"
            :rows="4"
            placeholder="请描述具体问题(选填)"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reportVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReport">提交举报</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.crumb {
  margin-bottom: 16px;
}
.detail-layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 30px;
  background: #fff;
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--card-shadow);
}
.main-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-base);
  overflow: hidden;
  background: var(--bg-color);
  .el-image {
    width: 100%;
    height: 100%;
  }
  .img-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }
}
.thumbs {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  overflow-x: auto;
}
.thumb {
  width: 64px;
  height: 64px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  flex-shrink: 0;
  &.active {
    border-color: var(--primary-color);
  }
  .el-image {
    width: 100%;
    height: 100%;
  }
}
.detail-title {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 16px;
}
.price-box {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 16px;
  background: var(--primary-light);
  border-radius: var(--radius-base);
  margin-bottom: 20px;
  .price.big {
    font-size: 30px;
    color: #ff4d4f;
  }
  .original-price {
    font-size: 14px;
  }
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 20px;
  margin-bottom: 20px;
}
.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  .label {
    color: var(--text-secondary);
  }
  .value {
    color: var(--text-primary);
  }
}
.seller-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-color);
  border-radius: var(--radius-base);
  margin-bottom: 20px;
}
.seller-info {
  flex: 1;
}
.seller-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 6px;
}
.seller-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  .school {
    display: flex;
    align-items: center;
    gap: 2px;
  }
}
.action-box {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  .action-btn {
    flex: 1;
    min-width: 120px;
  }
  .favorited {
    color: var(--secondary-color);
    border-color: var(--secondary-color);
  }
}
.desc-section {
  margin-top: 24px;
  padding: 24px;
}
.section-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  .title-icon {
    color: var(--secondary-color);
  }
}
.desc-content {
  color: var(--text-regular);
  line-height: 1.8;
  white-space: pre-wrap;
}
.reviews-section {
  margin-top: 24px;
  padding: 24px;
}
.review-item {
  padding: 14px 0;
  border-bottom: 1px dashed var(--border-color);
  &:last-child {
    border-bottom: none;
  }
  .review-head {
    display: flex;
    align-items: center;
    gap: 12px;
    .reviewer {
      font-weight: 500;
      font-size: 14px;
    }
  }
  .review-content {
    margin: 8px 0;
    color: var(--text-regular);
    line-height: 1.6;
    white-space: pre-wrap;
  }
  .review-time {
    font-size: 12px;
    color: var(--text-secondary);
  }
}
.related-section {
  margin-top: 32px;
}
.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  .section-sub {
    font-size: 12px;
    color: var(--secondary-color);
    background: var(--secondary-light);
    padding: 2px 8px;
    border-radius: 10px;
  }
}
.related-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}

@media (max-width: 992px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
  .related-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 768px) {
  .related-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
