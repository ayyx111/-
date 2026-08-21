import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

// 路由配置
const routes = [
  {
    path: '/',
    component: () => import('@/components/layout/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/home/Index.vue'),
        meta: { title: '首页' }
      },
      {
        path: 'products/:id',
        name: 'ProductDetail',
        component: () => import('@/views/product/Detail.vue'),
        meta: { title: '商品详情' }
      },
      {
        path: 'search',
        name: 'Search',
        component: () => import('@/views/home/Search.vue'),
        meta: { title: '搜索结果' }
      },
      {
        path: 'user/:id',
        name: 'UserProfile',
        component: () => import('@/views/user/Profile.vue'),
        meta: { title: '用户主页' }
      }
    ]
  },
  // 登录/注册独立布局(无导航栏)
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/Register.vue'),
    meta: { title: '注册' }
  },
  // 需要登录的页面
  {
    path: '/',
    component: () => import('@/components/layout/MainLayout.vue'),
    children: [
      {
        path: 'products/create',
        name: 'ProductCreate',
        component: () => import('@/views/product/Create.vue'),
        meta: { title: '发布商品', requiresAuth: true, requiresVerified: true }
      },
      {
        path: 'products/:id/edit',
        name: 'ProductEdit',
        component: () => import('@/views/product/Create.vue'),
        meta: { title: '编辑商品', requiresAuth: true }
      },
      {
        path: 'messages',
        name: 'Messages',
        component: () => import('@/views/message/Index.vue'),
        meta: { title: '消息', requiresAuth: true }
      },
      {
        path: 'messages/:userId',
        name: 'MessagesWith',
        component: () => import('@/views/message/Index.vue'),
        meta: { title: '聊天', requiresAuth: true }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/Index.vue'),
        meta: { title: '个人中心', requiresAuth: true }
      },
      {
        path: 'profile/products',
        name: 'ProfileProducts',
        component: () => import('@/views/profile/Products.vue'),
        meta: { title: '我的发布', requiresAuth: true }
      },
      {
        path: 'profile/orders',
        name: 'ProfileOrders',
        component: () => import('@/views/profile/Orders.vue'),
        meta: { title: '我的订单', requiresAuth: true }
      },
      {
        path: 'profile/favorites',
        name: 'ProfileFavorites',
        component: () => import('@/views/profile/Favorites.vue'),
        meta: { title: '我的收藏', requiresAuth: true }
      },
      {
        path: 'profile/verify',
        name: 'ProfileVerify',
        component: () => import('@/views/profile/Verify.vue'),
        meta: { title: '校园认证', requiresAuth: true }
      },
      {
        path: 'profile/settings',
        name: 'ProfileSettings',
        component: () => import('@/views/profile/Settings.vue'),
        meta: { title: '设置', requiresAuth: true }
      },
      {
        path: 'orders/:id',
        name: 'OrderDetail',
        component: () => import('@/views/order/Detail.vue'),
        meta: { title: '订单详情', requiresAuth: true }
      },
      {
        path: 'service',
        name: 'CustomerService',
        component: () => import('@/views/message/Service.vue'),
        meta: { title: '智能客服', requiresAuth: true }
      }
    ]
  },
  // 管理后台
  {
    path: '/admin',
    component: () => import('@/components/layout/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    redirect: '/admin/overview',
    children: [
      {
        path: 'overview',
        name: 'AdminOverview',
        component: () => import('@/views/admin/Overview.vue'),
        meta: { title: '总览' }
      },
      {
        path: 'audit',
        name: 'AdminAudit',
        component: () => import('@/views/admin/ProductAudit.vue'),
        meta: { title: '商品审核' }
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('@/views/admin/Users.vue'),
        meta: { title: '用户管理' }
      },
      {
        path: 'verify',
        name: 'AdminVerify',
        component: () => import('@/views/admin/Verify.vue'),
        meta: { title: '校园认证审核' }
      },
      {
        path: 'school-change',
        name: 'AdminSchoolChange',
        component: () => import('@/views/admin/SchoolChangeAudit.vue'),
        meta: { title: '学校修改审核' }
      },
      {
        path: 'reports',
        name: 'AdminReports',
        component: () => import('@/views/admin/Reports.vue'),
        meta: { title: '举报处理' }
      },
      {
        path: 'statistics',
        name: 'AdminStatistics',
        component: () => import('@/views/admin/Statistics.vue'),
        meta: { title: '数据统计' }
      }
    ]
  },
  // 404
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// ============ 全局前置守卫 ============
router.beforeEach(async (to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title
    ? `${to.meta.title} - 校园版咸鱼`
    : '校园版咸鱼'

  const userStore = useUserStore()

  // 需要登录的页面
  if (to.meta.requiresAuth && !userStore.isLogin) {
    return next({ name: 'Login', query: { redirect: to.fullPath } })
  }

  // 已登录用户访问登录页,跳转首页
  if (to.name === 'Login' && userStore.isLogin) {
    return next({ name: 'Home' })
  }

  // 需要管理员权限
  if (to.meta.requiresAdmin) {
    // 确保用户信息已加载
    if (!userStore.userInfo) {
      try {
        await userStore.getUserInfo()
      } catch (e) {
        return next({ name: 'Login', query: { redirect: to.fullPath } })
      }
    }
    if (!userStore.isAdmin) {
      return next({ name: 'Home' })
    }
  }

  // 需要校园认证
  if (to.meta.requiresVerified) {
    if (!userStore.userInfo) {
      try {
        await userStore.getUserInfo()
      } catch (e) {
        return next({ name: 'Login', query: { redirect: to.fullPath } })
      }
    }
    if (!userStore.isVerified) {
      ElMessage.warning('请先完成校园认证')
      return next({ name: 'ProfileVerify' })
    }
  }

  next()
})

export default router
