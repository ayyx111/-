/**
 * JWT 工具:签发/校验 AccessToken 与 RefreshToken
 * RefreshToken 存入 Redis,支持登出与刷新
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { redis, redisKeys } = require('../config/cache');

/**
 * 签发 AccessToken
 * @param {object} payload 用户信息(不含敏感字段)
 */
function signAccessToken(payload) {
  const jti = crypto.randomUUID();
  return jwt.sign(
    { ...payload, jti, type: 'access' },
    config.jwt.secret,
    {
      expiresIn: config.jwt.accessExpires,
      issuer: config.jwt.issuer
    }
  );
}

/**
 * 签发 RefreshToken,并将映射关系存入 Redis(7天)
 */
async function signRefreshToken(payload) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { ...payload, jti, type: 'refresh' },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshExpires,
      issuer: config.jwt.issuer
    }
  );
  // 存储 RefreshToken,便于单点登录/登出与刷新校验
  await redis.set(
    redisKeys.refreshToken(payload.id),
    token,
    'EX',
    config.jwt.refreshExpires
  );
  return token;
}

/**
 * 校验 AccessToken
 * @returns {object} 解码后的 payload
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
}

/**
 * 校验 RefreshToken,并校验是否与 Redis 中一致
 */
async function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwt.refreshSecret, { issuer: config.jwt.issuer });
  if (payload.type !== 'refresh') {
    const err = new Error('无效的Token类型');
    err.name = 'TokenTypeError';
    throw err;
  }
  const stored = await redis.get(redisKeys.refreshToken(payload.id));
  if (!stored || stored !== token) {
    const err = new Error('RefreshToken已失效,请重新登录');
    err.name = 'TokenInvalidError';
    throw err;
  }
  return payload;
}

/**
 * 将 AccessToken 加入黑名单(登出时调用)
 * 黑名单 TTL 与 AccessToken 剩余有效期一致(简化为 accessExpires)
 */
async function blacklistAccessToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
    if (payload.jti) {
      // 计算剩余有效期
      const exp = payload.exp;
      const now = Math.floor(Date.now() / 1000);
      const ttl = Math.max(exp - now, 1);
      await redis.set(redisKeys.tokenBlacklist(payload.jti), '1', 'EX', ttl);
    }
  } catch (e) {
    // Token 已无效,无需加入黑名单
  }
}

/**
 * 判断 AccessToken 是否在黑名单中
 */
async function isBlacklisted(token) {
  try {
    const payload = jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
    if (!payload.jti) return false;
    const v = await redis.get(redisKeys.tokenBlacklist(payload.jti));
    return !!v;
  } catch (e) {
    return false;
  }
}

/**
 * 清除用户 RefreshToken(登出/改密时调用)
 */
async function clearRefreshToken(userId) {
  await redis.del(redisKeys.refreshToken(userId));
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  blacklistAccessToken,
  isBlacklisted,
  clearRefreshToken
};
