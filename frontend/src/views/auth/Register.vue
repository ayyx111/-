<script setup>
// 注册页:用户名/密码/确认密码/邮箱/学号/验证码
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import authApi from '@/api/auth'

const router = useRouter()
const registerFormRef = ref()
const loading = ref(false)
const codeLoading = ref(false)
const codeDisabled = ref(false)
const countdown = ref(0)

const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
  studentId: '',
  code: ''
})

// 确认密码校验
const validateConfirm = (rule, value, callback) => {
  if (value !== registerForm.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名 3-20 位', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, max: 20, message: '密码 8-20 位,含字母和数字', trigger: 'blur' },
    {
      validator: (rule, value, cb) => {
        if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
          cb(new Error('密码需同时包含字母和数字'))
        } else {
          cb()
        }
      },
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  code: [{ required: true, message: '请输入验证码', trigger: 'blur' }]
}

// 发送验证码
async function sendCode() {
  console.log('[sendCode] 开始, email =', registerForm.email)
  if (!registerForm.email) {
    ElMessage.warning('请先填写邮箱')
    return
  }
  if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(registerForm.email)) {
    ElMessage.warning('请输入正确的邮箱格式')
    return
  }
  codeLoading.value = true
  try {
    const data = await authApi.sendCode({ target: registerForm.email, type: 'register' })
    if (data?.code) {
      ElMessage({ message: `验证码: ${data.code}（开发模式,未配置SMTP）`, type: 'success', duration: 5000 })
    } else {
      ElMessage({ message: '验证码已发送至邮箱,请查收', type: 'success', duration: 5000 })
    }
    startCountdown()
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || '获取验证码失败'
    ElMessage({ message: msg, type: 'error' })
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

// 注册提交
async function handleRegister() {
  await registerFormRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      await authApi.register({
        username: registerForm.username,
        password: registerForm.password,
        confirmPassword: registerForm.confirmPassword,
        email: registerForm.email,
        studentId: registerForm.studentId,
        code: registerForm.code
      })
      ElMessage.success('注册成功,请登录')
      router.push('/login')
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || '注册失败'
      ElMessage.error(msg)
    } finally {
      loading.value = false
    }
  })
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-brand" @click="router.push('/')">
        <el-icon class="brand-icon"><ShoppingBag /></el-icon>
        <span>校园咸鱼</span>
      </div>
      <div class="auth-card">
        <h1 class="auth-title">注册账号</h1>
        <p class="auth-subtitle">加入校园版咸鱼,让闲置物品流转起来</p>

        <el-form
          ref="registerFormRef"
          :model="registerForm"
          :rules="rules"
          size="large"
          label-position="top"
        >
          <el-form-item prop="username" label="用户名">
            <el-input v-model="registerForm.username" placeholder="3-20位用户名" :prefix-icon="'User'" />
          </el-form-item>
          <el-form-item prop="password" label="密码">
            <el-input
              v-model="registerForm.password"
              type="password"
              placeholder="8-20位,含字母和数字"
              :prefix-icon="'Lock'"
              show-password
            />
          </el-form-item>
          <el-form-item prop="confirmPassword" label="确认密码">
            <el-input
              v-model="registerForm.confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              :prefix-icon="'Lock'"
              show-password
            />
          </el-form-item>
          <el-form-item prop="email" label="邮箱">
            <el-input v-model="registerForm.email" placeholder="请输入邮箱(用于接收验证码)" :prefix-icon="'Message'" />
          </el-form-item>
          <el-form-item prop="studentId" label="学号">
            <el-input v-model="registerForm.studentId" placeholder="请输入学号(选填)" :prefix-icon="'Postcard'" />
          </el-form-item>
          <el-form-item prop="code" label="验证码">
            <div class="code-row">
              <el-input v-model="registerForm.code" placeholder="请输入验证码" :prefix-icon="'Key'" />
              <el-button
                type="primary"
                plain
                :loading="codeLoading"
                :disabled="codeDisabled"
                @click="sendCode"
              >
                {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
              </el-button>
            </div>
          </el-form-item>

          <el-button
            type="primary"
            class="submit-btn"
            :loading="loading"
            @click="handleRegister"
          >
            注册
          </el-button>
        </el-form>

        <div class="auth-footer">
          已有账号?<router-link to="/login" class="link">去登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-light) 0%, #fff 100%);
  padding: 20px;
}
.auth-container {
  width: 100%;
  max-width: 440px;
}
.auth-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
  cursor: pointer;
  .brand-icon {
    font-size: 32px;
    color: var(--primary-color);
  }
  span {
    font-size: 26px;
    font-weight: 700;
    color: var(--primary-color);
  }
}
.auth-card {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: 36px 32px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
}
.auth-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}
.auth-subtitle {
  color: var(--text-secondary);
  margin-bottom: 24px;
}
.code-row {
  display: flex;
  gap: 10px;
  width: 100%;
  .el-input {
    flex: 1;
  }
}
.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  margin-top: 8px;
}
.auth-footer {
  text-align: center;
  margin-top: 24px;
  color: var(--text-secondary);
  font-size: 14px;
  .link {
    margin-left: 4px;
    font-weight: 500;
  }
}
</style>
