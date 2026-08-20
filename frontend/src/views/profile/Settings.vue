<script setup>
// 设置页:编辑个人资料 + 修改密码
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import userApi from '@/api/user'
import authApi from '@/api/auth'
import { useUserStore } from '@/stores/user'
import { useMessageStore } from '@/stores/message'
import { useRouter } from 'vue-router'
import { resolveImageUrl } from '@/utils/format'

const router = useRouter()
const userStore = useUserStore()
const messageStore = useMessageStore()
const { userInfo } = storeToRefs(userStore)

const activeTab = ref('profile')
const profileLoading = ref(false)
const avatarUploading = ref(false)
const pwdLoading = ref(false)
const emailLoading = ref(false)
const codeLoading = ref(false)
const codeDisabled = ref(false)
const countdown = ref(0)

const profileForm = reactive({
  nickname: '',
  bio: '',
  avatar: ''
})
const avatarUrl = ref('')

const emailForm = reactive({
  newEmail: '',
  code: ''
})
const emailFormRef = ref()

const emailRules = {
  newEmail: [
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' },
    { required: true, message: '请输入新邮箱', trigger: 'blur' }
  ],
  code: [{ required: true, message: '请输入验证码', trigger: 'blur' }]
}

const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const pwdRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, max: 20, message: '密码 8-20 位,含字母和数字', trigger: 'blur' },
    {
      validator: (rule, value, cb) => {
        if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) cb(new Error('密码需同时包含字母和数字'))
        else cb()
      },
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule, value, cb) => {
        if (value !== pwdForm.newPassword) cb(new Error('两次密码不一致'))
        else cb()
      },
      trigger: 'blur'
    }
  ]
}

const profileFormRef = ref()
const pwdFormRef = ref()

async function handleAvatarChange(file) {
  avatarUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file.raw)
    const res = await userApi.uploadImage(formData)
    profileForm.avatar = res.url
    avatarUrl.value = res.url
    ElMessage.success('头像上传成功')
  } catch (e) {
    ElMessage.error('头像上传失败')
  } finally {
    avatarUploading.value = false
  }
}

function beforeAvatarUpload(file) {
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isImage) {
    ElMessage.error('仅支持 jpg/png/webp')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片不能超过5MB')
    return false
  }
  return false
}

async function saveProfile() {
  await profileFormRef.value.validate(async (valid) => {
    if (!valid) return
    profileLoading.value = true
    try {
      const data = {
        nickname: profileForm.nickname,
        bio: profileForm.bio
      }
      if (profileForm.avatar) {
        data.avatar = profileForm.avatar
      }
      const res = await userApi.updateProfile(data)
      userStore.setUserInfo(res)
      ElMessage.success('资料已更新')
    } catch (e) {
      // ignore
    } finally {
      profileLoading.value = false
    }
  })
}

async function changePassword() {
  await pwdFormRef.value.validate(async (valid) => {
    if (!valid) return
    pwdLoading.value = true
    try {
      await userApi.updatePassword({
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword
      })
      ElMessage.success('密码修改成功,请重新登录')
      await userStore.logout()
      messageStore.reset()
      router.push('/login')
    } catch (e) {
      // ignore
    } finally {
      pwdLoading.value = false
    }
  })
}

async function sendEmailCode() {
  if (!emailForm.newEmail) {
    ElMessage.warning('请先填写新邮箱')
    return
  }
  codeLoading.value = true
  try {
    const data = await authApi.sendCode({ target: emailForm.newEmail, type: 'register' })
    if (data?.code) {
      ElMessage({ message: `验证码: ${data.code}（开发模式,未配置SMTP）`, type: 'success', duration: 5000 })
    } else {
      ElMessage.success('验证码已发送至邮箱,请查收')
    }
    startCountdown()
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || '获取验证码失败'
    ElMessage.error(msg)
  } finally {
    codeLoading.value = false
  }
}

function startCountdown() {
  countdown.value = 60
  codeDisabled.value = true
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      codeDisabled.value = false
    }
  }, 1000)
}

async function changeEmail() {
  await emailFormRef.value.validate(async (valid) => {
    if (!valid) return
    emailLoading.value = true
    try {
      const res = await userApi.changeEmail({
        newEmail: emailForm.newEmail,
        code: emailForm.code
      })
      userStore.setUserInfo(res)
      ElMessage.success('邮箱修改成功')
      emailForm.newEmail = ''
      emailForm.code = ''
      emailFormRef.value?.resetFields?.()
    } catch (e) {
      // error message handled by interceptor
    } finally {
      emailLoading.value = false
    }
  })
}

