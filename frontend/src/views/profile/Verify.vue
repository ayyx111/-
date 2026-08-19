<script setup>
// 校园认证页:上传学生证 + 学校/学院/入学年份
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import authApi from '@/api/auth'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const { userInfo, isVerified } = storeToRefs(userStore)

const formRef = ref()
const loading = ref(false)
const fileList = ref([])

const form = reactive({
  school: '',
  college: '',
  enrollmentYear: new Date().getFullYear(),
  studentCardImage: null
})

const rules = {
  school: [{ required: true, message: '请输入学校名称', trigger: 'blur' }],
  college: [{ required: true, message: '请输入学院', trigger: 'blur' }],
  enrollmentYear: [{ required: true, message: '请选择入学年份', trigger: 'change' }]
}

const yearOptions = computed(() => {
  const now = new Date().getFullYear()
  const arr = []
  for (let y = now; y >= now - 6; y--) arr.push(y)
  return arr
})

function handleFileChange(file) {
  form.studentCardImage = file.raw
}

function handleRemove() {
  form.studentCardImage = null
}

function beforeUpload(file) {
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isImage) {
    ElMessage.error('仅支持 jpg/png/webp 格式')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB')
    return false
  }
  return false // 阻止自动上传,手动提交
}

async function handleSubmit() {
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const payload = {
        school: form.school,
        college: form.college,
        enrollmentYear: form.enrollmentYear
      }
      await authApi.verifyCampus(payload)
      ElMessage.success('认证已提交,等待审核')
      await userStore.getUserInfo()
    } catch (e) {
      // ignore
    } finally {
      loading.value = false
    }
  })
}

// 预填学校信息
function prefill() {
  if (userInfo.value) {
    form.school = userInfo.value.school || ''
    form.college = userInfo.value.college || ''
    form.enrollmentYear = userInfo.value.enrollmentYear || new Date().getFullYear()
  }
}
onMounted(prefill)
</script>

<template>
  <div class="page-wrapper">
    <div class="container">
      <div class="verify-card card">
        <h2 class="page-title">校园身份认证</h2>

        <!-- 已认证 -->
        <el-result
          v-if="isVerified"
          icon="success"
          title="已完成校园认证"
          sub-title="您已通过校园身份认证,可以发布商品和交易"
        >
          <template #extra>
            <div class="verified-info">
              <p>学校:{{ userInfo?.school }}</p>
              <p>学院:{{ userInfo?.college }}</p>
              <p>入学年份:{{ userInfo?.enrollmentYear }}</p>
            </div>
          </template>
        </el-result>

        <!-- 未认证:表单 -->
        <el-form
          v-else
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="100px"
          size="large"
        >
          <el-alert
            title="校园认证后才能发布商品和交易,请如实填写信息"
            type="info"
            show-icon
            :closable="false"
            class="tips"
          />

          <el-form-item label="学校" prop="school">
            <el-input v-model="form.school" placeholder="请输入学校全称" />
          </el-form-item>

          <el-form-item label="学院" prop="college">
            <el-input v-model="form.college" placeholder="请输入学院" />
          </el-form-item>

          <el-form-item label="入学年份" prop="enrollmentYear">
            <el-select v-model="form.enrollmentYear" placeholder="请选择" style="width: 100%">
              <el-option v-for="y in yearOptions" :key="y" :label="y + '年'" :value="y" />
            </el-select>
          </el-form-item>

          <el-form-item label="学生证照片">
            <el-upload
              v-model:file-list="fileList"
              :auto-upload="false"
              :before-upload="beforeUpload"
              :on-change="handleFileChange"
              :on-remove="handleRemove"
              list-type="picture-card"
              accept="image/jpeg,image/png,image/webp"
              :limit="1"
            >
              <el-icon><Plus /></el-icon>
              <template #tip>
                <div class="upload-tip">可选:上传清晰的学生证照片,可加快审核,jpg/png/webp,不超过5MB</div>
              </template>
            </el-upload>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="loading" @click="handleSubmit">提交认证</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.verify-card {
  max-width: 640px;
  margin: 0 auto;
  padding: 30px;
}
.page-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 24px;
  text-align: center;
}
.tips {
  margin-bottom: 20px;
}
.upload-tip {
  font-size: 12px;
  color: var(--text-secondary);
}
.verified-info {
  text-align: left;
  color: var(--text-regular);
  p {
    margin: 6px 0;
  }
}
</style>
