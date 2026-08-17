# 校园版咸鱼 — AI 服务

校园二手交易平台的 AI 服务模块,基于 FastAPI 构建,提供智能推荐、智能搜索、智能客服、内容审核四大能力。

## 技术栈

- Python 3.11
- FastAPI(异步 Web 框架)
- Uvicorn(ASGI 服务器)
- aiomysql(MySQL 异步连接池)
- redis(Redis 缓存,asyncio)
- Pydantic(数据校验)

## 项目结构

```
ai-service/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置(环境变量)
│   ├── database.py          # MySQL/Redis 连接管理
│   ├── api/                 # API 路由层
│   │   ├── __init__.py
│   │   ├── recommend.py     # 智能推荐 GET /api/recommend
│   │   ├── search.py        # 智能搜索 GET /api/search
│   │   ├── chatbot.py       # 智能客服 POST /api/chatbot
│   │   └── review.py        # 内容审核 POST /api/review
│   ├── services/            # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── recommend_service.py
│   │   ├── search_service.py
│   │   ├── chatbot_service.py
│   │   └── review_service.py
│   ├── models/              # 数据模型(Pydantic)
│   │   └── __init__.py
│   └── utils/               # 工具
│       └── __init__.py
├── requirements.txt
├── Dockerfile
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd ai-service
pip install -r requirements.txt
```

### 2. 配置环境变量(可选,未设置则使用默认值)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| DB_HOST | localhost | MySQL 主机 |
| DB_PORT | 3306 | MySQL 端口 |
| DB_USER | root | MySQL 用户名 |
| DB_PASSWORD | root | MySQL 密码 |
| DB_NAME | campus_fish | 数据库名 |
| REDIS_HOST | localhost | Redis 主机 |
| REDIS_PORT | 6379 | Redis 端口 |
| APP_PORT | 8000 | 服务端口 |

### 3. 启动服务

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

启动后访问:
- 接口文档(Swagger):http://localhost:8000/docs
- 健康检查:http://localhost:8000/health

> 说明:服务启动时会尝试连接 MySQL 与 Redis,连接失败不会阻断启动,相关接口会优雅降级(返回空数据),便于在没有数据库的环境下调试。

### 4. Docker 部署

```bash
docker build -t campus-fish-ai .
docker run -d -p 8000:8000 \
  -e DB_HOST=host.docker.internal \
  -e REDIS_HOST=host.docker.internal \
  campus-fish-ai
```

## API 接口

### 1. 智能推荐 `GET /api/recommend`

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | int | 否 | 用户 ID(登录用户传入,用于个性化推荐) |
| type | string | 否 | home(首页推荐)/ similar(相似商品),默认 home |
| productId | int | 否 | 相似推荐时传入的目标商品 ID |
| limit | int | 否 | 返回数量,默认 10 |

**推荐策略:**
- 登录用户(type=home,传 userId):基于浏览历史 + 收藏的个性化推荐
- 未登录用户(type=home,不传 userId):基于热度的热门商品推荐
- 相似推荐(type=similar,传 productId):基于分类 + 标题关键词相似度

**响应示例:**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": 5,
      "title": "线性代数教材",
      "price": 12.0,
      "coverImage": "/uploads/products/5_0.jpg",
      "score": 0.85
    }
  ]
}
```

### 2. 智能搜索 `GET /api/search`

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词 |
| page | int | 否 | 页码,默认 1 |
| pageSize | int | 否 | 每页数量,默认 20 |

**功能:** 关键词分词 + 同义词扩展(如"高数"→ 高等数学、微积分)+ 数据库 LIKE 匹配 + 相关度排序(标题完全匹配 > 标题包含 > 描述包含),无结果时推荐相近商品。

**响应示例:**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [],
    "expandedKeywords": ["高等数学", "微积分", "数学分析"],
    "suggestion": "",
    "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
  }
}
```

### 3. 智能客服 `POST /api/chatbot`

**请求体:**

```json
{
  "message": "如何发布商品",
  "context": []
}
```

**功能:** FAQ 知识库关键词匹配,涵盖注册、发布商品、购买、校园认证、交易安全、退款、举报、商品审核等问题;匹配不到时返回通用回复并建议联系人工客服。

**响应示例:**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "reply": "发布商品步骤如下:1.登录并完成校园认证;2.点击「发布」按钮;...",
    "needHuman": false
  }
}
```

### 4. 内容审核 `POST /api/review`

**请求体:**

```json
{
  "title": "高等数学教材",
  "description": "九成新,无笔记",
  "price": 15
}
```

**功能:** 违禁词/敏感词检测 + 价格异常检测,返回 `pass`(通过)/ `suspicious`(可疑)/ `reject`(拒绝)。

**响应示例:**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "result": "pass",
    "reason": "内容审核通过"
  }
}
```

## 数据库依赖

直连 `campus_fish` 数据库,查询以下表:

| 表 | 用途 |
|----|------|
| products | 商品信息(推荐/搜索/审核) |
| product_images | 商品封面图(子查询取首图) |
| user_browse_history | 用户浏览历史(个性化推荐) |
| favorites | 用户收藏(个性化推荐) |
| categories | 商品分类 |

## 推荐算法说明

1. **个性化推荐**:统计用户浏览 + 收藏商品的分类偏好(收藏权重更高),从偏好分类中排除已浏览商品,按「分类偏好 + 商品热度」综合评分排序。
2. **热门推荐**:按 `浏览量 + 收藏量×3` 的热度评分排序,结果缓存至 Redis。
3. **相似推荐**:取同分类商品,用标题关键词的 Jaccard 相似度(字符 + 二元组)排序。
