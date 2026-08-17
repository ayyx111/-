<script setup>
// 商品卡片组件
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatPrice, formatRelativeTime, resolveImageUrl, getMapLabel, CONDITION_MAP } from '@/utils/format'

const props = defineProps({
  product: {
    type: Object,
    required: true
  }
})

const router = useRouter()

// 兼容后端两种返回:coverImage 字符串 | images 数组(对象 {image_url} | 字符串)
const cover = computed(() => {
  const p = props.product
  if (p.coverImage) return resolveImageUrl(p.coverImage)
  const first = p.images?.[0]
  // images 元素可能是对象 {image_url} 或字符串 URL,resolveImageUrl 内部会做兼容
  return resolveImageUrl(first)
})
const condition = computed(() => getMapLabel(CONDITION_MAP, props.product.conditionLevel))

function goDetail() {
  router.push({ name: 'ProductDetail', params: { id: props.product.id } })
}
</script>

<template>
  <div class="product-card" @click="goDetail">
    <div class="card-image">
      <el-image :src="cover" fit="cover" lazy>
        <template #error>
          <div class="img-fallback">
            <el-icon :size="40"><Picture /></el-icon>
          </div>
        </template>
        <template #placeholder>
          <div class="img-loading"><el-icon class="is-loading"><Loading /></el-icon></div>
        </template>
      </el-image>
      <el-tag v-if="condition.label" :type="condition.color" size="small" class="condition-tag">
        {{ condition.label }}
      </el-tag>
    </div>
    <div class="card-body">
      <h3 class="card-title text-ellipsis-2">{{ product.title }}</h3>
      <div class="card-price">
        <span class="price">{{ formatPrice(product.price) }}</span>
        <span v-if="product.originalPrice" class="original-price">
          ¥{{ formatPrice(product.originalPrice) }}
        </span>
      </div>
      <div class="card-meta">
        <span class="school text-ellipsis" v-if="product.user?.school || product.school">
          <el-icon><Location /></el-icon>
          {{ product.user?.school || product.school }}
        </span>
        <span class="time">{{ formatRelativeTime(product.createdAt) }}</span>
      </div>
      <div class="card-footer">
        <div class="seller">
          <el-avatar :size="20" :src="resolveImageUrl(product.user?.avatar)">
            {{ product.user?.nickname?.[0] }}
          </el-avatar>
          <span class="seller-name text-ellipsis">{{ product.user?.nickname }}</span>
        </div>
        <span class="view-count">
          <el-icon><View /></el-icon>{{ product.viewCount || 0 }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.product-card {
  background: #fff;
  border-radius: var(--radius-base);
  overflow: hidden;
  box-shadow: var(--card-shadow);
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--card-shadow-hover);
    .card-title {
      color: var(--primary-color);
    }
  }
}
.card-image {
  position: relative;
  width: 100%;
  padding-top: 100%;
  overflow: hidden;
  background: var(--bg-color);
  .el-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .img-fallback,
  .img-loading {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    background: var(--bg-color);
  }
  .condition-tag {
    position: absolute;
    top: 8px;
    left: 8px;
  }
}
.card-body {
  padding: 12px;
}
.card-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  height: 39px;
  margin-bottom: 8px;
  color: var(--text-primary);
  transition: color 0.3s;
}
.card-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
  .price {
    font-size: 18px;
  }
}
.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  .school {
    display: flex;
    align-items: center;
    gap: 2px;
    max-width: 60%;
  }
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}
.seller {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  .seller-name {
    font-size: 12px;
    color: var(--text-regular);
    max-width: 90px;
  }
}
.view-count {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
