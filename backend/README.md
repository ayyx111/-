# 校园版咸鱼 - 后端服务

校园二手交易平台后端,基于 Node.js + Express + Sequelize + MySQL + Redis + Socket.IO。

## 技术栈

- **运行时**: Node.js >= 16
- **Web 框架**: Express 4
- **ORM**: Sequelize 6 + MySQL 8.0
- **缓存/会话**: Redis (ioredis)
- **认证**: JWT (AccessToken 2h + RefreshToken 7d 存 Redis)
- **密码加密**: bcrypt
- **即时通讯**: Socket.IO
- **文件上传**: Multer
- **安全**: Helmet / CORS / 接口限流 / RBAC 权限

## 目录结构

```
backend/
├── src/
│   ├── config/          # 配置(database.js, redis.js, index.js)
│   ├── middleware/      # 中间件(auth, permission, errorHandler, upload)
│   ├── routes/          # 路由
│   ├── controllers/     # 控制器
│   ├── services/        # 业务服务层
│   ├── models/          # Sequelize 模型
│   ├── utils/           # 工具(jwt, response, validator)
│   ├── sockets/         # WebSocket(chatHandler)
│   └── app.js           # 入口
├── uploads/             # 上传文件目录(运行时自动创建)
├── package.json
├── .env.example
└── README.md
```

## 快速开始

### 1. 环境准备

- Node.js >= 16
- MySQL 8.0
- Redis 7

### 2. 安装依赖

```bash
cd backend
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并按需修改:

```bash
cp .env.example .env
```

需重点确认:`DB_*`、`REDIS_*`、`JWT_SECRET`。

### 4. 初始化数据库

在 MySQL 中创建数据库(字符集 utf8mb4):

```sql
CREATE DATABASE IF NOT EXISTS campus_fish
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

> 首次启动时若 `DB_SYNC=true`,程序会自动同步表结构、写入分类数据与管理员账号。
> 管理员默认账号:`admin / admin123`(可在 `.env` 中通过 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 配置)。

### 5. 启动服务

```bash
# 开发模式(热重载)
npm run dev

# 生产模式
npm start
```

启动后默认监听 `http://localhost:3000`,API 基础路径 `/api/v1`。

## API 概览

所有接口统一前缀 `/api/v1`,统一响应格式:

```json
{ "code": 200, "message": "操作成功", "data": {}, "timestamp": 1786859766000 }
```

分页响应:`data` 内含 `list` 与 `pagination(page, pageSize, total, totalPages)`。

| 模块 | 路径前缀 | 说明 |
|------|----------|------|
| 认证 | /auth | 注册/登录/验证码/刷新/重置密码/校园认证 |
| 用户 | /user | 个人资料/修改密码 |
| 商品 | /products, /categories, /user/products | 商品 CRUD + 分类 + 我的发布 |
| 订单 | /orders | 下单/确认/取消/完成/评价 |
| 消息 | /messages + WS /ws/chat | 会话列表/聊天记录/已读 |
| 收藏 | /favorites | 收藏/取消/列表 |
| 通知 | /notifications | 列表/已读/未读数 |
| 举报 | /reports | 提交举报 |
| 管理 | /admin | 审核/用户/举报/统计(需 role=1) |
| 上传 | /upload | 图片上传(5MB) |

### WebSocket

连接地址:`ws://host:port/ws/chat`(需带 `token` query 参数)

主要事件:`message:send`、`message:receive`、`message:read`、`typing`、`user:online`、`user:offline`。

## 角色

- `role = 0` 普通用户
- `role = 1` 管理员(RBAC 校验)

## 安全说明

- 密码 bcrypt 加密存储
- AccessToken 2h,RefreshToken 7d 存 Redis(登出加入黑名单)
- 登录接口限流 5 次/分钟
- 资源归属校验(仅作者可改/删自己的商品与订单操作权限校验)
- 文件上传类型与大小限制(默认 5MB,仅图片)
