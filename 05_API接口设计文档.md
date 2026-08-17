# 校园版咸鱼 — API 接口设计文档

> 项目名称:校园版咸鱼(校园二手交易平台)
> 文档类型:API 接口设计文档 (API Design Document)
> 文档版本:V1.1
> 编写日期:2026-08-16
> 基础路径:`/api/v1`

---

## 一、接口规范

### 1.1 通用约定

| 项目 | 规范 |
|------|------|
| 协议 | HTTPS |
| 传输格式 | JSON |
| 字符编码 | UTF-8 |
| 认证方式 | Bearer Token (JWT) |
| 请求头 | `Authorization: Bearer <access_token>` |
| 分页参数 | `page`(页码,从1开始)、`pageSize`(每页条数) |
| 时间格式 | ISO 8601 (如 `2026-08-16T10:30:00Z`) |

### 1.2 统一响应格式

**成功响应:**

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {},
  "timestamp": 1786859766000
}
```

**分页响应:**

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "list": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "timestamp": 1786859766000
}
```

**错误响应:**

```json
{
  "code": 400,
  "message": "请求参数错误",
  "errors": [
    { "field": "username", "message": "用户名不能为空" }
  ],
  "timestamp": 1786859766000
}
```

### 1.3 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 429 | 请求限流 |
| 500 | 服务器错误 |

---

## 二、认证模块 API

### 2.1 用户注册

```
POST /api/v1/auth/register
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名(4-20位字母/数字/下划线) |
| password | string | 是 | 密码(6-32位,需包含字母和数字) |
| email | string | 是 | 邮箱 |
| studentId | string | 是 | 学号(4-20位字母数字) |
| code | string | 是 | 验证码 |

**请求示例:**

```json
{
  "username": "zhangsan",
  "password": "Pass1234",
  "email": "zhangsan@univ.edu.cn",
  "studentId": "2021001234",
  "code": "123456"
}
```

**响应示例:**

```json
{
  "code": 201,
  "message": "注册成功",
  "data": {
    "userId": 1,
    "username": "zhangsan"
  }
}
```

---

### 2.2 发送验证码

```
POST /api/v1/auth/send-code
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| account | string | 是 | 邮箱或手机号 |

---

### 2.3 用户登录

```
POST /api/v1/auth/login
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| account | string | 是 | 用户名/邮箱/手机号/学号 |
| password | string | 是 | 密码 |

**响应示例:**

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 7200,
    "user": {
      "id": 1,
      "username": "zhangsan",
      "nickname": "张三",
      "avatar": "/uploads/avatar/1.jpg",
      "role": 0,
      "isVerified": 1
    }
  }
}
```

---

### 2.4 刷新Token

```
POST /api/v1/auth/refresh
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| refreshToken | string | 是 | 刷新令牌 |

---

### 2.5 退出登录

```
POST /api/v1/auth/logout
```

**请求头:** 需要认证

---

### 2.6 重置密码

```
POST /api/v1/auth/reset-password
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| account | string | 是 | 邮箱/手机号 |
| code | string | 是 | 验证码 |
| newPassword | string | 是 | 新密码 |

---

### 2.7 校园身份认证

```
POST /api/v1/auth/verify-campus
```

**请求头:** 需要认证

**请求参数 (multipart/form-data):**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentCardImage | file | 是 | 学生证照片 |
| school | string | 是 | 学校 |
| college | string | 是 | 学院 |
| enrollmentYear | int | 是 | 入学年份 |

---

## 三、用户模块 API

### 3.1 获取当前用户信息

```
GET /api/v1/user/profile
```

**请求头:** 需要认证

**响应示例:**

```json
{
  "code": 200,
  "data": {
    "id": 1,
    "username": "zhangsan",
    "nickname": "张三",
    "avatar": "/uploads/avatar/1.jpg",
    "bio": "爱学习爱生活",
    "email": "zhangsan@univ.edu.cn",
    "phone": "138****8888",
    "school": "某某大学",
    "college": "计算机学院",
    "enrollmentYear": 2023,
    "isVerified": 1,
    "creditScore": 100,
    "productCount": 5,
    "soldCount": 3
  }
}
```

---

### 3.2 更新个人资料

```
PUT /api/v1/user/profile
```

**请求头:** 需要认证

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nickname | string | 否 | 昵称 |
| avatar | file | 否 | 头像 |
| bio | string | 否 | 个性签名 |

---

### 3.3 修改密码

```
PUT /api/v1/user/password
```

**请求头:** 需要认证

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| oldPassword | string | 是 | 旧密码 |
| newPassword | string | 是 | 新密码 |

---

## 四、商品模块 API

### 4.1 获取商品列表

