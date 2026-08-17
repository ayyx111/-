import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import './styles/index.scss'

// 修复:启动时清理损坏的持久化数据
try {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem('campus-user')
    if (raw) {
      let bad = false
      try {
        const obj = JSON.parse(raw)
        if (!obj || typeof obj !== 'object') bad = true
        if (!bad && obj.token === undefined) bad = true
      } catch {
        bad = true
      }
      if (bad) localStorage.removeItem('campus-user')
    }
  }
} catch {
  // ignore
}

// 创建 Vue 应用实例
const app = createApp(App)

// Pinia 状态管理 + 持久化插件(pinia v2 + pinia-plugin-persistedstate v3)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 全局注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
