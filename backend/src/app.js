/**
 * 应用入口
 * - 创建 Express 应用与 HTTP 服务
 * - 挂载中间件、路由、静态资源
 * - 集成 Socket.IO(/ws/chat)
 * - 启动时初始化数据库(同步表结构、分类数据、管理员账号)
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const { User, Product, Order, Review, Category, sequelize } = require('./models');

const config = require('./config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { setupChat } = require('./sockets/chatHandler');
const { setIo } = require('./sockets/wsHelper');
const ResponseUtil = require('./utils/response');

const app = express();
const server = http.createServer(app);

// Trust Proxy (Nginx 反向代理时设置,确保 rate-limit 和客户端 IP 正确)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ============ Socket.IO ============
const io = new Server(server, {
  path: '/ws/chat',
  cors: {
    origin: config.cors.origin === '*' ? true : config.cors.origin.split(','),
    methods: ['GET', 'POST'],
    credentials: true
  }
});
setupChat(io);
app.set('io', io);
setIo(io);

// ============ 基础中间件 ============
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));

// CORS
const corsOptions = {
  origin: config.cors.origin === '*' ? true : config.cors.origin.split(','),
  credentials: true
};
app.use(cors(corsOptions));

// 日志
app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============ 静态资源(上传文件) ============
const uploadAbsDir = path.join(__dirname, '../', config.upload.dir);
if (!fs.existsSync(uploadAbsDir)) {
  try {
    fs.mkdirSync(uploadAbsDir, { recursive: true });
  } catch (e) {
    console.log('[Upload] 无法创建上传目录(可能沙箱限制):', uploadAbsDir);
  }
}
app.use(config.upload.urlPrefix, express.static(uploadAbsDir));

// ============ 健康检查 ============
app.get('/health', (req, res) => {
  ResponseUtil.success(res, {
    status: 'ok',
    app: config.appName,
    env: config.env,
    uptime: process.uptime()
  });
});

// ============ 业务路由 ============
app.use('/api/v1', routes);

// ============ 404 + 错误处理 ============
app.use(notFound);
app.use(errorHandler);

// ============ 数据库初始化 ============
const DEFAULT_CATEGORIES = [
  { name: '教材书籍', icon: 'book', sort_order: 1 },
  { name: '数码电子', icon: 'device', sort_order: 2 },
  { name: '生活用品', icon: 'life', sort_order: 3 },
  { name: '服装鞋包', icon: 'clothes', sort_order: 4 },
  { name: '运动器材', icon: 'sport', sort_order: 5 },
  { name: '美妆护肤', icon: 'beauty', sort_order: 6 },
  { name: '其他', icon: 'other', sort_order: 7 }
];

/**
 * 初始化分类数据
 */
async function seedCategories() {
  const count = await Category.count();
  if (count > 0) return;
  await Category.bulkCreate(DEFAULT_CATEGORIES);
  console.log('[Init] 已写入默认分类数据');
}

/**
 * 初始化管理员账号
 */
async function seedAdmin() {
  const exist = await User.findOne({ where: { username: config.admin.username } });
  if (exist) return;
  const hashed = await bcrypt.hash(config.admin.password, 10);
  await User.create({
    username: config.admin.username,
    password: hashed,
    nickname: '系统管理员',
    role: 1,
    is_verified: 1,
    status: 1
  });
  console.log(`[Init] 已创建管理员账号: ${config.admin.username} / ${config.admin.password}`);
}

/**
 * 初始化测试数据(3个测试用户 + 商品 + 订单 + 评价)
 */
async function seedTestData() {
  const testUsers = [
    { username: 'zhangsan', password: 'Test1234', email: 'zhangsan@univ.edu.cn', student_id: '2021001234', nickname: '张三', role: 2 },
    { username: 'lisi', password: 'Test1234', email: 'lisi@univ.edu.cn', student_id: '2021001235', nickname: '李四', role: 2 },
    { username: 'wangwu', password: 'Test1234', email: 'wangwu@univ.edu.cn', student_id: '2021001236', nickname: '王五', role: 2 },
  ];
  const created = [];
  for (const u of testUsers) {
    const exist = await User.findOne({ where: { username: u.username } });
    if (exist) { created.push(exist); continue; }
    const hashed = await bcrypt.hash(u.password, 10);
    const user = await User.create({ ...u, password: hashed, status: 1, is_verified: 1 });
    created.push(user);
    console.log(`[Init] 创建测试用户: ${u.username} / ${u.password}`);
  }

  const [zhangsan, lisi, wangwu] = created;
  const categoryBook = await Category.findByPk(1);
  const categoryElec = await Category.findByPk(2);

  // 幂等:张三的测试商品已存在则跳过,避免每次后端重启都重复创建测试商品/订单/评价
  const existingTestProduct = zhangsan
    ? await Product.findOne({ where: { user_id: zhangsan.id, title: '高等数学第七版 - 几乎全新' } })
    : null;
  if (existingTestProduct) {
    console.log('[Init] 测试数据已存在,跳过测试数据初始化(避免重复)');
    return;
  }

  if (zhangsan && categoryBook) {
    await Product.bulkCreate([
      { user_id: zhangsan.id, category_id: 1, title: '高等数学第七版 - 几乎全新', description: '上课用了一学期,笔记很少,书页完好。适合大一新生。', price: 25.00, original_price: 49.80, condition_level: 4, trade_type: 1, status: 1, view_count: 15, favorite_count: 3 },
      { user_id: zhangsan.id, category_id: 3, title: '宿舍收纳盒三件套', description: '毕业出闲置,收纳盒三件套,质量很好。', price: 15.00, original_price: 55.00, condition_level: 3, trade_type: 1, status: 1, view_count: 8, favorite_count: 1 },
    ]);
    console.log('[Init] 创建张三的测试商品');
  }

  if (lisi && categoryElec) {
    await Product.create({ user_id: lisi.id, category_id: 2, title: '罗技无线鼠标 - 九成新', description: '用了半年,功能完好,带接收器。', price: 45.00, original_price: 99.00, condition_level: 3, trade_type: 2, status: 1, view_count: 22, favorite_count: 5 });
    console.log('[Init] 创建李四的测试商品');
  }

  if (zhangsan && wangwu) {
    const product = await Product.findOne({ where: { user_id: zhangsan.id, status: 1 } });
    if (product) {
      const order = await Order.create({ order_no: 'TEST' + Date.now(), product_id: product.id, seller_id: zhangsan.id, buyer_id: wangwu.id, price: product.price, trade_type: 1, product_title: product.title, status: 3, buyer_confirmed: 1, seller_confirmed: 1, confirmed_at: new Date(), remark: '测试订单' });
      await Review.create({ order_id: order.id, product_id: product.id, from_user_id: wangwu.id, to_user_id: zhangsan.id, reviewer_role: 1, rating: 5, content: '书很新,发货快,好评!' });
      console.log('[Init] 创建测试订单+评价');
    }
  }
}

