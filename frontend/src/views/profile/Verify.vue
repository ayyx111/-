<script setup>
// 校园认证页:填写学校/学院/入学年份即可提交,学生证照片可选
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import authApi from '@/api/auth'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const { userInfo, verifyStatus, verifyStatusText } = storeToRefs(userStore)

const formRef = ref()
const loading = ref(false)
const fileList = ref([])

// 0=未认证 1=已通过 2=待审核 3=未通过
const showForm = computed(() => verifyStatus.value === 0 || verifyStatus.value === 3)
const showResult = computed(() => verifyStatus.value === 1)
const showPending = computed(() => verifyStatus.value === 2)

const form = reactive({
  school: '',
  college: '',
  enrollmentYear: new Date().getFullYear()
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
  // 可选字段,仅保留 UI 预览
  return file
}

function handleRemove() {
  // 可选字段
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
    form.enrollmentYear = userInfo.value.enrollmentYear || userInfo.value.enrollment_year || new Date().getFullYear()
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
          v-if="showResult"
          icon="success"
          title="已完成校园认证"
          sub-title="您已通过校园身份认证,可以发布商品和交易"
        >
          <template #extra>
            <div class="verified-info">
              <p>学校:{{ userInfo?.school }}</p>
              <p>学院:{{ userInfo?.college }}</p>
              <p>入学年份:{{ userInfo?.enrollmentYear || userInfo?.enrollment_year }}</p>
            </div>
          </template>
        </el-result>

        <!-- 待审核 -->
        <el-result
          v-else-if="showPending"
          icon="info"
          title="认证审核中"
          :sub-title="verifyStatusText"
        >
          <template #extra>
            <div class="verified-info">
              <p>学校:{{ userInfo?.school }}</p>
              <p>学院:{{ userInfo?.college }}</p>
              <p>入学年份:{{ userInfo?.enrollmentYear || userInfo?.enrollment_year }}</p>
              <p class="tip">审核期间您仍可正常发布商品和交易,完成后会收到通知</p>
            </div>
          </template>
        </el-result>

        <!-- 未通过 / 未认证:表单 -->
        <el-form
          v-else
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="100px"
          size="large"
        >
          <el-alert
            v-if="verifyStatus === 3"
            title="上次认证未通过,请根据审核意见修改后重新提交"
            type="warning"
            show-icon
            :closable="false"
            class="tips"
          />
          <el-alert
            v-else
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
  .tip {
    margin-top: 12px;
    color: var(--el-color-primary);
  }
}
</style>
