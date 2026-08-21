<script setup>
// 用户公开主页:点头像进入 — 展示个性签名、历史发布商品、收到的评价
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import userApi from '@/api/user'
import { resolveImageUrl, formatTime, formatPrice } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const profile = ref(null)

async function loadProfile() {
  loading.value = true
  try {
    const res = await userApi.getPublicProfile(route.params.id)
    profile.value = res
  } catch (e) {
    // 拦截器会提示
  } finally {
    loading.value = false
  }
}

function goProduct(id) {
  router.push({ name: 'ProductDetail', params: { id } })
}

onMounted(() => {
  loadProfile()
})
</script>

<template>
  <div class="page-wrapper">
    <div class="container" v-loading="loading">
      <template v-if="profile">
        <!-- 用户信息卡片 -->
        <div class="profile-header card">
          <el-avatar :size="80" :src="resolveImageUrl(profile.avatar)">
            {{ profile.nickname?.[0] || 'U' }}
          </el-avatar>
          <div class="user-meta">
            <div class="username">
              {{ profile.nickname || profile.username || '用户' }}
              <el-tag v-if="profile.is_verified === 1" type="success" size="small" round>
                <el-icon><CircleCheck /></el-icon>已认证
              </el-tag>
            </div>
            <div v-if="profile.bio" class="user-bio">{{ profile.bio }}</div>
            <div class="user-school">
              <el-icon><Location /></el-icon>{{ profile.school || '未填写学校' }}
            </div>
            <div class="user-stats">
              <div class="stat">
                <span class="num">{{ profile.productCount || 0 }}</span>
                <span class="label">发布</span>
              </div>
              <div class="stat">
                <span class="num">{{ profile.soldCount || 0 }}</span>
                <span class="label">已售</span>
              </div>
              <div class="stat">
                <span class="num text-primary">{{ profile.credit_score || 100 }}</span>
                <span class="label">信用分</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab:在售商品 + 评价 -->
        <el-tabs class="card tabs-card">
          <el-tab-pane :label="`在售商品 (${profile.products?.length || 0})`">
            <div v-if="profile.products?.length" class="product-grid">
              <div
                v-for="p in profile.products"
                :key="p.id"
                class="product-item"
                @click="goProduct(p.id)"
              >
                <div class="product-img">
                  <el-image
                    :src="resolveImageUrl(p.images?.[0])"
                    fit="cover"
                    style="width:100%;height:120px;border-radius:8px"
                  >
                    <template #error><div class="img-fallback">无图</div></template>
                  </el-image>
                </div>
                <div class="product-title">{{ p.title }}</div>
                <div class="product-price">¥{{ formatPrice(p.price) }}</div>
              </div>
            </div>
            <el-empty v-else description="暂无在售商品" />
          </el-tab-pane>

          <el-tab-pane :label="`收到评价 (${profile.reviews?.length || 0})`">
            <div v-if="profile.reviews?.length" class="review-list">
              <div v-for="r in profile.reviews" :key="r.id" class="review-item">
                <div class="review-header">
                  <el-avatar :size="32" :src="resolveImageUrl(r.reviewer?.avatar)">
                    {{ r.reviewer?.nickname?.[0] || 'U' }}
                  </el-avatar>
                  <span class="reviewer-name">{{ r.reviewer?.nickname || r.reviewer?.username || '匿名用户' }}</span>
                  <el-rate :model-value="r.rating" disabled size="small" />
                  <span class="review-time">{{ formatTime(r.created_at || r.createdAt) }}</span>
                </div>
                <div v-if="r.content" class="review-content">{{ r.content }}</div>
                <div v-else class="review-content muted">未填写评价内容</div>
              </div>
            </div>
            <el-empty v-else description="暂无评价" />
          </el-tab-pane>
        </el-tabs>
      </template>
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
.user-bio {
  color: #999;
  font-size: 13px;
  margin-bottom: 6px;
  font-style: italic;
}
.user-school {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 6px;
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
  }
  .label {
    font-size: 12px;
    color: var(--text-secondary);
  }
}
.tabs-card {
  padding: 16px;
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}
.product-item {
  cursor: pointer;
  transition: transform 0.2s;
  &:hover {
    transform: translateY(-2px);
  }
}
.img-fallback {
  width: 100%;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 8px;
  color: #ccc;
}
.product-title {
  font-size: 14px;
  margin-top: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-price {
  color: #ff5000;
  font-weight: 600;
  font-size: 16px;
}
.review-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.review-item {
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}
.review-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.reviewer-name {
  font-size: 14px;
  font-weight: 500;
}
.review-time {
  margin-left: auto;
  font-size: 12px;
  color: #999;
}
.review-content {
  font-size: 14px;
  color: #333;
  padding-left: 40px;
  &.muted {
    color: #ccc;
  }
}

@media (max-width: 768px) {
  .profile-header {
    flex-direction: column;
    text-align: center;
  }
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
