<script setup>
// 设置页:编辑个人资料 + 修改密码
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
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
const { userInfo, isVerified: storeIsVerified, verifyStatus } = storeToRefs(userStore)

const activeTab = ref('profile')
const profileLoading = ref(false)
const avatarUploading = ref(false)
const pwdLoading = ref(false)
const emailLoading = ref(false)
const codeLoading = ref(false)
const codeDisabled = ref(false)
const countdown = ref(0)

// 学校修改申请相关
const showSchoolChangeDialog = ref(false)
const schoolChangeLoading = ref(false)
const pendingRequest = ref(null)
const schoolChangeForm = reactive({
  newSchool: '',
  newCollege: '',
  reason: ''
})

// 判断是否已完成认证(状态为1或2都算已提交认证)
const isVerified = computed(() => storeIsVerified.value)
// 判断是否是已通过认证(状态为1)
const isVerifiedPassed = computed(() => verifyStatus.value === 1)
const schoolStatusTag = computed(() => {
  if (pendingRequest.value?.status === 0) return { text: '审核中', type: 'warning' }
  if (verifyStatus.value === 0) return { text: '未认证', type: 'info' }
  if (verifyStatus.value === 2) return { text: '认证审核中', type: 'warning' }
  if (verifyStatus.value === 3) return { text: '认证未通过', type: 'danger' }
  return { text: '已认证', type: 'success' }
})

