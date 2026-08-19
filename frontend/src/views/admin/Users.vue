<script setup>
// 用户管理:用户列表 + 封禁/解封
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import adminApi from '@/api/admin'
import { formatTime, resolveImageUrl } from '@/utils/format'

const loading = ref(false)
const list = ref([])
const pagination = ref({ page: 1, pageSize: 10, total: 0, totalPages: 0 })
const searchKeyword = ref('')

async function loadData() {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    const res = await adminApi.getUsers(params)
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

function handleSearch() {
  pagination.value.page = 1
  loadData()
}

async function toggleStatus(user) {
  const action = user.status === 1 ? '封禁' : '解封'
  try {
    await ElMessageBox.confirm(`确认${action}用户「${user.nickname || user.username}」?`, '提示', {
      type: 'warning'
    })
    await adminApi.updateUserStatus(user.id, user.status === 1 ? 0 : 1)
    ElMessage.success(`已${action}`)
    loadData()
  } catch (e) {}
}

onMounted(loadData)
</script>

<template>
  <div class="admin-page">
    <div class="head">
      <h2 class="page-title">用户管理</h2>
      <el-input
        v-model="searchKeyword"
        placeholder="搜索用户名/昵称"
        clearable
        style="width: 240px"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button :icon="'Search'" @click="handleSearch" />
        </template>
      </el-input>
    </div>

    <el-table v-loading="loading" :data="list" stripe style="width: 100%">
      <el-table-column label="用户" min-width="200">
        <template #default="{ row }">
          <div class="user-cell">
            <el-avatar :size="36" :src="resolveImageUrl(row.avatar)">
              {{ row.nickname?.[0] || row.username?.[0] }}
            </el-avatar>
            <div>
              <div class="u-name">{{ row.nickname || row.username }}</div>
              <div class="u-id">ID: {{ row.id }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="学校" prop="school" min-width="140" show-overflow-tooltip />
      <el-table-column label="信用分" prop="creditScore" width="100" align="center" />
      <el-table-column label="认证" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.isVerified === 1" type="success" size="small">已通过</el-tag>
          <el-tag v-else-if="row.isVerified === 2" type="warning" size="small">待审核</el-tag>
          <el-tag v-else-if="row.isVerified === 3" type="danger" size="small">未通过</el-tag>
          <el-tag v-else type="info" size="small">未提交</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="角色" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.role === 1" type="warning" size="small">管理员</el-tag>
          <el-tag v-else size="small">普通用户</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '正常' : '封禁' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.role !== 1"
            size="small"
            :type="row.status === 1 ? 'danger' : 'success'"
            plain
            @click="toggleStatus(row)"
          >
            {{ row.status === 1 ? '封禁' : '解封' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

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
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.page-title {
  font-size: 22px;
  font-weight: 600;
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  .u-name {
    font-size: 14px;
    font-weight: 500;
  }
  .u-id {
    font-size: 12px;
    color: var(--text-secondary);
  }
}
.pagination {
  margin-top: 20px;
  text-align: center;
}
</style>
