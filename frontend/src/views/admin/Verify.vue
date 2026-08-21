<script setup>
// 校园认证管理:查看用户认证状态(首次认证直接通过,学校修改需审核)
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import adminApi from '@/api/admin'
import { formatTime, resolveImageUrl } from '@/utils/format'

const loading = ref(false)
const list = ref([])
const pagination = ref({ page: 1, pageSize: 10, total: 0, totalPages: 0 })
const searchKeyword = ref('')
// 0未认证 1已通过 2待审核(默认) 3未通过
const filterStatus = ref(2)
const statusOptions = [
  { label: '待审核', value: 2 },
  { label: '未提交', value: 0 },
  { label: '已通过', value: 1 },
  { label: '未通过', value: 3 },
]

async function loadData() {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      verifyStatus: filterStatus.value,
    }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    const res = await adminApi.getVerifications(params)
    list.value = res.list || []
    pagination.value = res.pagination || pagination.value
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function changePage(p) { pagination.value.page = p; loadData() }
function handleSearch() { pagination.value.page = 1; loadData() }
function handleFilterChange() { pagination.value.page = 1; loadData() }

function verifyTag(v) {
  switch (Number(v)) {
    case 1: return { type: 'success', text: '已通过' }
    case 2: return { type: 'warning', text: '待审核' }
    case 3: return { type: 'danger', text: '未通过' }
    default: return { type: 'info', text: '未提交' }
  }
}

async function handleReview(user, action) {
  try {
    const reason = action === 'reject'
      ? (await ElMessageBox.prompt('请输入驳回原因', '驳回校园认证', {
          confirmButtonText: '确认驳回',
          cancelButtonText: '取消',
          inputPlaceholder: '如:学生证照片模糊',
          type: 'warning',
        })).value
      : ''
    await adminApi.reviewVerification(user.id, { action, reason })
    ElMessage.success(action === 'pass' ? '已通过认证' : '已驳回认证')
    loadData()
  } catch (e) {
    if (e !== 'cancel' && e !== undefined && !String(e?.message || '').includes('cancel')) {
      // ignore cancel
    }
  }
}

onMounted(loadData)
</script>

<template>
  <div class="admin-page">
    <div class="head">
      <h2 class="page-title">校园认证管理</h2>
      <p class="page-desc">首次认证直接通过,如需修改学校信息请前往「学校修改审核」处理</p>
      <div class="filters">
        <el-select v-model="filterStatus" style="width: 150px" @change="handleFilterChange">
          <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-input
          v-model="searchKeyword"
          style="width: 260px"
          placeholder="搜索 用户名/昵称/学号/学校/学院"
          clearable
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #append>
            <el-button @click="handleSearch">搜索</el-button>
          </template>
        </el-input>
      </div>
    </div>

    <el-table :data="list" v-loading="loading" stripe border style="width: 100%">
      <el-table-column label="用户" min-width="180">
        <template #default="{ row }">
          <div class="user-cell">
            <el-avatar :size="36" :src="resolveImageUrl(row.avatar)">
              {{ (row.nickname || row.username || '?')[0] }}
            </el-avatar>
            <div style="margin-left: 10px">
              <div class="uname">{{ row.nickname || row.username }}</div>
              <div class="meta">@{{ row.username }} · ID {{ row.id }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="学校信息" min-width="280">
        <template #default="{ row }">
          <div class="v-row">学校: {{ row.school || '—' }}</div>
          <div class="v-row">学院: {{ row.college || '—' }}</div>
          <div class="v-row">入学年份: {{ row.enrollmentYear || '—' }}　学号: {{ row.studentId || '—' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="学生证照片" width="140" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.campusProof"
            :src="resolveImageUrl(row.campusProof)"
            :preview-src-list="[resolveImageUrl(row.campusProof)]"
            fit="cover"
            style="width: 64px; height: 64px; border-radius: 4px; border: 1px solid #eee"
          />
          <span v-else style="color: #909399">未上传</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="verifyTag(row.isVerified).type" size="small">
            {{ verifyTag(row.isVerified).text }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="提交时间" width="180" align="center">
        <template #default="{ row }">
          {{ formatTime(row.updatedAt || row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.isVerified === 2"
            size="small"
            type="success"
            @click="handleReview(row, 'pass')"
          >通过</el-button>
          <el-button
            v-if="row.isVerified === 2"
            size="small"
            type="danger"
            @click="handleReview(row, 'reject')"
          >驳回</el-button>
          <span v-else style="color: #909399; font-size: 12px">—</span>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="pagination.total > pagination.pageSize" class="pagination">
      <el-pagination
        background
        layout="prev, pager, next, total"
        :total="pagination.total"
        :page-size="pagination.pageSize"
        :current-page="pagination.page"
        @current-change="changePage"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.admin-page { padding: 20px 24px; }
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.page-title { margin: 0; font-size: 20px; }
.page-desc { margin: 6px 0 16px; font-size: 13px; color: var(--el-color-info); }
.filters { display: flex; gap: 10px; align-items: center; }
.user-cell { display: flex; align-items: center; }
.uname { font-weight: 600; font-size: 14px; }
.meta { color: #909399; font-size: 12px; margin-top: 2px; }
.v-row { font-size: 13px; line-height: 1.8; color: #303133; }
.pagination { margin-top: 20px; text-align: right; }
</style>