const profileForm = reactive({
  nickname: '',
  bio: '',
  avatar: '',
  school: '',
  college: ''
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

async function loadPendingRequest() {
  try {
    const res = await userApi.checkPendingSchoolChange()
    pendingRequest.value = res.hasPending ? res.request : null
  } catch (e) {
    pendingRequest.value = null
  }
}

function goToVerify() {
  router.push('/profile/verify')
}

function openSchoolChangeDialog() {
  schoolChangeForm.newSchool = userInfo.value?.school || ''
  schoolChangeForm.newCollege = userInfo.value?.college || ''
  schoolChangeForm.reason = ''
  showSchoolChangeDialog.value = true
}

async function submitSchoolChange() {
  if (!schoolChangeForm.newSchool.trim()) {
    ElMessage.warning('请输入新学校名称')
    return
  }
  if (schoolChangeForm.newSchool === userInfo.value?.school && 
      schoolChangeForm.newCollege === userInfo.value?.college) {
    ElMessage.warning('新信息与当前信息相同')
    return
  }
  schoolChangeLoading.value = true
  try {
    await userApi.submitSchoolChange({
      newSchool: schoolChangeForm.newSchool.trim(),
      newCollege: schoolChangeForm.newCollege.trim() || null,
      reason: schoolChangeForm.reason.trim()
    })
    ElMessage.success('申请已提交,等待管理员审核')
    showSchoolChangeDialog.value = false
    await loadPendingRequest()
  } catch (e) {
    // error handled by interceptor
  } finally {
    schoolChangeLoading.value = false
  }
}

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
  const oldEmail = userInfo.value?.email
  if (!oldEmail) {
    ElMessage.error('当前账号未绑定邮箱')
    return
  }
  codeLoading.value = true
  try {
    const data = await authApi.sendCode({ target: oldEmail, type: 'change-email' })
    if (data?.code) {
      ElMessage({ message: `验证码: ${data.code}（开发模式,未配置SMTP）`, type: 'success', duration: 5000 })
    } else {
      ElMessage.success(`验证码已发送至旧邮箱 ${oldEmail},请查收`)
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
  profileForm.school = userInfo.value?.school || ''
  profileForm.college = userInfo.value?.college || ''
  avatarUrl.value = resolveImageUrl(userInfo.value?.avatar)
  await loadPendingRequest()
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
              <el-form-item label="学校认证">
                <div class="school-auth-section">
                  <div class="school-info-row">
                    <span class="school-value">
                      {{ userInfo?.school || '未认证' }}
                      <span v-if="userInfo?.college" class="college-sep">·</span>
                      <span v-if="userInfo?.college">{{ userInfo.college }}</span>
                    </span>
                    <el-tag :type="schoolStatusTag.type" size="small" effect="light">
                      {{ schoolStatusTag.text }}
                    </el-tag>
                  </div>
                  
                  <!-- 未认证状态(需要完成认证) -->
                  <div v-if="verifyStatus === 0" class="school-action-row">
                    <el-button type="primary" size="small" @click="goToVerify">
                      完成学校认证
                    </el-button>
                    <span class="action-tip">完成认证后可发布商品、进行交易</span>
                  </div>

                  <!-- 认证未通过状态(需要重新提交) -->
                  <div v-else-if="verifyStatus === 3" class="school-action-row">
                    <el-button type="primary" size="small" @click="goToVerify">
                      重新提交认证
                    </el-button>
                    <span class="action-tip">您的认证未通过,请修改后重新提交</span>
                  </div>
                  
                  <!-- 已认证状态(可申请修改) -->
                  <div v-else-if="verifyStatus === 1 && !pendingRequest" class="school-action-row">
                    <el-button type="primary" size="small" plain @click="openSchoolChangeDialog">
                      申请修改学校
                    </el-button>
                    <span class="action-tip">如需修改学校/学院,请提交申请给管理员审核</span>
                  </div>
                  
                  <!-- 审核中状态 -->
                  <div v-else-if="pendingRequest?.status === 0" class="school-pending-row">
                    <el-alert
                      title="您的修改申请正在审核中"
                      :description="`申请时间: ${new Date(pendingRequest.created_at).toLocaleString()}`"
                      type="warning"
                      show-icon
                      :closable="false"
                    />
                  </div>
                  
                  <!-- 历史记录(已审核) -->
                  <div v-else-if="pendingRequest && pendingRequest.status !== 0" class="school-pending-row">
                    <el-alert
                      :title="pendingRequest.status === 1 ? '修改申请已通过' : '修改申请已拒绝'"
                      :description="pendingRequest.review_note || ''"
                      :type="pendingRequest.status === 1 ? 'success' : 'error'"
                      show-icon
                      :closable="false"
                    />
                    <el-button 
                      v-if="pendingRequest.status === 2 && verifyStatus === 1" 
                      type="primary" 
                      size="small" 
                      plain
                      @click="openSchoolChangeDialog"
                      style="margin-top: 8px"
                    >
                      重新提交申请
                    </el-button>
                  </div>
                </div>
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
              <div class="email-tip">为保障账号安全,需先通过旧邮箱验证身份</div>
              <el-form ref="emailFormRef" :model="emailForm" :rules="emailRules" label-width="80px" size="large" style="max-width: 460px; margin-top: 12px">
                <el-form-item label="旧邮箱">
                  <el-input :model-value="userInfo?.email || '未绑定'" disabled />
                </el-form-item>
                <el-form-item label="验证码" prop="code">
                  <div class="code-row">
                    <el-input v-model="emailForm.code" placeholder="请输入旧邮箱收到的验证码" />
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
                <el-form-item label="新邮箱" prop="newEmail">
                  <el-input v-model="emailForm.newEmail" placeholder="请输入新邮箱地址" />
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

  <!-- 学校修改申请对话框 -->
  <el-dialog
    v-model="showSchoolChangeDialog"
    title="申请修改学校信息"
    width="480px"
    :close-on-click-modal="false"
  >
    <div class="dialog-tip">
      <el-icon><InfoFilled /></el-icon>
      <span>学校信息需经管理员审核后方可修改,请填写真实信息</span>
    </div>
    <el-form :model="schoolChangeForm" label-width="80px" size="default">
      <el-form-item label="当前学校">
        <el-input :model-value="userInfo?.school || '未设置'" disabled />
      </el-form-item>
      <el-form-item label="新学校" required>
        <el-input v-model="schoolChangeForm.newSchool" placeholder="请输入新学校全称" />
      </el-form-item>
      <el-form-item label="新学院">
        <el-input v-model="schoolChangeForm.newCollege" placeholder="请输入新学院(可选)" />
      </el-form-item>
      <el-form-item label="修改原因">
        <el-input 
          v-model="schoolChangeForm.reason" 
          type="textarea" 
          :rows="3" 
          placeholder="请简要说明修改原因(可选)" 
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showSchoolChangeDialog = false">取消</el-button>
      <el-button type="primary" :loading="schoolChangeLoading" @click="submitSchoolChange">
        提交申请
      </el-button>
    </template>
  </el-dialog>
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
.email-tip {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
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

.school-auth-section {
  .school-info-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    
    .school-value {
      font-size: 15px;
      font-weight: 500;
      color: var(--text-primary);
    }
    
    .college-sep {
      color: var(--text-secondary);
    }
  }
  
  .school-action-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-light);
    border-radius: var(--radius-md);
    
    .action-tip {
      font-size: 13px;
      color: var(--text-secondary);
    }
  }
  
  .school-pending-row {
    margin-top: 8px;
  }
}

.dialog-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--primary-light);
  border-radius: var(--radius-md);
  margin-bottom: 20px;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
