<script setup>
// 举报处理:举报列表 + 处理/驳回
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import adminApi from '@/api/admin'
import { formatTime, resolveImageUrl } from '@/utils/format'

const loading = ref(false)
const list = ref([])
const pagination = ref({ page: 1, pageSize: 10, total: 0, totalPages: 0 })

const targetTypeMap = { 1: '商品', 2: '用户' }
const statusMap = {
  0: { label: '待处理', color: 'warning' },
  1: { label: '已处理', color: 'success' },
  2: { label: '已驳回', color: 'info' }
}

async function loadData() {
  loading.value = true
  try {
    const res = await adminApi.getReports({
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

async function handleReport(item, status) {
  const action = status === 1 ? '处理' : '驳回'
  try {
    const { value } = await ElMessageBox.prompt(`请输入${action}结果`, `${action}举报`, {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPlaceholder: '处理结果说明'
    })
    await adminApi.handleReport(item.id, { status, handleResult: value })
    ElMessage.success(`已${action}`)
    loadData()
  } catch (e) {}
}

onMounted(loadData)
</script>

<template>
  <div class="admin-page">
    <h2 class="page-title">举报处理</h2>
    <div v-loading="loading" class="list-wrap">
      <div v-if="list.length" class="report-list">
        <div v-for="item in list" :key="item.id" class="report-item card">
          <div class="r-head">
            <el-tag size="small" type="primary">{{ targetTypeMap[item.targetType] }}</el-tag>
            <span class="r-target">目标ID:{{ item.targetId }}</span>
            <el-tag size="small" :type="statusMap[item.status]?.color">
              {{ statusMap[item.status]?.label }}
            </el-tag>
            <span class="r-time">{{ formatTime(item.createdAt) }}</span>
          </div>
          <div class="r-row">
            <span class="label">举报人:</span>{{ item.reporter?.nickname || `用户${item.reporterId}` }}
          </div>
          <div class="r-row">
            <span class="label">举报原因:</span><span class="reason">{{ item.reason }}</span>
          </div>
          <div v-if="item.description" class="r-row">
            <span class="label">详细描述:</span>{{ item.description }}
          </div>
          <div v-if="item.handleResult" class="r-row">
            <span class="label">处理结果:</span>{{ item.handleResult }}
          </div>
          <div v-if="item.status === 0" class="r-actions">
            <el-button type="primary" size="small" @click="handleReport(item, 1)">处理</el-button>
            <el-button size="small" plain @click="handleReport(item, 2)">驳回</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else-if="!loading" description="暂无举报" />
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
.report-item {
  padding: 16px 20px;
  margin-bottom: 14px;
}
.r-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  .r-target {
    font-size: 13px;
    color: var(--text-regular);
  }
  .r-time {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-secondary);
  }
}
.r-row {
  font-size: 14px;
  color: var(--text-regular);
  margin-bottom: 8px;
  line-height: 1.6;
  .label {
    color: var(--text-secondary);
    margin-right: 6px;
  }
  .reason {
    color: #f44336;
  }
}
.r-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}
.pagination {
  margin-top: 20px;
  text-align: center;
}
</style>
