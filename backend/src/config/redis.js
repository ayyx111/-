/**
 * Redis 连接与常用 Key 工具
 */
const Redis = require('ioredis');
const config = require('./index');

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  keyPrefix: config.redis.keyPrefix,
  retryStrategy: (times) => {
    // 重连退避策略
    if (times > 10) {
      console.error('[Redis] 重连次数过多,放弃连接');
      return null;
    }
    return Math.min(times * 500, 3000);
  }
});

redis.on('connect', () => {
  console.log('[Redis] 连接成功');
});

redis.on('error', (err) => {
  console.error('[Redis] 连接错误:', err.message);
});

/**
 * Redis Key 生成工具(自动带前缀)
 */
const redisKeys = {
  // RefreshToken: token:refresh:{userId}
  refreshToken: (userId) => `token:refresh:${userId}`,
  // Token黑名单: token:blacklist:{jti}
  tokenBlacklist: (jti) => `token:blacklist:${jti}`,
  // 登录限流: rate:login:{ip}
  rateLogin: (ip) => `rate:login:${ip}`,
  // 验证码: code:verify:{email}
  verifyCode: (account) => `code:verify:${account}`,
  // 商品详情缓存: product:detail:{id}
  productDetail: (id) => `product:detail:${id}`,
  // 热门商品: product:hot
  productHot: () => 'product:hot',
  // WebSocket在线状态: ws:online:{userId}
  wsOnline: (userId) => `ws:online:${userId}`,
  // 防重复浏览: view:product:{pid}:{uid}
  viewProduct: (pid, uid) => `view:product:${pid}:${uid}`
};

module.exports = {
  redis,
  redisKeys
};