```
GET /api/v1/products
```

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码,默认1 |
| pageSize | int | 否 | 每页数量,默认20 |
| categoryId | int | 否 | 分类ID |
| keyword | string | 否 | 搜索关键词 |
| minPrice | number | 否 | 最低价格 |
| maxPrice | number | 否 | 最高价格 |
| conditionLevel | int | 否 | 新旧程度(1-4) |
| sort | string | 否 | 排序:latest(最新)/price_asc/price_desc/hot(热度) |
| school | string | 否 | 学校筛选 |

**响应示例:**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 1,
        "title": "高等数学第七版 教材",
        "price": 15.00,
        "originalPrice": 49.80,
        "conditionLevel": 2,
        "coverImage": "/uploads/products/1_0.jpg",
        "category": { "id": 1, "name": "教材书籍" },
        "user": { "id": 2, "nickname": "李四", "avatar": "/uploads/avatar/2.jpg", "school": "某某大学" },
        "viewCount": 56,
        "favoriteCount": 8,
        "createdAt": "2026-08-15T14:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 156,
      "totalPages": 8
    }
  }
}
```

---

### 4.2 获取商品详情

```
GET /api/v1/products/:id
```

**响应示例:**

```json
{
  "code": 200,
  "data": {
    "id": 1,
    "title": "高等数学第七版 教材",
    "description": "九成新,无笔记,包邮出",
    "price": 15.00,
    "originalPrice": 49.80,
    "conditionLevel": 2,
    "tradeType": 3,
    "location": "某某大学南门",
    "status": 1,
    "viewCount": 56,
    "favoriteCount": 8,
    "images": [
      "/uploads/products/1_0.jpg",
      "/uploads/products/1_1.jpg"
    ],
    "category": { "id": 1, "name": "教材书籍" },
    "user": {
      "id": 2,
      "nickname": "李四",
      "avatar": "/uploads/avatar/2.jpg",
      "school": "某某大学",
      "creditScore": 98,
      "isVerified": 1
    },
    "isFavorited": false,
    "relatedProducts": [],
    "createdAt": "2026-08-15T14:30:00Z"
  }
}
```

---

### 4.3 发布商品

```
POST /api/v1/products
```

**请求头:** 需要认证 + 需校园认证

**请求参数 (multipart/form-data):**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 标题(≤30字) |
| description | string | 是 | 描述(≤500字) |
| categoryId | int | 是 | 分类ID |
| price | number | 是 | 售价(>0) |
| originalPrice | number | 否 | 原价 |
| conditionLevel | int | 是 | 新旧:1-4 |
| tradeType | int | 是 | 交易方式:1面交 2邮寄 3均可 |
| location | string | 否 | 交易地点 |
| images | file[] | 是 | 商品图片(1-9张) |

---

### 4.4 更新商品

```
PUT /api/v1/products/:id
```

**请求头:** 需要认证(仅作者)

---

### 4.5 删除/下架商品

```
DELETE /api/v1/products/:id
```

**请求头:** 需要认证(仅作者)

---

### 4.6 获取分类列表

```
GET /api/v1/categories
```

**响应示例:**

```json
{
  "code": 200,
  "data": [
    { "id": 1, "name": "教材书籍", "icon": "/icons/book.png" },
    { "id": 2, "name": "数码电子", "icon": "/icons/tech.png" }
  ]
}
```

---

### 4.7 获取我发布的商品

```
GET /api/v1/user/products
```

**请求头:** 需要认证

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |
| status | int | 否 | 商品状态筛选 |

---

## 五、交易模块 API

### 5.1 创建订单

```
POST /api/v1/orders
```

**请求头:** 需要认证 + 需校园认证

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| productId | int | 是 | 商品ID |
| remark | string | 否 | 备注(≤500字) |

**响应示例:**

```json
{
  "code": 201,
  "message": "下单成功",
  "data": {
    "orderId": 1,
    "orderNo": "CF20260816143000001",
    "status": 0,
    "product": {
      "id": 1,
      "title": "高等数学第七版",
      "price": 15.00
    }
  }
}
```

---

### 5.2 获取订单列表

```
GET /api/v1/orders
```

**请求头:** 需要认证

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |
| role | string | 否 | buyer(买家)/seller(卖家)/all(全部) |
| status | int | 否 | 订单状态 |

---

### 5.3 获取订单详情

```
GET /api/v1/orders/:id
```

**请求头:** 需要认证(买卖双方)

---

### 5.4 卖家确认/拒绝订单

```
PUT /api/v1/orders/:id/confirm
```

**请求头:** 需要认证(仅卖家)

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | string | 是 | accept(接受) / reject(拒绝) |
| reason | string | 否 | 拒绝原因 |

---

### 5.5 买家取消订单

```
PUT /api/v1/orders/:id/cancel
```

**请求头:** 需要认证(仅买家)

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reason | string | 否 | 取消原因 |

---

### 5.6 确认交易完成

```
PUT /api/v1/orders/:id/complete
```

**请求头:** 需要认证(买卖双方)

---

### 5.7 提交评价

```
POST /api/v1/orders/:id/review
```

**请求头:** 需要认证(买卖双方)

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rating | int | 是 | 评分(1-5) |
| content | string | 否 | 评价内容(≤500字) |

> 注:系统自动根据当前用户在订单中的角色(买家/卖家)设置 `reviewerRole`。

---

## 六、消息模块 API

### 6.1 获取会话列表

```
GET /api/v1/messages/conversations
```

**请求头:** 需要认证

**响应示例:**

```json
{
  "code": 200,
  "data": [
    {
      "userId": 2,
      "nickname": "李四",
      "avatar": "/uploads/avatar/2.jpg",
      "lastMessage": "这个还在吗?",
      "lastMessageTime": "2026-08-16T10:00:00Z",
      "unreadCount": 3
    }
  ]
}
```

---

### 6.2 获取聊天记录

```
GET /api/v1/messages/:userId
```

**请求头:** 需要认证

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| productId | int | 否 | 关联商品ID |
| page | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |

---

### 6.3 发送消息

```
POST /api/v1/messages
```

**请求头:** 需要认证

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| toUserId | int | 是 | 接收者ID |
| productId | int | 否 | 关联商品ID |
| content | string | 是 | 消息内容 |
| msgType | int | 否 | 类型:0文字 1图片(默认0) |

---

### 6.4 标记消息已读

```
PUT /api/v1/messages/read/:userId
```

**请求头:** 需要认证

---

### 6.5 WebSocket 即时通讯

```
WS /api/v1/ws/chat
```

**连接认证:** Query参数 `?token=<accessToken>`

**客户端→服务器事件:**

| 事件 | 数据 | 说明 |
|------|------|------|
| `message:send` | `{toUserId, content, msgType, productId}` | 发送消息 |
| `message:read` | `{fromUserId}` | 标记已读 |
| `typing` | `{toUserId}` | 正在输入 |

**服务器→客户端事件:**

| 事件 | 数据 | 说明 |
|------|------|------|
| `message:receive` | `{id, fromUserId, content, msgType, createdAt}` | 接收消息 |
| `message:sent` | `{id, status}` | 发送回执 |
| `user:online` | `{userId}` | 用户上线 |
| `user:offline` | `{userId}` | 用户离线 |
| `notification` | `{type, title, content}` | 系统通知 |

---

## 七、收藏模块 API

### 7.1 收藏商品

```
POST /api/v1/favorites
```

**请求头:** 需要认证

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| productId | int | 是 | 商品ID |

---

### 7.2 取消收藏

```
DELETE /api/v1/favorites/:productId
```

**请求头:** 需要认证

---

### 7.3 获取收藏列表

```
GET /api/v1/favorites
```

**请求头:** 需要认证

**查询参数:** page, pageSize

---

## 八、AI 模块 API

### 8.1 智能推荐

```
GET /api/v1/ai/recommend
```

**请求头:** 需要认证(登录用户个性化推荐)

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | home(首页推荐) / similar(相似商品) |
| productId | int | 否 | 相似商品时传(获取某商品的相似推荐) |
| limit | int | 否 | 返回数量,默认10 |

**响应示例:**

```json
{
  "code": 200,
  "data": [
    {
      "id": 5,
      "title": "线性代数教材",
      "price": 12.00,
      "coverImage": "/uploads/products/5_0.jpg",
      "score": 0.95
    }
  ]
}
```

---

### 8.2 智能搜索

```
GET /api/v1/ai/search
```

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词 |
| page | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |

**响应附加字段:**

```json
{
  "code": 200,
  "data": {
    "list": [],
    "expandedKeywords": ["高等数学", "高数教材", "微积分"],
    "suggestion": "您是否要搜索:高等数学教材?",
    "pagination": {}
  }
}
```

---

### 8.3 智能客服

```
POST /api/v1/ai/chatbot
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | 是 | 用户问题 |
| context | array | 否 | 上下文历史 |

