<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import adminApi from '@/api/admin'

const loading = ref(false)
const requests = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const filterStatus = ref('')
const keyword = ref('')

async function loadRequests() {
  loading.value = true
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value
    }
    if (filterStatus.value !== '') {
      params.status = filterStatus.value
    }
    if (keyword.value) {
      params.keyword = keyword.value
    }
    const res = await adminApi.getSchoolChangeRequests(params)
    requests.value = res.rows || res.data?.rows || []
    total.value = res.count || res.data?.count || 0
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function handleReview(row, action) {
  const actionText = action === 'approve' ? '通过' : '拒绝'
  try {
    const { value } = await ElMessageBox.prompt(
      `确定要${actionText}该修改申请吗？${action === 'reject' ? '\n请输入拒绝原因:' : ''}`,
      '审核确认',
      {
        confirmButtonText: `确认${actionText}`,
        cancelButtonText: '取消',
        inputPattern: action === 'reject' ? /.+/ : null,
        inputErrorMessage: '请输入拒绝原因',
        inputPlaceholder: action === 'reject' ? '请输入拒绝原因' : undefined
      }
    )
    await adminApi.reviewSchoolChangeRequest(row.id, {
      action,
      reviewNote: value || ''
    })
    ElMessage.success(`已${actionText}`)
    await loadRequests()
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e)
    }
  }
}

function statusTag(status) {
  const map = {
    0: { text: '待审核', type: 'warning' },
    1: { text: '已通过', type: 'success' },
    2: { text: '已拒绝', type: 'danger' }
  }
  return map[status] || { text: '未知', type: 'info' }
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

function handleSearch() {
  page.value = 1
  loadRequests()
}

function handleReset() {
  filterStatus.value = ''
  keyword.value = ''
  page.value = 1
  loadRequests()
}

onMounted(() => {
  loadRequests()
})
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>学校修改审核</h2>
      <div class="filter-bar">
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width: 120px" @change="handleSearch">
          <el-option label="待审核" :value="0" />
          <el-option label="已通过" :value="1" />
          <el-option label="已拒绝" :value="2" />
        </el-select>
        <el-input 
          v-model="keyword" 
          placeholder="搜索学校/学院" 
          clearable 
          style="width: 200px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </div>

    <div class="table-container">
      <el-table :data="requests" v-loading="loading" stripe>
        <el-table-column prop="user.username" label="申请人" width="120">
          <template #default="{ row }">
            {{ row.user?.nickname || row.user?.username || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="修改内容" min-width="200">
          <template #default="{ row }">
            <div class="change-content">
              <div v-if="row.old_school" class="old-value">
                {{ row.old_school }}<span v-if="row.old_college"> · {{ row.old_college }}</span>
              </div>
              <el-icon class="arrow-icon"><ArrowRight /></el-icon>
              <div class="new-value">
                <strong>{{ row.new_school }}</strong><span v-if="row.new_college"> · {{ row.new_college }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="修改原因" min-width="150" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status).type" size="small">
              {{ statusTag(row.status).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="审核信息" width="180">
          <template #default="{ row }">
            <div v-if="row.status !== 0">
              <div v-if="row.review_note" class="review-note">{{ row.review_note }}</div>
              <div class="review-time">{{ formatDate(row.reviewed_at) }}</div>
            </div>
            <span v-else class="pending-text">待审核</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="row.status === 0" 
              type="success" 
              size="small" 
              @click="handleReview(row, 'approve')"
            >
              通过
            </el-button>
            <el-button 
              v-if="row.status === 0" 
              type="danger" 
              size="small" 
              @click="handleReview(row, 'reject')"
            >
              拒绝
            </el-button>
            <span v-else class="action-disabled">-</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container" v-if="total > 0">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadRequests"
          @current-change="loadRequests"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.admin-page {
  padding: 20px;
}
.page-header {
  margin-bottom: 20px;
  h2 {
    margin: 0 0 16px;
    font-size: 20px;
  }
}
.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
}
.table-container {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}
.change-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  .old-value {
    color: var(--text-secondary);
  }
  .new-value {
    color: var(--primary-color);
  }
  .arrow-icon {
    color: var(--text-secondary);
  }
}
.review-note {
  color: var(--text-secondary);
  font-size: 12px;
  margin-bottom: 4px;
}
.review-time {
  color: var(--text-secondary);
  font-size: 12px;
}
.pending-text {
  color: var(--warning-color);
}
.action-disabled {
  color: var(--text-placeholder);
}
.pagination-container {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
