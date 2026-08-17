# 校园版咸鱼 - 前端

校园二手交易平台前端应用,基于 Vue 3 + Vite + Element Plus 实现。

## 自动部署

代码推送 `main` 分支后,GitHub Actions 自动构建并部署到 IGA Pages。

## 技术栈

- Vue 3 (Composition API, `<script setup>`)
- Vite 5 构建工具
- Pinia 3 状态管理(+ 持久化插件)
- Vue Router 4
- Element Plus UI 组件库(全量引入 + 图标)
- Axios HTTP 请求
- Socket.IO Client(WebSocket 实时通信)
- 响应式设计(PC + 移动端适配)

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器(默认 http://localhost:5173)
npm run dev

# 构建生产包
npm run build

# 预览生产包
npm run preview
```

## 后端对接

- 开发环境通过 Vite 代理将 `/api` 转发到 `http://localhost:3000`
- 后端基础路径:`/api/v1`
- WebSocket 路径:`/api/v1/ws/chat`(通过 query 参数 `?token=` 认证)
- 统一响应格式:`{ code, message, data, timestamp }`

启动前端前请确保后端服务运行在 `http://localhost:3000`。

## 目录结构

```
src/
├── api/           # API 请求层(request.js 封装 + 各业务模块)
├── assets/        # 静态资源
├── components/    # 公共组件(layout 布局、product 商品)
├── views/         # 页面(home/auth/product/order/message/profile/admin)
├── router/        # 路由配置(含登录/管理员/认证守卫)
├── stores/        # Pinia 状态(user/product/message)
├── utils/         # 工具函数(format 格式化、socket WebSocket)
├── styles/        # 全局样式(SCSS + 主题变量)
├── App.vue
└── main.js
```

## 主题

- 主色:`#4CAF50`(绿色)
- 辅色:`#FF9800`(橙色)
- 通过 Element Plus CSS 变量覆盖实现主题定制

## 功能模块

- 首页:分类导航、商品网格、AI 推荐、分页加载
- 认证:登录、注册(验证码)、校园身份认证
- 商品:详情(图片轮播/AI 相似推荐)、发布/编辑(多图上传)
- 消息:会话列表 + WebSocket 实时聊天 + AI 智能客服
- 个人中心:我的发布/订单/收藏、设置、修改密码
- 管理后台:总览、商品审核、用户管理、举报处理、数据统计