**响应示例:**

```json
{
  "code": 200,
  "data": {
    "reply": "您好!发布商品的步骤如下:1.登录并完成校园认证;2.点击\"发布\"按钮;3.填写商品信息并上传图片;4.等待审核通过即可上架。",
    "needHuman": false
  }
}
```

---

## 九、通知模块 API

### 9.1 获取通知列表

```
GET /api/v1/notifications
```

**请求头:** 需要认证

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | int | 否 | 通知类型 |
| isRead | int | 否 | 0未读 1已读 |
| page | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |

---

### 9.2 标记通知已读

```
PUT /api/v1/notifications/:id/read
```

**请求头:** 需要认证

---

### 9.3 全部标记已读

```
PUT /api/v1/notifications/read-all
```

**请求头:** 需要认证

---

### 9.4 获取未读数量

```
GET /api/v1/notifications/unread-count
```

**请求头:** 需要认证

**响应示例:**

```json
{
  "code": 200,
  "data": {
    "total": 8,
    "order": 3,
    "system": 2,
    "chat": 3
  }
}
```

---

## 十、举报模块 API

### 10.1 提交举报

```
POST /api/v1/reports
```

**请求头:** 需要认证

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| targetType | int | 是 | 1商品 2用户 |
| targetId | int | 是 | 目标ID |
| reason | string | 是 | 举报原因 |
| description | string | 否 | 详细描述 |

