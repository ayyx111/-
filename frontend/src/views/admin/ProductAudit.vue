<script setup>
// 商品审核:待审核列表 + 通过/拒绝 + AI 审核参考
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import adminApi from '@/api/admin'
import { formatPrice, formatTime, resolveImageUrl, getMapLabel, CONDITION_MAP } from '@/utils/format'

const loading = ref(false)
const list = ref([])
const pagination = ref({ page: 1, pageSize: 10, total: 0, totalPages: 0 })

// AI 审核结果映射(0通过 1可疑 2违规)
const AI_REVIEW_MAP = {
  0: { type: 'success', label: 'AI:通过' },
  1: { type: 'warning', label: 'AI:可疑' },
  2: { type: 'danger', label: 'AI:违规' }
}

async function loadData() {
  loading.value = true
  try {
    const res = await adminApi.getPendingProducts({
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

function changePage(p) {
  pagination.value.page = p
  loadData()
}

async function handleReview(item, action) {
  try {
    let reason = ''
    if (action === 'reject') {
      const { value } = await ElMessageBox.prompt('请输入拒绝原因', '拒绝审核', {
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      })
      reason = value
    } else {
      await ElMessageBox.confirm('确认通过该商品审核?', '提示', { type: 'info' })
    }
    await adminApi.reviewProduct(item.id, { action, reason })
    ElMessage.success(action === 'approve' ? '已通过' : '已拒绝')
    loadData()
  } catch (e) {}
}

// 重新触发 AI 审核
async function handleAiReReview(item) {
  try {
    await ElMessageBox.confirm(`确认对商品「${item.title}」重新进行 AI 审核?`, 'AI 重审', { type: 'info' })
    const res = await adminApi.reReviewByAi(item.id)
    ElMessage.success(res.message || 'AI 重审完成')
    loadData()
  } catch (e) {}
}

onMounted(loadData)
</script>

<template>
  <div class="admin-page">
    <h2 class="page-title">商品审核</h2>
    <div v-loading="loading" class="list-wrap">
      <div v-if="list.length" class="audit-list">
        <div v-for="item in list" :key="item.id" class="audit-item card">
          <el-image :src="resolveImageUrl(item.coverImage)" fit="cover" class="a-img" />
          <div class="a-info">
            <div class="a-title-row">
              <h3 class="a-title">{{ item.title }}</h3>
              <el-tag
                v-if="item.aiReviewResult !== null && item.aiReviewResult !== undefined"
                size="small"
                :type="AI_REVIEW_MAP[item.aiReviewResult]?.type"
                class="ai-tag"
              >
                {{ AI_REVIEW_MAP[item.aiReviewResult]?.label }}
              </el-tag>
            </div>
            <div class="a-meta">
              <span class="price">{{ formatPrice(item.price) }}</span>
              <el-tag size="small" :type="getMapLabel(CONDITION_MAP, item.conditionLevel).color">
                {{ getMapLabel(CONDITION_MAP, item.conditionLevel).label }}
              </el-tag>
              <span>分类:{{ item.category?.name || '-' }}</span>
            </div>
            <div class="a-desc text-ellipsis-2">{{ item.description }}</div>
            <div v-if="item.aiReviewReason" class="ai-reason">
              <el-icon><WarningFilled /></el-icon>
              <span>AI 提示:{{ item.aiReviewReason }}</span>
            </div>
            <div class="a-bottom">
              <span>发布者:{{ item.user?.nickname }}</span>
              <span>{{ item.user?.school }}</span>
              <span>{{ formatTime(item.createdAt) }}</span>
            </div>
          </div>
          <div class="a-actions">
            <el-button type="primary" size="small" @click="handleReview(item, 'approve')">通过</el-button>
            <el-button type="danger" size="small" plain @click="handleReview(item, 'reject')">拒绝</el-button>
            <el-button size="small" plain @click="handleAiReReview(item)">AI 重审</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else-if="!loading" description="暂无待审核商品" />
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
</template>

<style lang="scss" scoped>
.page-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 20px;
}
.list-wrap {
  min-height: 200px;
}
.audit-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  margin-bottom: 14px;
}
.a-img {
  width: 110px;
  height: 110px;
  border-radius: 8px;
  flex-shrink: 0;
}
.a-info {
  flex: 1;
  min-width: 0;
}
.a-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
}
.a-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.ai-tag {
  flex-shrink: 0;
}
.ai-reason {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0;
  padding: 6px 10px;
  background: #fff7e6;
  border-left: 3px solid #faad14;
  border-radius: 4px;
  font-size: 12px;
  color: #d46b08;
}
.a-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  .price {
    color: #ff4d4f;
    font-weight: 600;
  }
}
.a-desc {
  font-size: 13px;
  color: var(--text-regular);
  margin-bottom: 8px;
  line-height: 1.5;
}
.a-bottom {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}
.a-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}
.pagination {
  margin-top: 20px;
  text-align: center;
}
@media (max-width: 768px) {
  .audit-item {
    flex-wrap: wrap;
  }
  .a-actions {
    flex-direction: row;
  }
}
</style>
