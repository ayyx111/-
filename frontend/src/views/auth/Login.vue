<script setup>
// 登录页:居中卡片 + 账号密码 + 记住我 + 注册链接
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const loginFormRef = ref()
const loading = ref(false)

const loginForm = reactive({
  account: '',
  password: '',
  remember: false
})

const rules = {
  account: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ]
}

// 登录提交
async function handleLogin() {
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      await userStore.login({
        account: loginForm.account,
        password: loginForm.password
      })
      // 拉取完整用户信息
      await userStore.getUserInfo()
      ElMessage.success('登录成功')

      // 检查是否已完成校园认证
      const isVerified = userStore.userInfo?.isVerified
      const skipAuthGuide = localStorage.getItem('skipAuthGuide_' + userStore.userInfo?.id)
      
      // 未认证且没有跳过过时,显示引导弹窗
      if (isVerified === 0 && !skipAuthGuide) {
        showAuthGuide()
        return
      }

      // 登录后跳回来源页
      const redirect = route.query.redirect || '/'
      router.push(redirect)
    } catch (e) {
      // 错误已由拦截器提示
    } finally {
      loading.value = false
    }
  })
}

// 显示校园认证引导弹窗
function showAuthGuide() {
  ElMessageBox.confirm(
    '校园认证是使用交易功能的前提。完成认证后即可发布商品、购买物品等。\n\n是否现在前往认证?',
    '完成校园认证',
    {
      confirmButtonText: '立即认证',
      cancelButtonText: '稍后再说',
      type: 'info',
      closeOnClickModal: false
    }
  ).then(() => {
    // 跳转到认证页面
    router.push('/profile/verify')
  }).catch(() => {
    // 用户选择稍后再说,跳转到首页
    localStorage.setItem('skipAuthGuide_' + userStore.userInfo?.id, '1')
    router.push('/')
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
        <h1 class="auth-title">欢迎回来</h1>
        <p class="auth-subtitle">登录校园版咸鱼,开启二手交易</p>

        <el-form
          ref="loginFormRef"
          :model="loginForm"
          :rules="rules"
          size="large"
          @keyup.enter="handleLogin"
        >
          <el-form-item prop="account">
            <el-input
              v-model="loginForm.account"
              placeholder="用户名 / 邮箱 / 手机号 / 学号"
              :prefix-icon="'User'"
              clearable
            />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="请输入密码"
              :prefix-icon="'Lock'"
              show-password
            />
          </el-form-item>
          <div class="form-options">
            <el-checkbox v-model="loginForm.remember">记住我</el-checkbox>
            <router-link to="/service" class="forget-link">忘记密码?</router-link>
          </div>
          <el-button
            type="primary"
            class="submit-btn"
            :loading="loading"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form>

        <div class="auth-footer">
          还没有账号?<router-link to="/register" class="link">立即注册</router-link>
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
  max-width: 420px;
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
  margin-bottom: 28px;
}
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  .forget-link {
    font-size: 13px;
  }
}
.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
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
