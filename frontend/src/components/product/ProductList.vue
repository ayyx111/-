<script setup>
// 商品列表组件:网格展示 + 加载状态
import ProductCard from './ProductCard.vue'

defineProps({
  list: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  emptyText: {
    type: String,
    default: '暂无商品'
  }
})
</script>

<template>
  <div class="product-list" v-loading="loading">
    <div v-if="list.length" class="grid">
      <ProductCard v-for="item in list" :key="item.id" :product="item" />
    </div>
    <el-empty v-else-if="!loading" :description="emptyText" />
  </div>
</template>

<style lang="scss" scoped>
.product-list {
  min-height: 200px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
@media (max-width: 992px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
}
</style>