async function handleLogout() {
  await userStore.logout()
  messageStore.reset()
  router.push('/')
}

onMounted(async () => {
  if (!userInfo.value) {
    try {
      await userStore.getUserInfo()
    } catch (e) {}
  }
  profileForm.nickname = userInfo.value?.nickname || ''
  profileForm.bio = userInfo.value?.bio || ''
  avatarUrl.value = resolveImageUrl(userInfo.value?.avatar)
})
</script>

<template>
  <div class="page-wrapper">
    <div class="container">
      <h2 class="page-title">设置</h2>

      <div class="settings-card card">
        <el-tabs v-model="activeTab" tab-position="left">
          <!-- 个人资料 -->
          <el-tab-pane label="个人资料" name="profile">
            <el-form ref="profileFormRef" :model="profileForm" label-width="80px" size="large">
              <el-form-item label="头像">
                <el-upload
                  :auto-upload="false"
                  :show-file-list="false"
                  :before-upload="beforeAvatarUpload"
                  :on-change="handleAvatarChange"
                  accept="image/jpeg,image/png,image/webp"
                >
                  <el-avatar :size="80" :src="avatarUrl">
                    {{ profileForm.nickname?.[0] || 'U' }}
                  </el-avatar>
                  <div class="avatar-tip">{{ avatarUploading ? '上传中...' : '点击修改头像' }}</div>
                </el-upload>
              </el-form-item>
              <el-form-item label="昵称" prop="nickname">
                <el-input v-model="profileForm.nickname" placeholder="请输入昵称" maxlength="20" show-word-limit />
              </el-form-item>
              <el-form-item label="个性签名">
                <el-input v-model="profileForm.bio" type="textarea" :rows="3" placeholder="介绍一下自己吧" maxlength="100" show-word-limit />
              </el-form-item>
              <el-form-item label="学校">
                <el-input :model-value="userInfo?.school || '未填写'" disabled />
              </el-form-item>
              <el-form-item label="学号">
                <el-input :model-value="userInfo?.studentId || '未填写'" disabled />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="profileLoading" @click="saveProfile">保存</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- 修改密码 -->
          <el-tab-pane label="修改密码" name="password">
            <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="100px" size="large" style="max-width: 460px">
              <el-form-item label="旧密码" prop="oldPassword">
                <el-input v-model="pwdForm.oldPassword" type="password" show-password />
              </el-form-item>
              <el-form-item label="新密码" prop="newPassword">
                <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="8-20位,含字母和数字" />
              </el-form-item>
              <el-form-item label="确认新密码" prop="confirmPassword">
                <el-input v-model="pwdForm.confirmPassword" type="password" show-password />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="pwdLoading" @click="changePassword">修改密码</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- 账号操作 -->
          <el-tab-pane label="账号" name="account">
            <div class="account-actions">
              <el-form :model="{}" label-width="80px" size="large" style="max-width: 460px; margin-bottom: 20px">
                <el-form-item label="当前邮箱">
                  <el-input :model-value="userInfo?.email || '未绑定'" disabled />
                </el-form-item>
              </el-form>
              <el-divider />
              <div class="section-title">修改邮箱</div>
              <el-form ref="emailFormRef" :model="emailForm" :rules="emailRules" label-width="80px" size="large" style="max-width: 460px; margin-top: 12px">
                <el-form-item label="新邮箱" prop="newEmail">
                  <el-input v-model="emailForm.newEmail" placeholder="请输入新邮箱" />
                </el-form-item>
                <el-form-item label="验证码" prop="code">
                  <div class="code-row">
                    <el-input v-model="emailForm.code" placeholder="请输入验证码" />
                    <el-button
                      type="primary"
                      plain
                      :loading="codeLoading"
                      :disabled="codeDisabled"
                      @click="sendEmailCode"
                    >
                      {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
                    </el-button>
                  </div>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" :loading="emailLoading" @click="changeEmail">确认修改</el-button>
                </el-form-item>
              </el-form>
              <el-divider />
              <el-button @click="handleLogout">退出登录</el-button>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 20px;
}
.settings-card {
  padding: 24px;
}
.avatar-tip {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
}
.account-actions {
  padding: 20px 0;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}
.code-row {
  display: flex;
  gap: 10px;
  width: 100%;
  .el-input {
    flex: 1;
  }
}
:deep(.el-tabs__content) {
  padding-left: 30px;
}
@media (max-width: 768px) {
  :deep(.el-tabs) {
    .el-tabs__nav {
      width: 100%;
    }
    .el-tabs__content {
      padding-left: 0;
    }
  }
}
</style>
