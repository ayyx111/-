/**
 * 内存缓存模块 - 替代 Redis
 * 使用 node-cache 实现,零外部依赖
 * 接口与 Redis 兼容,便于切换
 */
const NodeCache = require('node-cache');

const cache = new NodeCache({
  stdTTL: 300,       // 默认TTL 5分钟
  checkperiod: 120,  // 清理周期 2分钟
  useClones: false   // 直接存储引用,提高性能
});

/**
 * Redis兼容的操作封装
 */
const redis = {
  async set(key, value, ...args) {
    // 支持 redis.set(key, value, 'EX', ttl) 格式
    let ttl = undefined;
    if (args.length >= 2 && args[0] === 'EX') {
      ttl = parseInt(args[1], 10);
    }
    return cache.set(key, value, ttl);
  },

  async get(key) {
    return cache.get(key);
  },

  async del(key) {
    return cache.del(key);
  },

  async keys(pattern) {
    const allKeys = cache.keys();
    if (!pattern) return allKeys;
    // 简单模式匹配 (支持 * 通配符)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(k => regex.test(k));
  },

  async exists(key) {
    return cache.has(key);
  },

  on(event, callback) {
    // 兼容接口,实际事件由 NodeCache 内部处理
    setImmediate(callback);
  }
};

/**
 * Redis Key 生成工具(与原版本保持一致)
 */
const redisKeys = {
  refreshToken: (userId) => `token:refresh:${userId}`,
  tokenBlacklist: (jti) => `token:blacklist:${jti}`,
  rateLogin: (ip) => `rate:login:${ip}`,
  verifyCode: (account) => `code:verify:${account}`,
  productDetail: (id) => `product:detail:${id}`,
  productHot: () => 'product:hot',
  wsOnline: (userId) => `ws:online:${userId}`,
  viewProduct: (pid, uid) => `view:product:${pid}:${uid}`
};

module.exports = {
  redis,
  redisKeys,
  cache  // 暴露原始 NodeCache 实例
};
