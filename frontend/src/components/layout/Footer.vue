<script setup>
// 底部信息栏
const year = new Date().getFullYear()
</script>

<template>
  <footer class="app-footer">
    <div class="container footer-inner">
      <div class="footer-links">
        <router-link to="/">首页</router-link>
        <span class="divider">|</span>
        <router-link to="/service">帮助中心</router-link>
      </div>
      <p class="copyright">© {{ year }} 校园版咸鱼 · 学生项目实战作业 · 仅供学习交流使用</p>
    </div>
  </footer>
</template>

<style lang="scss" scoped>
.app-footer {
  background: #fff;
  border-top: 1px solid var(--border-color);
  padding: 24px 0;
  margin-top: 40px;
}
.footer-inner {
  text-align: center;
}
.footer-links {
  margin-bottom: 8px;
  a {
    color: var(--text-regular);
    margin: 0 4px;
    &:hover {
      color: var(--primary-color);
    }
  }
  .divider {
    color: var(--text-secondary);
    margin: 0 6px;
  }
}
.copyright {
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
