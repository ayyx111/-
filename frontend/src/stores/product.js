import { defineStore } from 'pinia'
import { ref } from 'vue'
import productApi from '@/api/product'
import favoriteApi from '@/api/favorite'

// 商品状态管理(分类缓存等)
export const useProductStore = defineStore('product', () => {
  const categories = ref([])
  const loaded = ref(false)

  /**
   * 获取分类列表(带缓存)
   */
  async function fetchCategories(force = false) {
    if (loaded.value && !force) return categories.value
    try {
      const res = await productApi.getCategories()
      categories.value = res || []
      loaded.value = true
    } catch (e) {
      categories.value = []
    }
    return categories.value
  }

  /**
   * 收藏/取消收藏切换
   */
  async function toggleFavorite(productId, isFavorited) {
    if (isFavorited) {
      await favoriteApi.remove(productId)
      return false
    } else {
      await favoriteApi.add(productId)
      return true
    }
  }

  return {
    categories,
    loaded,
    fetchCategories,
    toggleFavorite
  }
})
