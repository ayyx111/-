/**
 * 全局配置聚合
 * 统一从环境变量读取配置,并在加载时校验关键项
 */
require('dotenv').config();

const config = {
  // 应用
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  appName: process.env.APP_NAME || 'campus-fish-backend',

  // 数据库
  db: {
    type: process.env.DB_TYPE || 'sqlite', // 'sqlite' | 'mysql' | 'postgres'
    // PostgreSQL/MySQL 连接URL(Railway 等平台自动提供 DATABASE_URL)
    url: process.env.DATABASE_URL || '',
    // Railway 独立 PG 变量(当 DATABASE_URL 未设置时使用)
    pgHost: process.env.PGHOST || '',
    pgPort: parseInt(process.env.PGPORT, 10) || 0,
    pgUser: process.env.PGUSER || '',
    pgPassword: process.env.PGPASSWORD || '',
    pgDatabase: process.env.PGDATABASE || '',
    // MySQL配置
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'campus_fish',
    poolMin: parseInt(process.env.DB_POOL_MIN, 10) || 5,
    poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    poolIdle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    // SQLite配置
    storage: process.env.DB_STORAGE || './database.sqlite',
    sync: String(process.env.DB_SYNC).toLowerCase() === 'true',
    // 是否强制重建表(生产环境应为 false)
    syncForce: String(process.env.DB_SYNC_FORCE || (process.env.NODE_ENV === 'production' ? 'false' : 'true')).toLowerCase() === 'true'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'campus_fish_jwt_secret_change_me_2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'campus_fish_jwt_refresh_secret_change_me_2026',
    accessExpires: parseInt(process.env.JWT_ACCESS_EXPIRES, 10) || 7200,
    refreshExpires: parseInt(process.env.JWT_REFRESH_EXPIRES, 10) || 604800,
    issuer: process.env.JWT_ISSUER || 'campus-fish'
  },

  // 文件上传
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 5 * 1024 * 1024,
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp,image/gif').split(','),
    urlPrefix: process.env.UPLOAD_URL_PREFIX || '/uploads',
    // 公网访问基础URL（生产环境必填，如 https://你的项目.up.railway.app）
    // 设置后返回的图片 URL 会带完整域名，方便 IGA Pages 等外部前端直接访问
    publicBaseUrl: process.env.UPLOAD_PUBLIC_BASE_URL || ''
  },

  // Cloudinary 云存储配置（无签名上传模式,用于永久存储图片）
  // 需要在 Cloudinary Console 创建 Unsigned Upload Preset
  // 文档: https://cloudinary.com/documentation/upload_presets
  cloudinary: {
    // Cloud Name
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    // 无签名 Upload Preset 名称(在 Cloudinary Console 创建)
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
    // 上传目录(在 Cloudinary Media Library 里的文件夹)
    folder: process.env.CLOUDINARY_FOLDER || 'campus-fish'
  },

  // 限流
  rateLimit: {
    loginMax: parseInt(process.env.RATE_LIMIT_LOGIN_MAX, 10) || 5,
    generalMax: parseInt(process.env.RATE_LIMIT_GENERAL_MAX, 10) || 100
  },

  // 管理员初始化
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  },

  // 跨域
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  },

  // AI服务(Python 微服务,现已弃用——AI 能力已内联到 Node 后端,保留 url 仅作向后兼容)
  ai: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:8000'
  },

  // LLM 大模型配置(智谱 GLM-4-Flash,OpenAI 兼容协议)
  // API Key 作为默认值随仓库同步到 GitHub,使 Railway 服务器无需单独配置即可用 AI;
  // 若设置了环境变量 LLM_API_KEY 则以环境变量为准(便于后续替换为独立 Key)。
  llm: {
    apiKey: process.env.LLM_API_KEY || '0b11234a132145ecb1ef8725a3d866cf.81P0lA6YJOtDAV9g',
    baseUrl: process.env.LLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.LLM_MODEL || 'glm-4-flash',
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
    timeout: parseInt(process.env.LLM_TIMEOUT, 10) || 15000
  },

  // 邮件配置(用于发送验证码)
  // 方式 A(推荐): Resend HTTP API — 不受 SMTP 端口限制,Railway 可用
  //   注册 resend.com 获取 API Key(re_ 开头),填入 RESEND_API_KEY 即可
  //   发件人默认使用 onboarding@resend.dev(Resend 测试域名)
  // 方式 B(本地开发): SMTP — 配置 SMTP_HOST/PORT/USER/PASS
  //   常见邮箱: QQ smtp.qq.com:465 / 163 smtp.163.com:465 / Gmail smtp.gmail.com:465
  email: {
    // Resend API
    resendApiKey: process.env.RESEND_API_KEY || '',
    resendFrom: process.env.RESEND_FROM || 'onboarding@resend.dev',
    // SMTP(本地开发备用)
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 465,
    secure: parseInt(process.env.SMTP_PORT, 10) === 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    fromName: process.env.SMTP_FROM_NAME || '校园咸鱼'
  }
};

// 关键配置校验:生产环境强制要求自定义密钥
if (config.env === 'production') {
  if (config.jwt.secret.includes('change_me')) {
    console.error('[CONFIG] 生产环境必须修改 JWT_SECRET');
    process.exit(1);
  }
}

module.exports = config;
