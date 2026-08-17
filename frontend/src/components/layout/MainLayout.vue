<script setup>
// 主布局:顶部导航 + 内容区 + 底部
import NavBar from './NavBar.vue'
import AppFooter from './Footer.vue'
</script>

<template>
  <div class="main-layout">
    <NavBar />
    <main class="main-content">
      <router-view />
    </main>
    <AppFooter />
  </div>
</template>

<style lang="scss" scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.main-content {
  flex: 1;
}
</style>
