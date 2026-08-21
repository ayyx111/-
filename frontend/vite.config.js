import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import path from 'path'

// Vite 配置: Vue3 + Element Plus 按需引入 + 开发代理
export default defineConfig({
  plugins: [
    vue(),
    // Element Plus API 自动导入(如 ElMessage / ElMessageBox)
    AutoImport({
      resolvers: [ElementPlusResolver()]
    }),
    // Element Plus 组件自动按需注册
    Components({
      resolvers: [ElementPlusResolver()]
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: true,
    allowedHosts: true,
    proxy: {
      // 将 /api 请求代理到后端服务
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      // WebSocket 代理
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500
  }
})