/**
 * Sequelize.sync({ force: false }) 不会修改已有列
 * 此函数扫描所有模型,将数据库中缺失的列用 ALTER TABLE 补上
 * 仅在生产环境 / PostgreSQL 中启用
 */
async function ensureSchemaColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const dialect = sequelize.getDialect();
  const models = sequelize.models;
  const colMap = {
    BIGINT: 'BIGINT',
    INTEGER: 'INTEGER',
    SMALLINT: 'SMALLINT',
    STRING: (attr) => `VARCHAR(${attr.type._length || 255})`,
    TEXT: 'TEXT',
    DECIMAL: (attr) => {
      const p = attr.type._precision || 10;
      const s = attr.type._scale ?? 2;
      return `DECIMAL(${p},${s})`;
    },
    DATE: 'TIMESTAMP',
    BOOLEAN: dialect === 'postgres' ? 'BOOLEAN' : 'TINYINT(1)'
  };

  for (const [name, Model] of Object.entries(models)) {
    const table = Model.tableName;
    const attrs = Model.rawAttributes;
    let existing = [];
    try {
      const [rows] = await sequelize.query(
        dialect === 'postgres'
          ? `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`
          : `SHOW COLUMNS FROM \`${table}\``
      );
      existing = rows.map((r) => (dialect === 'postgres' ? r.column_name : r.Field));
    } catch (_) {
      // 表不存在,交给 sync 创建
      continue;
    }
    let added = 0;
    for (const [attrName, attr] of Object.entries(attrs)) {
      if (existing.includes(attr.field || attrName)) continue;
      if (attrName === 'createdAt' || attrName === 'updatedAt' || attr.field === 'created_at' || attr.field === 'updated_at') continue;
      const typeKey = attr.type.key;
      const typeFn = colMap[typeKey];
      const colType = typeof typeFn === 'function' ? typeFn(attr) : typeFn;
      if (!colType) continue;
      let colDefault = '';
      if (attr.defaultValue !== undefined && attr.defaultValue !== null) {
        if (typeof attr.defaultValue === 'number') colDefault = ` DEFAULT ${attr.defaultValue}`;
        else if (typeof attr.defaultValue === 'string') colDefault = ` DEFAULT '${attr.defaultValue.replace(/'/g, "''")}'`;
      }
      const colNull = attr.allowNull === false ? ' NOT NULL' : '';
      const colName = attr.field || attrName;
      try {
        await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN "${colName}" ${colType}${colNull}${colDefault}`);
        added++;
      } catch (e) {
        console.log(`[DB] 列 ${table}.${colName} 已存在或跳过: ${e.message}`);
      }
    }
    if (added > 0) console.log(`[DB] 补全 ${table} 表 ${added} 个缺失列`);
  }
}

/**
 * 启动服务
 */
async function start() {
  try {
    // 测试数据库连接
    await sequelize.authenticate();
    console.log('[DB] 数据库连接成功');

    // 同步表结构(DB_SYNC=true 或 生产环境首次部署)
    if (config.db.sync || config.env === 'production') {
      const force = config.db.syncForce;
      console.log(`[DB] 开始同步表结构(force=${force})...`);
      await sequelize.sync({ force });
      console.log('[DB] 表结构同步完成');
    }

    // 补全模型中存在、但数据库中缺失的列(兼容旧数据库)
    if (config.env === 'production') {
      await ensureSchemaColumns();
    }

    // 写入初始数据
    await seedCategories();
    await seedAdmin();
    await seedTestData();

    // 启动 HTTP + WebSocket
    server.listen(config.port, () => {
      console.log(`[Server] 服务已启动: http://localhost:${config.port}`);
      console.log(`[Server] API 基础路径: /api/v1`);
      console.log(`[Server] WebSocket: ws://localhost:${config.port}/ws/chat`);
    });
  } catch (err) {
    console.error('[启动失败]', err.message);
    console.error('请检查 .env 中的数据库配置,以及相关服务是否启动。');
    process.exit(1);
  }
}

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n[Server] 收到退出信号,正在关闭...');
  try {
    await sequelize.close();
    console.log('[DB] 连接已关闭');
  } catch (e) {
    /* ignore */
  }
  process.exit(0);
});

// 未捕获异常兜底
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});

start();

module.exports = { app, server, io };