---

## 十一、管理后台 API

> 所有管理后台接口需要 `role=1` 管理员权限

### 11.1 商品审核

```
GET /api/v1/admin/products/pending
```

```
PUT /api/v1/admin/products/:id/review
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | string | 是 | approve(通过) / reject(拒绝) |
| reason | string | 否 | 拒绝原因 |

---

### 11.2 用户管理

```
GET /api/v1/admin/users
```

```
PUT /api/v1/admin/users/:id/status
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | int | 是 | 0封禁 1正常 |

---

### 11.3 举报处理

```
GET /api/v1/admin/reports
```

```
PUT /api/v1/admin/reports/:id
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | int | 是 | 1已处理 2已驳回 |
| handleResult | string | 是 | 处理结果 |

---

### 11.4 数据统计

```
GET /api/v1/admin/stats
```

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | overview(总览) / trend(趋势) / category(分类分布) |
| startDate | string | 否 | 开始日期 |
| endDate | string | 否 | 结束日期 |

**响应示例(overview):**

```json
{
  "code": 200,
  "data": {
    "userCount": 1256,
    "productCount": 3420,
    "orderCount": 890,
    "todayNewUsers": 12,
    "todayNewProducts": 35,
    "pendingReviews": 8,
    "pendingReports": 3
  }
}
```

---

## 十二、文件上传 API

### 12.1 上传图片

```
POST /api/v1/upload/image
```

**请求头:** 需要认证

**请求参数 (multipart/form-data):**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | file | 是 | 图片文件(jpg/png/webp,≤5MB) |
| type | string | 否 | avatar(头像) / product(商品) / message(消息图片) |

**响应示例:**

```json
{
  "code": 200,
  "data": {
    "url": "/uploads/products/20260816_143000_abc123.jpg",
    "filename": "20260816_143000_abc123.jpg"
  }
}
```

---

## 十三、接口汇总表

| 模块 | 接口数 | 方法 |
|------|--------|------|
| 认证 | 7 | 注册、登录、登出、刷新、验证码、重置密码、校园认证 |
| 用户 | 3 | 资料、更新、改密 |
| 商品 | 7 | 列表、详情、发布、更新、删除、分类、我的发布 |
| 订单 | 7 | 创建、列表、详情、确认、取消、完成、评价 |
| 消息 | 5 | 会话列表、聊天记录、发送、已读、WebSocket |
| 收藏 | 3 | 收藏、取消、列表 |
| AI | 3 | 推荐、搜索、客服 |
| 通知 | 4 | 列表、已读、全部已读、未读数 |
| 举报 | 1 | 提交举报 |
| 管理 | 8 | 商品审核、用户管理、举报处理、统计 |
| 文件 | 1 | 上传图片 |
| **合计** | **49** | |

---

## 十四、错误码对照表

| 错误码 | 含义 | HTTP状态 |
|--------|------|----------|
| 1001 | 用户名已存在 | 409 |
| 1002 | 邮箱已注册 | 409 |
| 1003 | 验证码错误 | 400 |
| 1004 | 账号或密码错误 | 401 |
| 1005 | 账号已被封禁 | 403 |
| 1006 | 账号已锁定 | 403 |
| 2001 | 未进行校园认证 | 403 |
| 2002 | 商品不存在 | 404 |
| 2003 | 商品已售出 | 409 |
| 2004 | 不可购买自己的商品 | 403 |
| 3001 | 订单不存在 | 404 |
| 3002 | 订单状态不允许此操作 | 400 |
| 3003 | 无权操作此订单 | 403 |
| 4001 | 文件大小超限 | 400 |
| 4002 | 文件类型不允许 | 400 |
| 5001 | AI服务暂时不可用 | 503 |

---

> 本API设计文档经评审后作为前后端联调依据。
